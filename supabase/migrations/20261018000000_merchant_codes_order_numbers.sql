-- Human-friendly identifiers: every merchant gets a code (m00001, m00002, …) and every order a number made of the
-- merchant's code plus a counter that runs per merchant (m00001-00000001, m00001-00000002, …).
-- Existing merchants/orders are numbered by creation time. Codes and numbers are never reused or edited.

create function format_code(prefix text, n bigint, width int) returns text
language sql immutable as $$
  select prefix || case when length(n::text) >= width then n::text else lpad(n::text, width, '0') end;
$$;

-- ───────────────────────── merchant codes ─────────────────────────
create sequence merchant_code_seq;
create function next_merchant_code() returns text
language sql volatile as $$ select format_code('m', nextval('merchant_code_seq'), 5); $$;

alter table merchants add column code text;
update merchants m
   set code = format_code('m', r.rn, 5)
  from (select id, row_number() over (order by created_at, id) as rn from merchants) r
 where r.id = m.id;
select setval('merchant_code_seq', greatest((select count(*) from merchants), 1), (select count(*) from merchants) > 0);
alter table merchants
  alter column code set default next_merchant_code(),
  alter column code set not null,
  add constraint merchants_code_unique unique (code),
  add constraint merchants_code_format check (code ~ '^m[0-9]{5,}$');

-- A code is an identity: nobody (not even the owner through the API) changes it.
create function protect_merchant_code() returns trigger
language plpgsql as $$
begin
  if new.code is distinct from old.code then raise exception 'A merchant code cannot be changed'; end if;
  return new;
end;
$$;
create trigger merchants_protect_code before update on merchants
  for each row execute function protect_merchant_code();

-- ───────────────────────── order numbers ─────────────────────────
-- The counter lives in its own table that no signed-in user can read or write; the upsert in the trigger locks the
-- merchant's row, so two simultaneous orders cannot get the same number.
create table merchant_order_counters (
  merchant_id uuid primary key references merchants (id) on delete cascade,
  last_no integer not null default 0
);
alter table merchant_order_counters enable row level security;
revoke all on merchant_order_counters from anon, authenticated;

alter table orders add column order_no text;
with numbered as (
  select o.id,
         m.code,
         row_number() over (partition by f.merchant_id order by o.created_at, o.id) as n
    from orders o
    join offerings f on f.id = o.offering_id
    join merchants m on m.id = f.merchant_id
)
update orders o
   set order_no = numbered.code || '-' || format_code('', numbered.n, 8)
  from numbered
 where numbered.id = o.id;

insert into merchant_order_counters (merchant_id, last_no)
select f.merchant_id, count(*)
  from orders o join offerings f on f.id = o.offering_id
 group by f.merchant_id;

-- The default is only a placeholder so inserts need not mention the column; the trigger below always replaces it.
alter table orders
  alter column order_no set default 'pending',
  alter column order_no set not null,
  add constraint orders_order_no_unique unique (order_no);

create function assign_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  n integer;
  c text;
begin
  select merchant_id into mid from offerings where id = new.offering_id;
  insert into merchant_order_counters (merchant_id, last_no) values (mid, 1)
  on conflict (merchant_id) do update set last_no = merchant_order_counters.last_no + 1
  returning last_no into n;
  select code into c from merchants where id = mid;
  new.order_no := c || '-' || format_code('', n, 8);
  return new;
end;
$$;
create trigger orders_assign_number before insert on orders
  for each row execute function assign_order_number();

-- An order number is permanent too (placing orders goes through functions that never touch it, but be explicit).
create function protect_order_number() returns trigger
language plpgsql as $$
begin
  if new.order_no is distinct from old.order_no then raise exception 'An order number cannot be changed'; end if;
  return new;
end;
$$;
create trigger orders_protect_number before update on orders
  for each row execute function protect_order_number();

-- ───────────────────────── scan result shows the order number ─────────────────────────
drop function confirm_pickup(text);
create function confirm_pickup(p_token text)
returns table (order_id uuid, customer_name text, already_picked_up boolean, order_no text)
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
  order_no := o.order_no;
  select display_name into customer_name from profiles where id = o.customer_id;
  already_picked_up := o.status = 'picked_up';
  if not already_picked_up then
    update orders set status = 'picked_up', picked_up_at = now(), updated_at = now() where id = o.id;
  end if;
  return next;
end;
$$;
revoke all on function confirm_pickup(text) from public, anon;
grant execute on function confirm_pickup(text) to authenticated;
