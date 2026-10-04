-- Merchant live location: privacy hardening.
--  * Customers only see a position that is FRESH (written in the last 2 minutes). If the merchant closes the tab, locks
--    the phone or loses signal without pressing Stop, the last position stops being visible by itself.
--  * clear_stale_locations() wipes stored coordinates that are old (run daily by the scheduled job), so a last known
--    position does not sit in the database for ever.

drop policy location_read_customer on location_shares;
create policy location_read_customer on location_shares for select
  using (active and updated_at > now() - interval '2 minutes' and has_order_on(offering_id));

create function clear_stale_locations() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update location_shares
     set active = false, lat = null, lng = null
   where (lat is not null or lng is not null or active)
     and updated_at < now() - interval '12 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function clear_stale_locations() from public, anon, authenticated;
grant execute on function clear_stale_locations() to service_role;
