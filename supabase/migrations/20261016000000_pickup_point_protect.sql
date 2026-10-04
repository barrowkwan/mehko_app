-- FEAT-10b: merchants can now edit a pickup point's place. Customers with upcoming orders rely on where it is, so the
-- address and map position cannot change while an upcoming offering at the point has active orders. The name and the
-- timezone stay editable (the timezone fix for points created before it came from the browser keeps working), and
-- points with only past orders (or none) can be edited freely.

create function protect_pickup_point_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.lat, new.lng, new.address) is not distinct from (old.lat, old.lng, old.address) then
    return new;
  end if;
  if exists (
    select 1
    from orders o
    join offerings f on f.id = o.offering_id
    where f.pickup_point_id = old.id
      and o.status <> 'cancelled'
      and f.pickup_date >= (now() at time zone old.timezone)::date
  ) then
    raise exception 'Pickup point has upcoming orders';
  end if;
  return new;
end;
$$;
create trigger pickup_points_protect_location before update on pickup_points
  for each row execute function protect_pickup_point_location();
