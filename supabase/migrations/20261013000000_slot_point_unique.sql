-- A pickup point can be used only once per offering (customers would see two identical options).
-- A trigger instead of a unique index: offerings that already have a repeated point (created before this rule)
-- stay valid and editable; the rule applies when a slot is added or its point is changed.

create function check_slot_point_unique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.pickup_point_id = old.pickup_point_id and new.group_id is not distinct from old.group_id then
    return new;
  end if;
  if exists (
    select 1 from offerings o
    where o.group_id = new.group_id and o.pickup_point_id = new.pickup_point_id and o.id <> new.id
  ) then
    raise exception 'A pickup point can be used only once per offering';
  end if;
  return new;
end;
$$;
create trigger offerings_slot_point_unique before insert or update on offerings
  for each row execute function check_slot_point_unique();
