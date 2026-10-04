-- FEAT-3: order notes (customer → merchant) and pickup instructions (merchant → customers).
-- See docs/plans/feat-3-order-notes-instructions.md.
--
-- Function parameters added here are optional (defaults), so older clients — including the web version that is
-- still running while a deploy is in progress — keep working. For notes/instructions, null means "leave unchanged"
-- and an empty/blank string means "clear".

-- ───────────────────────── columns ─────────────────────────
alter table orders
  add column note text check (note is null or char_length(note) between 1 and 300);

alter table offerings
  add column instructions text check (instructions is null or char_length(instructions) between 1 and 500),
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 16384);

-- ───────────────────────── place_order / update_order ─────────────────────────
drop function place_order(uuid, jsonb);
create function place_order(p_offering uuid, p_items jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  off offerings;
  oid uuid;
  n text := nullif(btrim(p_note), '');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(n) > 300 then raise exception 'Note is too long'; end if;
  select * into off from offerings where id = p_offering for share;
  if not found or off.status <> 'published' then raise exception 'Offering is not available'; end if;
  if now() >= off.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;

  insert into orders (customer_id, offering_id, note) values (auth.uid(), p_offering, n)
  returning id into oid;
  perform _write_order_items(oid, p_offering, p_items);
  return oid;
exception when unique_violation then
  raise exception 'You already have an order for this offering; edit it instead';
end;
$$;

drop function update_order(uuid, jsonb);
create function update_order(p_order uuid, p_items jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  off offerings;
begin
  if char_length(btrim(p_note)) > 300 then raise exception 'Note is too long'; end if;
  select * into o from orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  select * into off from offerings where id = o.offering_id;
  if o.status <> 'placed' then raise exception 'Order can no longer be changed'; end if;
  if now() >= off.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;

  perform _write_order_items(p_order, o.offering_id, p_items);
  update orders
     set updated_at = now(),
         note = case when p_note is null then note else nullif(btrim(p_note), '') end
   where id = p_order;
end;
$$;

-- ───────────────────────── update_offering / duplicate_offering ─────────────────────────
drop function update_offering(uuid, uuid, date, time, time, timestamptz, jsonb);
create function update_offering(
  p_offering uuid, p_pickup_point uuid, p_date date, p_start time, p_end time, p_cutoff timestamptz, p_items jsonb,
  p_instructions text default null, p_translations jsonb default null
) returns void
language plpgsql set search_path = public as $$
declare
  o offerings;
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

  insert into offering_items (offering_id, food_item_id, quantity_limit)
  select new_id, oi.food_item_id, oi.quantity_limit
  from offering_items oi join food_items f on f.id = oi.food_item_id
  where oi.offering_id = p_offering and f.active;

  return new_id;
end;
$$;

-- ───────────────────────── grants (dropped functions lose theirs) ─────────────────────────
revoke all on function place_order(uuid, jsonb, text), update_order(uuid, jsonb, text),
  update_offering(uuid, uuid, date, time, time, timestamptz, jsonb, text, jsonb) from public, anon;
grant execute on function place_order(uuid, jsonb, text), update_order(uuid, jsonb, text),
  update_offering(uuid, uuid, date, time, time, timestamptz, jsonb, text, jsonb) to authenticated;
