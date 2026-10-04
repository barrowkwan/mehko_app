-- FEAT-12: one offering, several pickup slots (point + date + time).
-- A "slot" is an ordinary offering row; slots of the same offering share a `group_id`. Everything downstream
-- (orders, QR, reports, emails, live location, reminders) keeps working per slot. What the group adds:
--   * one cutoff, instructions and food list for all slots (kept in sync by update_offering),
--   * food quantity limits shared across the group (a "pool"),
--   * add_offering_slot() for merchants and change_order_slot() for customers (until the cutoff).
-- See docs/plans/feat-12-multiple-pickup-slots.md.

alter table offerings add column group_id uuid;
create index on offerings (group_id) where group_id is not null;

-- ───────────────────────── stock pools ─────────────────────────
-- All offering_items for the same food in the same slot group (just itself when the offering has no group).
create function offering_pool(p_item uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select oi2.id
  from offering_items oi
  join offerings o on o.id = oi.offering_id
  join offerings o2 on o2.id = o.id or (o.group_id is not null and o2.group_id = o.group_id)
  join offering_items oi2 on oi2.offering_id = o2.id and oi2.food_item_id = oi.food_item_id
  where oi.id = p_item;
$$;
revoke all on function offering_pool(uuid) from public, anon, authenticated;

create or replace function _write_order_items(p_order uuid, p_offering uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  it record;
  used integer;
  lim integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  delete from order_items where order_id = p_order;

  for it in
    select (e ->> 'offering_item_id')::uuid as offering_item_id, (e ->> 'qty')::int as qty
    from jsonb_array_elements(p_items) e
  loop
    if it.qty is null or it.qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select quantity_limit into lim from offering_items
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

    insert into order_items (order_id, offering_item_id, qty)
    values (p_order, it.offering_item_id, it.qty)
    on conflict (order_id, offering_item_id) do update set qty = order_items.qty + excluded.qty;
  end loop;
end;
$$;

create or replace function offering_stock(p_offering uuid)
returns table (offering_item_id uuid, remaining integer)
language sql stable security definer set search_path = public as $$
  select oit.id,
         oit.quantity_limit - coalesce((
           select sum(oi.qty)::int from order_items oi join orders o on o.id = oi.order_id
           where oi.offering_item_id in (select offering_pool(oit.id)) and o.status <> 'cancelled'
         ), 0)
  from offering_items oit
  join offerings f on f.id = oit.offering_id
  where oit.offering_id = p_offering and oit.quantity_limit is not null and f.status = 'published';
$$;

-- The "limit below what is already ordered" check counts the whole pool.
create or replace function protect_offering_item_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ordered integer;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from order_items oi join orders o on o.id = oi.order_id
      where oi.offering_item_id = old.id and o.status in ('placed', 'picked_up')
    ) then
      raise exception 'Item has orders';
    end if;
    delete from order_items where offering_item_id = old.id;
    return old;
  end if;

  if new.food_item_id is distinct from old.food_item_id or new.offering_id is distinct from old.offering_id then
    raise exception 'An item''s food and offering cannot be changed; remove it and add another';
  end if;
  if new.quantity_limit is not null then
    select coalesce(sum(oi.qty), 0) into ordered
    from order_items oi join orders o on o.id = oi.order_id
    where oi.offering_item_id in (select offering_pool(old.id)) and o.status <> 'cancelled';
    if new.quantity_limit < ordered then
      raise exception 'Limit is below the quantity already ordered (%)', ordered;
    end if;
  end if;
  return new;
end;
$$;

-- ───────────────────────── merchants: add a slot ─────────────────────────
-- A copy of the offering (same cutoff, status, instructions, foods and limits) at another point/date/time.
-- Runs with the caller's rights (RLS), all-or-nothing.
create function add_offering_slot(p_offering uuid, p_pickup_point uuid, p_date date, p_start time, p_end time)
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
  if p_date < (now() at time zone tz)::date then raise exception 'The new date is in the past'; end if;

  gid := coalesce(o.group_id, gen_random_uuid());
  if o.group_id is null then update offerings set group_id = gid where id = o.id; end if;

  insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, status, instructions, translations, group_id)
  values (o.merchant_id, p_pickup_point, p_date, p_start, p_end, o.cutoff_at, o.status, o.instructions, o.translations, gid)
  returning id into new_id;

  insert into offering_items (offering_id, food_item_id, quantity_limit)
  select new_id, oi.food_item_id, oi.quantity_limit from offering_items oi where oi.offering_id = o.id;

  return new_id;
end;
$$;
revoke all on function add_offering_slot(uuid, uuid, date, time, time) from public, anon;
grant execute on function add_offering_slot(uuid, uuid, date, time, time) to authenticated;

-- update_offering: the shared parts (cutoff, instructions, translations, foods and limits) also go to the
-- other upcoming slots of the group; the schedule fields (point/date/time) stay per slot.
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

  insert into offering_items (offering_id, food_item_id, quantity_limit)
  select p_offering, (e ->> 'food_item_id')::uuid, nullif(e ->> 'quantity_limit', '')::int
  from jsonb_array_elements(p_items) e
  on conflict (offering_id, food_item_id) do update set quantity_limit = excluded.quantity_limit;

  if o.group_id is not null then
    select * into cur from offerings where id = p_offering;
    for sib in
      select id from offerings
      where group_id = o.group_id and id <> p_offering and pickup_date >= (now() at time zone 'UTC')::date - 1
    loop
      update offerings set cutoff_at = cur.cutoff_at, instructions = cur.instructions, translations = cur.translations
       where id = sib;
      delete from offering_items
       where offering_id = sib
         and food_item_id not in (select (e ->> 'food_item_id')::uuid from jsonb_array_elements(p_items) e);
      insert into offering_items (offering_id, food_item_id, quantity_limit)
      select sib, (e ->> 'food_item_id')::uuid, nullif(e ->> 'quantity_limit', '')::int
      from jsonb_array_elements(p_items) e
      on conflict (offering_id, food_item_id) do update set quantity_limit = excluded.quantity_limit;
    end loop;
  end if;
end;
$$;

-- ───────────────────────── customers: move an order to another slot ─────────────────────────
-- Same group, still published, before the cutoff. Quantities carry over; stock is shared by the group, so it
-- cannot run out by moving.
create function change_order_slot(p_order uuid, p_new_offering uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  cur offerings;
  tgt offerings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into o from orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'placed' then raise exception 'Order can no longer be changed'; end if;
  select * into cur from offerings where id = o.offering_id;
  if now() >= cur.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;
  if p_new_offering = cur.id then return; end if;

  select * into tgt from offerings where id = p_new_offering for share;
  if not found or tgt.status <> 'published' or tgt.group_id is null or tgt.group_id is distinct from cur.group_id then
    raise exception 'Offering is not available';
  end if;
  if now() >= tgt.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;

  if exists (
    select 1 from order_items oi join offering_items ci on ci.id = oi.offering_item_id
    where oi.order_id = p_order
      and not exists (select 1 from offering_items t where t.offering_id = p_new_offering and t.food_item_id = ci.food_item_id)
  ) then
    raise exception 'Item does not belong to this offering';
  end if;

  update order_items oi
     set offering_item_id = t.id
    from offering_items ci, offering_items t
   where oi.order_id = p_order and ci.id = oi.offering_item_id
     and t.offering_id = p_new_offering and t.food_item_id = ci.food_item_id;
  update orders set offering_id = p_new_offering, updated_at = now() where id = p_order;
exception when unique_violation then
  raise exception 'You already have an order for this offering; edit it instead';
end;
$$;
revoke all on function change_order_slot(uuid, uuid) from public, anon;
grant execute on function change_order_slot(uuid, uuid) to authenticated;

-- Customers see the other slots of an offering they can order from (slots stay readable by their group).
-- (offerings_read already allows published slots; no change needed.)
