-- Food merchant app: initial schema
-- Orders are written only through the place_order / update_order / cancel_order RPCs,
-- which enforce the ordering cutoff. Payments are not implemented yet; orders carry
-- payment_status / payment_ref placeholders so they can be added later.

-- ───────────────────────── tables ─────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  country_code char(2) not null default 'US', -- used for the public-holiday lookup
  created_at timestamptz not null default now()
);
create index on merchants (owner_id);

create table pickup_points (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  timezone text not null default 'UTC',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on pickup_points (merchant_id);

create table food_items (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  price_cents integer check (price_cents >= 0), -- unused until payments are added
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on food_items (merchant_id);

create table offerings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  pickup_point_id uuid not null references pickup_points (id),
  pickup_date date not null,
  pickup_start time not null,
  pickup_end time not null,
  cutoff_at timestamptz not null,
  status text not null default 'published' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  check (pickup_end > pickup_start)
);
create index on offerings (merchant_id, pickup_date);
create index on offerings (pickup_point_id);

create table offering_items (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references offerings (id) on delete cascade,
  food_item_id uuid not null references food_items (id),
  quantity_limit integer check (quantity_limit > 0),
  unique (offering_id, food_item_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id) on delete cascade,
  offering_id uuid not null references offerings (id),
  status text not null default 'placed' check (status in ('placed', 'cancelled', 'picked_up')),
  -- 64 hex chars from two v4 UUIDs (gen_random_uuid is core Postgres and cryptographically random).
  -- Deliberately not pgcrypto's gen_random_bytes: on hosted Supabase that lives in the `extensions`
  -- schema, which is not on the search_path when migrations are pushed.
  qr_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  picked_up_at timestamptz,
  payment_status text not null default 'none', -- future: pending | paid | refunded
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (offering_id);
-- One active order per customer per offering; a cancelled order doesn't block re-ordering.
create unique index orders_one_active_per_offering on orders (customer_id, offering_id) where status <> 'cancelled';

create table order_items (
  order_id uuid not null references orders (id) on delete cascade,
  offering_item_id uuid not null references offering_items (id),
  qty integer not null check (qty > 0),
  primary key (order_id, offering_item_id)
);

-- One live-location row per offering, upserted by the merchant on pickup day.
create table location_shares (
  offering_id uuid primary key references offerings (id) on delete cascade,
  lat double precision,
  lng double precision,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Weather / holiday snapshot per offering, filled by the fetch-context edge function.
create table offering_context (
  offering_id uuid primary key references offerings (id) on delete cascade,
  weather_bucket text check (weather_bucket in ('clear', 'cloudy', 'rain', 'snow', 'hot', 'cold')),
  weather_summary text,
  temp_max_c numeric,
  precip_mm numeric,
  is_holiday boolean not null default false,
  holiday_name text,
  fetched_at timestamptz not null default now()
);

-- ───────────────────────── helpers ─────────────────────────

create function is_merchant_owner(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from merchants where id = m and owner_id = auth.uid());
$$;

create function offering_merchant(o uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select merchant_id from offerings where id = o;
$$;

-- True if the caller has a non-cancelled order on this offering.
create function has_order_on(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders where offering_id = o and customer_id = auth.uid() and status <> 'cancelled'
  );
$$;

-- True on the pickup date (in the pickup point's timezone) for the caller's own offering.
create function can_share_location(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from offerings f
    join pickup_points p on p.id = f.pickup_point_id
    join merchants m on m.id = f.merchant_id
    where f.id = o
      and m.owner_id = auth.uid()
      and (now() at time zone p.timezone)::date = f.pickup_date
  );
$$;

-- Auto-create a profile on first social login.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Cutoff must be at or before the pickup start, evaluated in the pickup point's timezone.
create function check_offering_schedule() returns trigger
language plpgsql set search_path = public as $$
declare
  tz text;
begin
  select timezone into tz from pickup_points where id = new.pickup_point_id;
  if new.cutoff_at > ((new.pickup_date + new.pickup_start) at time zone tz) then
    raise exception 'Cutoff must be before the pickup start time';
  end if;
  return new;
end;
$$;
create trigger offerings_check_schedule before insert or update on offerings
  for each row execute function check_offering_schedule();

-- ───────────────────────── order RPCs ─────────────────────────
-- p_items: jsonb array of {"offering_item_id": "<uuid>", "qty": <int>}

create function _write_order_items(p_order uuid, p_offering uuid, p_items jsonb) returns void
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
      where oi.offering_item_id = it.offering_item_id and o.status <> 'cancelled' and o.id <> p_order;
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

create function place_order(p_offering uuid, p_items jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  off offerings;
  oid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into off from offerings where id = p_offering for share;
  if not found or off.status <> 'published' then raise exception 'Offering is not available'; end if;
  if now() >= off.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;

  insert into orders (customer_id, offering_id) values (auth.uid(), p_offering)
  returning id into oid;
  perform _write_order_items(oid, p_offering, p_items);
  return oid;
exception when unique_violation then
  raise exception 'You already have an order for this offering; edit it instead';
end;
$$;

create function update_order(p_order uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  off offerings;
begin
  select * into o from orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  select * into off from offerings where id = o.offering_id;
  if o.status <> 'placed' then raise exception 'Order can no longer be changed'; end if;
  if now() >= off.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;

  perform _write_order_items(p_order, o.offering_id, p_items);
  update orders set updated_at = now() where id = p_order;
end;
$$;

create function cancel_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  off offerings;
begin
  select * into o from orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  select * into off from offerings where id = o.offering_id;
  if o.status <> 'placed' then raise exception 'Order can no longer be changed'; end if;
  if now() >= off.cutoff_at then raise exception 'Ordering cutoff has passed'; end if;
  update orders set status = 'cancelled', updated_at = now() where id = p_order;
end;
$$;

-- Remaining stock per limited item (customers can't read other customers' orders directly).
create function offering_stock(p_offering uuid)
returns table (offering_item_id uuid, remaining integer)
language sql stable security definer set search_path = public as $$
  select oit.id,
         oit.quantity_limit - coalesce((
           select sum(oi.qty)::int from order_items oi join orders o on o.id = oi.order_id
           where oi.offering_item_id = oit.id and o.status <> 'cancelled'
         ), 0)
  from offering_items oit
  join offerings f on f.id = oit.offering_id
  where oit.offering_id = p_offering and oit.quantity_limit is not null and f.status = 'published';
$$;
revoke all on function offering_stock(uuid) from public, anon;
grant execute on function offering_stock(uuid) to authenticated;

-- Merchant scans a customer's QR code. Idempotent: returns already_picked_up = true on repeat scans.
create function confirm_pickup(p_token text)
returns table (order_id uuid, customer_name text, already_picked_up boolean)
language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  select * into o from orders where qr_token = p_token for update;
  if not found then raise exception 'Unknown QR code'; end if;
  if not is_merchant_owner(offering_merchant(o.offering_id)) then
    raise exception 'This order belongs to a different merchant';
  end if;
  if o.status = 'cancelled' then raise exception 'This order was cancelled'; end if;

  order_id := o.id;
  select display_name into customer_name from profiles where id = o.customer_id;
  already_picked_up := o.status = 'picked_up';
  if not already_picked_up then
    update orders set status = 'picked_up', picked_up_at = now(), updated_at = now() where id = o.id;
  end if;
  return next;
end;
$$;

revoke all on function _write_order_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function place_order(uuid, jsonb), update_order(uuid, jsonb), cancel_order(uuid),
  confirm_pickup(text) from public, anon;
grant execute on function place_order(uuid, jsonb), update_order(uuid, jsonb), cancel_order(uuid),
  confirm_pickup(text) to authenticated;

-- ───────────────────────── row level security ─────────────────────────

alter table profiles enable row level security;
alter table merchants enable row level security;
alter table pickup_points enable row level security;
alter table food_items enable row level security;
alter table offerings enable row level security;
alter table offering_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table location_shares enable row level security;
alter table offering_context enable row level security;

-- profiles: own row, plus customers who ordered from the caller's merchant
create policy profiles_self on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_merchant_sees_customers on profiles for select using (
  exists (
    select 1 from orders o
    join offerings f on f.id = o.offering_id
    where o.customer_id = profiles.id and is_merchant_owner(f.merchant_id)
  )
);

-- merchants: browseable by any signed-in user; owner manages
create policy merchants_read on merchants for select to authenticated using (true);
create policy merchants_insert on merchants for insert to authenticated with check (owner_id = auth.uid());
create policy merchants_update on merchants for update using (owner_id = auth.uid());
create policy merchants_delete on merchants for delete using (owner_id = auth.uid());

-- pickup points / food items: readable by all signed-in users; owner manages
create policy pickup_points_read on pickup_points for select to authenticated using (true);
create policy pickup_points_write on pickup_points for all
  using (is_merchant_owner(merchant_id)) with check (is_merchant_owner(merchant_id));

create policy food_items_read on food_items for select to authenticated using (true);
create policy food_items_write on food_items for all
  using (is_merchant_owner(merchant_id)) with check (is_merchant_owner(merchant_id));

-- offerings: customers see published ones; owner sees and manages all of theirs
create policy offerings_read on offerings for select to authenticated
  using (status = 'published' or is_merchant_owner(merchant_id));
create policy offerings_write on offerings for all
  using (is_merchant_owner(merchant_id))
  with check (
    is_merchant_owner(merchant_id)
    and exists (select 1 from pickup_points p where p.id = pickup_point_id and p.merchant_id = offerings.merchant_id)
  );

create policy offering_items_read on offering_items for select to authenticated using (
  exists (select 1 from offerings f where f.id = offering_id and (f.status = 'published' or is_merchant_owner(f.merchant_id)))
);
create policy offering_items_write on offering_items for all
  using (is_merchant_owner(offering_merchant(offering_id)))
  with check (
    is_merchant_owner(offering_merchant(offering_id))
    and exists (
      select 1 from food_items fi
      where fi.id = food_item_id and fi.merchant_id = offering_merchant(offering_items.offering_id)
    )
  );

-- orders: customers read their own; merchants read orders on their offerings. No direct writes.
create policy orders_customer_read on orders for select using (customer_id = auth.uid());
create policy orders_merchant_read on orders for select using (is_merchant_owner(offering_merchant(offering_id)));

create policy order_items_read on order_items for select using (
  exists (
    select 1 from orders o
    where o.id = order_id and (o.customer_id = auth.uid() or is_merchant_owner(offering_merchant(o.offering_id)))
  )
);

-- location: merchant writes only on pickup day; customers with an order may read
create policy location_read_merchant on location_shares for select
  using (is_merchant_owner(offering_merchant(offering_id)));
create policy location_read_customer on location_shares for select
  using (active and has_order_on(offering_id));
create policy location_insert on location_shares for insert with check (can_share_location(offering_id));
create policy location_update on location_shares for update
  using (is_merchant_owner(offering_merchant(offering_id)))
  with check (can_share_location(offering_id) or active = false);

-- context snapshot: readable; written by the service role only
create policy offering_context_read on offering_context for select to authenticated using (true);

-- realtime for live location
alter publication supabase_realtime add table location_shares;

-- ───────────────────────── reporting views ─────────────────────────
-- security_invoker => the caller's RLS applies, so merchants only ever see their own sales.

create view order_lines with (security_invoker = true) as
select
  f.merchant_id,
  f.id as offering_id,
  f.pickup_date,
  f.pickup_point_id,
  p.name as pickup_point_name,
  fi.id as food_item_id,
  fi.name as food_name,
  oi.qty,
  o.customer_id,
  coalesce(c.is_holiday, false) as is_holiday,
  c.holiday_name,
  c.weather_bucket,
  c.temp_max_c
from order_items oi
join orders o on o.id = oi.order_id and o.status <> 'cancelled'
join offering_items oit on oit.id = oi.offering_item_id
join food_items fi on fi.id = oit.food_item_id
join offerings f on f.id = o.offering_id
join pickup_points p on p.id = f.pickup_point_id
left join offering_context c on c.offering_id = f.id;
