-- Customers keep seeing the offering (and its items) of every order they placed, whatever its status.
-- Before: offerings/offering_items were readable only while 'published', so when a merchant closed or
-- un-published an offering after pickup, "My orders" showed a blank card and the order page returned 404.

create function has_order_in(p_offering uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders where offering_id = p_offering and customer_id = auth.uid());
$$;
revoke all on function has_order_in(uuid) from public, anon;
grant execute on function has_order_in(uuid) to authenticated;

drop policy offerings_read on offerings;
create policy offerings_read on offerings for select to authenticated
  using (status = 'published' or is_merchant_owner(merchant_id) or has_order_in(id));

drop policy offering_items_read on offering_items;
create policy offering_items_read on offering_items for select to authenticated using (
  exists (
    select 1 from offerings f
    where f.id = offering_id and (f.status = 'published' or is_merchant_owner(f.merchant_id) or has_order_in(f.id))
  )
);
