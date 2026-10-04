-- Account deletion (App Store 5.1.1(v) / Google Play require in-app deletion).
--
-- Deleting an auth user cascades: profiles → orders (as customer) and merchants → pickup points,
-- foods, offerings (+ their items, live location, weather snapshot). One link did not cascade:
-- orders.offering_id. Without it a merchant with ANY past order from another customer could never
-- be deleted. Policy: a merchant may delete their account unless an upcoming order is still active
-- (see account_deletion_blocker); then their offerings and the orders on them are removed.
-- Other customers keep their own accounts; they lose that merchant's order history.

alter table orders
  drop constraint orders_offering_id_fkey,
  add constraint orders_offering_id_fkey
    foreign key (offering_id) references offerings (id) on delete cascade;

-- Postgres cascades a merchant's delete to pickup points, foods and offerings in no guaranteed order.
-- Foods/pickup points can be removed while offerings still reference them, which the foreign keys
-- (deliberately strict elsewhere) reject; the same happens one level down (offering items vs the orders
-- that reference them). So delete in dependency order: orders (→ order items), then offerings
-- (→ offering items, live location, weather snapshot); the rest of the cascade then has nothing left
-- referencing it.
-- security definer: the cascade may run as the auth service role, which has no rights on public tables.
create function delete_merchant_offerings_first() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from orders where offering_id in (select id from offerings where merchant_id = old.id);
  delete from offerings where merchant_id = old.id;
  return old;
end;
$$;
revoke all on function delete_merchant_offerings_first() from public, anon, authenticated;

create trigger merchants_delete_offerings_first before delete on merchants
  for each row execute function delete_merchant_offerings_first();

-- Returns why the CURRENT user cannot delete their account right now, or null if they can.
--   'merchant_active_orders': one of their offerings has a still-active ('placed') order whose pickup
--   date is today or later (yesterday is included so every timezone is covered).
-- Runs with the caller's rights (RLS): a merchant sees the orders on their own offerings.
create function account_deletion_blocker() returns text
language sql stable set search_path = public as $$
  select case
    when exists (
      select 1
      from orders o
      join offerings f on f.id = o.offering_id
      join merchants m on m.id = f.merchant_id
      where m.owner_id = auth.uid()
        and o.status = 'placed'
        and f.pickup_date >= current_date - 1
    ) then 'merchant_active_orders'
  end;
$$;

revoke all on function account_deletion_blocker() from public, anon;
grant execute on function account_deletion_blocker() to authenticated;
