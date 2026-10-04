-- Hierarchical human-friendly numbers (product owner decision):
--   merchant  m00001                 (merchants.code, already live)
--   offering  m00001-000001          (counts per merchant)
--   order     m00001-000001-000001   (counts per offering, so every offering starts again at 000001)
-- An "offering" here is one offer as the merchant sees it: all pickup slots of a multi-slot offering share ONE offering
-- number, and their orders share one order counter. Existing orders are renumbered (they were m00001-00000001 until now).

-- ───────────────────────── offering numbers ─────────────────────────
alter table offerings add column offering_no text;

with per_offer as (
  -- the slots of a group are one offer; a row without a group is an offer of one slot
  select coalesce(group_id, id) as offer_key, merchant_id, min(created_at) as first_at, min(id::text) as tie
    from offerings group by coalesce(group_id, id), merchant_id
), numbered as (
  select offer_key, merchant_id, row_number() over (partition by merchant_id order by first_at, tie) as n from per_offer
)
update offerings f
   set offering_no = m.code || '-' || format_code('', numbered.n, 6)
  from numbered, merchants m
 where numbered.offer_key = coalesce(f.group_id, f.id) and numbered.merchant_id = f.merchant_id and m.id = f.merchant_id;

create table merchant_offering_counters (
  merchant_id uuid primary key references merchants (id) on delete cascade,
  last_no integer not null default 0
);
alter table merchant_offering_counters enable row level security;
revoke all on merchant_offering_counters from anon, authenticated;
insert into merchant_offering_counters (merchant_id, last_no)
select merchant_id, count(distinct offering_no) from offerings group by merchant_id;

-- The default is only a placeholder so inserts need not mention the column; the trigger below always replaces it.
alter table offerings
  alter column offering_no set default 'pending',
  alter column offering_no set not null,
  add constraint offerings_offering_no_format check (offering_no ~ '^m[0-9]{5,}-[0-9]{6,}$');
create index offerings_offering_no_idx on offerings (offering_no);

-- Whatever number a client supplies is ignored: a slot added to a group copies its siblings' number, anything else gets
-- the merchant's next number (the upsert locks the counter row, so simultaneous inserts never share one).
create function assign_offering_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sibling text;
  n integer;
  c text;
begin
  if new.group_id is not null then
    select offering_no into sibling from offerings where group_id = new.group_id and merchant_id = new.merchant_id limit 1;
    if sibling is not null then
      new.offering_no := sibling;
      return new;
    end if;
  end if;
  insert into merchant_offering_counters (merchant_id, last_no) values (new.merchant_id, 1)
  on conflict (merchant_id) do update set last_no = merchant_offering_counters.last_no + 1
  returning last_no into n;
  select code into c from merchants where id = new.merchant_id;
  new.offering_no := c || '-' || format_code('', n, 6);
  return new;
end;
$$;
create trigger offerings_assign_number before insert on offerings
  for each row execute function assign_offering_number();

create function protect_offering_number() returns trigger
language plpgsql as $$
begin
  if new.offering_no is distinct from old.offering_no then raise exception 'An offering number cannot be changed'; end if;
  return new;
end;
$$;
create trigger offerings_protect_number before update on offerings
  for each row execute function protect_offering_number();

-- ───────────────────────── order numbers per offering ─────────────────────────
create table offering_order_counters (
  offering_no text primary key,
  merchant_id uuid not null references merchants (id) on delete cascade,
  last_no integer not null default 0
);
alter table offering_order_counters enable row level security;
revoke all on offering_order_counters from anon, authenticated;

alter table orders disable trigger orders_protect_number;
with numbered as (
  select o.id, f.offering_no,
         row_number() over (partition by f.offering_no order by o.created_at, o.id) as n
    from orders o join offerings f on f.id = o.offering_id
)
update orders o
   set order_no = numbered.offering_no || '-' || format_code('', numbered.n, 6)
  from numbered
 where numbered.id = o.id;
alter table orders enable trigger orders_protect_number;

insert into offering_order_counters (offering_no, merchant_id, last_no)
select f.offering_no, f.merchant_id, count(*)
  from orders o join offerings f on f.id = o.offering_id
 group by f.offering_no, f.merchant_id;

create or replace function assign_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ono text;
  mid uuid;
  n integer;
begin
  select offering_no, merchant_id into ono, mid from offerings where id = new.offering_id;
  insert into offering_order_counters (offering_no, merchant_id, last_no) values (ono, mid, 1)
  on conflict (offering_no) do update set last_no = offering_order_counters.last_no + 1
  returning last_no into n;
  new.order_no := ono || '-' || format_code('', n, 6);
  return new;
end;
$$;

drop table merchant_order_counters;
