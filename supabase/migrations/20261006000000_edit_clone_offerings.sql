-- FEAT-1: edit, duplicate and delete offerings — safely.
-- Rules live in the database so every client (web now, mobile later) gets them. See docs/plans/feat-1-edit-clone-offerings.md.

-- ───────────────────────── protect edits ─────────────────────────
-- security definer: the checks must see all orders regardless of who is editing.
create function protect_offering_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text;
begin
  select timezone into tz from pickup_points where id = old.pickup_point_id;

  -- Past offerings keep their schedule (status can still change, e.g. to closed).
  if old.pickup_date < (now() at time zone tz)::date
     and (new.pickup_point_id, new.pickup_date, new.pickup_start, new.pickup_end, new.cutoff_at)
         is distinct from (old.pickup_point_id, old.pickup_date, old.pickup_start, old.pickup_end, old.cutoff_at) then
    raise exception 'Past offerings cannot be edited';
  end if;

  -- With active orders, customers rely on where and when: it cannot move.
  if (new.pickup_point_id is distinct from old.pickup_point_id or new.pickup_date is distinct from old.pickup_date)
     and exists (select 1 from orders where offering_id = old.id and status <> 'cancelled') then
    raise exception 'Cannot move an offering that has orders';
  end if;
  return new;
end;
$$;
create trigger offerings_protect_changes before update on offerings
  for each row execute function protect_offering_changes();

-- Deleting an offering cascades to its orders (needed for account deletion, which clears orders first).
-- Without this guard an owner could wipe other customers' orders through the API.
create function protect_offering_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from orders where offering_id = old.id and status in ('placed', 'picked_up')) then
    raise exception 'Offering has orders';
  end if;
  return old;
end;
$$;
create trigger offerings_protect_delete before delete on offerings
  for each row execute function protect_offering_delete();

-- ───────────────────────── protect item edits ─────────────────────────
create function protect_offering_item_changes() returns trigger
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
    -- only cancelled orders reference it: drop those lines so the foreign key doesn't block removal
    delete from order_items where offering_item_id = old.id;
    return old;
  end if;

  -- UPDATE
  if new.food_item_id is distinct from old.food_item_id or new.offering_id is distinct from old.offering_id then
    raise exception 'An item''s food and offering cannot be changed; remove it and add another';
  end if;
  if new.quantity_limit is not null then
    select coalesce(sum(oi.qty), 0) into ordered
    from order_items oi join orders o on o.id = oi.order_id
    where oi.offering_item_id = old.id and o.status <> 'cancelled';
    if new.quantity_limit < ordered then
      raise exception 'Limit is below the quantity already ordered (%)', ordered;
    end if;
  end if;
  return new;
end;
$$;
create trigger offering_items_protect_changes before update or delete on offering_items
  for each row execute function protect_offering_item_changes();

-- ───────────────────────── update_offering (atomic) ─────────────────────────
-- p_items: [{"food_item_id": "<uuid>", "quantity_limit": <int|null>}]. Runs with the caller's rights
-- (RLS) and all-or-nothing, so a rejected change leaves the offering exactly as it was.
create function update_offering(
  p_offering uuid, p_pickup_point uuid, p_date date, p_start time, p_end time, p_cutoff timestamptz, p_items jsonb
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
         pickup_end = p_end, cutoff_at = p_cutoff
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

-- ───────────────────────── duplicate_offering ─────────────────────────
-- A draft copy on a new date: same pickup point, times and items (archived foods skipped). The cutoff keeps
-- the same wall-clock lead before pickup in the pickup point's timezone, so it stays right across DST changes.
create function duplicate_offering(p_offering uuid, p_new_date date) returns uuid
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
  insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, status)
  values (o.merchant_id, o.pickup_point_id, p_new_date, o.pickup_start, o.pickup_end,
          ((p_new_date + o.pickup_start) - lead) at time zone tz, 'draft')
  returning id into new_id;

  insert into offering_items (offering_id, food_item_id, quantity_limit)
  select new_id, oi.food_item_id, oi.quantity_limit
  from offering_items oi join food_items f on f.id = oi.food_item_id
  where oi.offering_id = p_offering and f.active;

  return new_id;
end;
$$;

revoke all on function update_offering(uuid, uuid, date, time, time, timestamptz, jsonb), duplicate_offering(uuid, date)
  from public, anon;
grant execute on function update_offering(uuid, uuid, date, time, time, timestamptz, jsonb), duplicate_offering(uuid, date)
  to authenticated;
