-- FEAT-12 rule from the product owner: the pickup slots of one offering are on the SAME DATE (different points
-- and/or times). Other days are separate offerings (or "duplicate to a new date").

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

  insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, status, instructions, translations, group_id)
  values (o.merchant_id, p_pickup_point, p_date, p_start, p_end, o.cutoff_at, o.status, o.instructions, o.translations, gid)
  returning id into new_id;

  insert into offering_items (offering_id, food_item_id, quantity_limit)
  select new_id, oi.food_item_id, oi.quantity_limit from offering_items oi where oi.offering_id = o.id;

  return new_id;
end;
$$;

-- update_offering: the date is now a shared part too (moving it moves every upcoming slot together; the existing
-- "cannot move an offering that has orders" rule still applies to each slot).
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
      update offerings set cutoff_at = cur.cutoff_at, pickup_date = cur.pickup_date, instructions = cur.instructions, translations = cur.translations
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
