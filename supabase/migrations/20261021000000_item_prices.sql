-- Prices belong to an OFFERING ITEM, not to the food: the same food can cost different amounts in different offerings.
-- A price is optional (null = no price shown). Currency is US dollars for now; amounts are whole cents.
-- An order line remembers the price it was ordered at (unit_price_cents), so a later price change does not alter an
-- existing order's total. Nothing is charged here: payments are separate (cash/Venmo/Zelle arranged directly).

alter table offering_items
  add column price_cents integer check (price_cents is null or (price_cents >= 0 and price_cents <= 1000000));
alter table order_items
  add column unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0);

-- Placing/updating an order: a line that was already in the order keeps its price; a new line gets the current price.
create or replace function _write_order_items(p_order uuid, p_offering uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  it record;
  used integer;
  lim integer;
  price integer;
  kept jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- prices already on this order, by food (an order moved to another slot has items of that slot but the same foods)
  select coalesce(jsonb_object_agg(ci.food_item_id::text, oi.unit_price_cents), '{}'::jsonb) into kept
    from order_items oi join offering_items ci on ci.id = oi.offering_item_id
   where oi.order_id = p_order and oi.unit_price_cents is not null;

  delete from order_items where order_id = p_order;

  for it in
    select (e ->> 'offering_item_id')::uuid as offering_item_id, (e ->> 'qty')::int as qty
    from jsonb_array_elements(p_items) e
  loop
    if it.qty is null or it.qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select quantity_limit, price_cents into lim, price from offering_items
      where id = it.offering_item_id and offering_id = p_offering;
    if not found then
      raise exception 'Item does not belong to this offering';
    end if;

    if lim is not null then
      select coalesce(sum(oi.qty), 0) into used
      from order_items oi join orders o on o.id = oi.order_id
      where oi.offering_item_id in (select offering_pool(it.offering_item_id))
        and o.status <> 'cancelled' and o.id <> p_order;
      if used + it.qty > lim then
        raise exception 'Not enough stock remaining for an item';
      end if;
    end if;

    insert into order_items (order_id, offering_item_id, qty, unit_price_cents)
    values (
      p_order, it.offering_item_id, it.qty,
      coalesce((kept ->> (select food_item_id::text from offering_items where id = it.offering_item_id))::int, price)
    )
    on conflict (order_id, offering_item_id) do update set qty = order_items.qty + excluded.qty;
  end loop;
end;
$$;

-- update_offering: items now carry price_cents; prices (like limits) are kept in sync across the offering's slots.
create or replace function update_offering(
  p_offering uuid, p_pickup_point uuid, p_date date, p_start time, p_end time, p_cutoff timestamptz, p_items jsonb,
  p_instructions text default null, p_translations jsonb default null
) returns void
language plpgsql set search_path = public as $$
declare
  o offerings;
  cur offerings;
  sib uuid;
begin
  select * into o from offerings where id = p_offering;
  if not found or not is_merchant_owner(o.merchant_id) then raise exception 'Offering not found'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An offering must contain at least one item';
  end if;

  update offerings
     set pickup_point_id = p_pickup_point, pickup_date = p_date, pickup_start = p_start,
         pickup_end = p_end, cutoff_at = p_cutoff,
         instructions = case when p_instructions is null then instructions else nullif(btrim(p_instructions), '') end,
         translations = coalesce(p_translations, translations)
   where id = p_offering;

  delete from offering_items
   where offering_id = p_offering
     and food_item_id not in (select (e ->> 'food_item_id')::uuid from jsonb_array_elements(p_items) e);

  insert into offering_items (offering_id, food_item_id, quantity_limit, price_cents)
  select p_offering, (e ->> 'food_item_id')::uuid, nullif(e ->> 'quantity_limit', '')::int, nullif(e ->> 'price_cents', '')::int
  from jsonb_array_elements(p_items) e
  on conflict (offering_id, food_item_id) do update
    set quantity_limit = excluded.quantity_limit, price_cents = excluded.price_cents;

  if o.group_id is not null then
    select * into cur from offerings where id = p_offering;
    for sib in
      select id from offerings
      where group_id = o.group_id and id <> p_offering and pickup_date >= (now() at time zone 'UTC')::date - 1
    loop
      update offerings set cutoff_at = cur.cutoff_at, pickup_date = cur.pickup_date, instructions = cur.instructions, translations = cur.translations
       where id = sib;
      delete from offering_items
       where offering_id = sib
         and food_item_id not in (select (e ->> 'food_item_id')::uuid from jsonb_array_elements(p_items) e);
      insert into offering_items (offering_id, food_item_id, quantity_limit, price_cents)
      select sib, (e ->> 'food_item_id')::uuid, nullif(e ->> 'quantity_limit', '')::int, nullif(e ->> 'price_cents', '')::int
      from jsonb_array_elements(p_items) e
      on conflict (offering_id, food_item_id) do update
        set quantity_limit = excluded.quantity_limit, price_cents = excluded.price_cents;
    end loop;
  end if;
end;
$$;

-- A slot added to an offering, and a duplicate of it, copy the prices too.
create or replace function add_offering_slot(p_offering uuid, p_pickup_point uuid, p_date date, p_start time, p_end time)
returns uuid
language plpgsql set search_path = public as $$
declare
  o offerings;
  tz text;
  gid uuid;
  new_id uuid;
begin
  select * into o from offerings where id = p_offering;
  if not found or not is_merchant_owner(o.merchant_id) then raise exception 'Offering not found'; end if;
  select timezone into tz from pickup_points where id = p_pickup_point and merchant_id = o.merchant_id;
  if not found then raise exception 'Pickup point not found'; end if;
  if p_date <> o.pickup_date then raise exception 'All pickup slots must be on the same date'; end if;
  if p_date < (now() at time zone tz)::date then raise exception 'The new date is in the past'; end if;

  gid := coalesce(o.group_id, gen_random_uuid());
  if o.group_id is null then update offerings set group_id = gid where id = o.id; end if;

  insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, status, instructions, translations, group_id, share_public, share_address)
  values (o.merchant_id, p_pickup_point, p_date, p_start, p_end, o.cutoff_at, o.status, o.instructions, o.translations, gid, o.share_public, o.share_address)
  returning id into new_id;

  insert into offering_items (offering_id, food_item_id, quantity_limit, price_cents)
  select new_id, oi.food_item_id, oi.quantity_limit, oi.price_cents from offering_items oi where oi.offering_id = o.id;

  return new_id;
end;
$$;

create or replace function duplicate_offering(p_offering uuid, p_new_date date) returns uuid
language plpgsql set search_path = public as $$
declare
  o offerings;
  tz text;
  lead interval;
  new_id uuid;
begin
  select * into o from offerings where id = p_offering;
  if not found or not is_merchant_owner(o.merchant_id) then raise exception 'Offering not found'; end if;
  select timezone into tz from pickup_points where id = o.pickup_point_id;
  if p_new_date < (now() at time zone tz)::date then raise exception 'The new date is in the past'; end if;

  lead := (o.pickup_date + o.pickup_start) - (o.cutoff_at at time zone tz);   -- wall-clock difference
  insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, status, instructions, translations)
  values (o.merchant_id, o.pickup_point_id, p_new_date, o.pickup_start, o.pickup_end,
          ((p_new_date + o.pickup_start) - lead) at time zone tz, 'draft', o.instructions, o.translations)
  returning id into new_id;

  insert into offering_items (offering_id, food_item_id, quantity_limit, price_cents)
  select new_id, oi.food_item_id, oi.quantity_limit, oi.price_cents
  from offering_items oi join food_items f on f.id = oi.food_item_id
  where oi.offering_id = p_offering and f.active;

  return new_id;
end;
$$;

-- The public share page shows prices too.
create or replace function get_shared_offering(p_offering_no text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  first_slot offerings;
  result jsonb;
begin
  select * into first_slot from offerings
   where offering_no = p_offering_no and share_public and status <> 'draft'
   order by pickup_date, pickup_start limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'offering_no', first_slot.offering_no,
    'cutoff_at', first_slot.cutoff_at,
    'open', exists (
      select 1 from offerings f
       where f.offering_no = p_offering_no and f.merchant_id = first_slot.merchant_id and f.share_public
         and f.status = 'published' and f.cutoff_at > now()
    ),
    'merchant', (
      select jsonb_build_object('name', m.name, 'description', m.description, 'translations', m.translations,
                                'logo_path', m.logo_path, 'website', m.website)
        from merchants m where m.id = first_slot.merchant_id
    ),
    'slots', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', f.id, 'pickup_date', f.pickup_date, 'pickup_start', f.pickup_start, 'pickup_end', f.pickup_end,
               'timezone', p.timezone, 'place', p.name,
               'address', case when f.share_address then p.address end,
               'open', (f.status = 'published' and f.cutoff_at > now())
             ) order by f.pickup_date, f.pickup_start), '[]'::jsonb)
        from offerings f join pickup_points p on p.id = f.pickup_point_id
       where f.offering_no = p_offering_no and f.merchant_id = first_slot.merchant_id and f.share_public and f.status <> 'draft'
    ),
    'foods', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', fi.name, 'description', fi.description, 'translations', fi.translations,
               'image_path', fi.image_path, 'limit', oi.quantity_limit, 'price_cents', oi.price_cents
             ) order by fi.name), '[]'::jsonb)
        from offering_items oi join food_items fi on fi.id = oi.food_item_id
       where oi.offering_id = first_slot.id
    )
  ) into result;
  return result;
end;
$$;
