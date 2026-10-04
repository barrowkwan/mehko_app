-- FEAT-14: share an offering publicly (Facebook, WhatsApp, …). A public page needs data for people who are not signed in,
-- so it is strictly opt-in per offering and goes through ONE function that returns a small whitelist of fields.
--   share_public   the merchant allowed a public page for this offering (default off)
--   share_address  also show the exact street address publicly (default off; pickup points can be a home)
-- Both flags apply to all pickup slots of an offering (they share an offering number).

alter table offerings
  add column share_public boolean not null default false,
  add column share_address boolean not null default false,
  add constraint offerings_share_address_needs_public check (share_public or not share_address);

-- Runs with the caller's rights (RLS): only the owner can change it, all-or-nothing.
create function set_offering_sharing(p_offering uuid, p_public boolean, p_address boolean) returns void
language plpgsql set search_path = public as $$
declare
  o offerings;
begin
  select * into o from offerings where id = p_offering;
  if not found or not is_merchant_owner(o.merchant_id) then raise exception 'Offering not found'; end if;
  update offerings
     set share_public = p_public, share_address = (p_public and coalesce(p_address, false))
   where merchant_id = o.merchant_id and offering_no = o.offering_no;
end;
$$;
revoke all on function set_offering_sharing(uuid, boolean, boolean) from public, anon;
grant execute on function set_offering_sharing(uuid, boolean, boolean) to authenticated;

-- A slot added later inherits the sharing choice.
create or replace function add_offering_slot(p_offering uuid, p_pickup_point uuid, p_date date, p_start time, p_end time)
returns uuid
language plpgsql set search_path = public as $$
declare
  o offerings;
  tz text;
  gid uuid;
  new_id uuid;
begin
  select * into o from offerings where id = p_offering;
  if not found or not is_merchant_owner(o.merchant_id) then raise exception 'Offering not found'; end if;
  select timezone into tz from pickup_points where id = p_pickup_point and merchant_id = o.merchant_id;
  if not found then raise exception 'Pickup point not found'; end if;
  if p_date <> o.pickup_date then raise exception 'All pickup slots must be on the same date'; end if;
  if p_date < (now() at time zone tz)::date then raise exception 'The new date is in the past'; end if;

  gid := coalesce(o.group_id, gen_random_uuid());
  if o.group_id is null then update offerings set group_id = gid where id = o.id; end if;

  insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, status, instructions, translations, group_id, share_public, share_address)
  values (o.merchant_id, p_pickup_point, p_date, p_start, p_end, o.cutoff_at, o.status, o.instructions, o.translations, gid, o.share_public, o.share_address)
  returning id into new_id;

  insert into offering_items (offering_id, food_item_id, quantity_limit)
  select new_id, oi.food_item_id, oi.quantity_limit from offering_items oi where oi.offering_id = o.id;

  return new_id;
end;
$$;

-- The ONLY way anonymous visitors read offering data. Returns null (never an error) when the offering is unknown, not
-- shared or still a draft, so "does not exist" and "not shared" look the same. Deliberately excludes coordinates,
-- customers, orders, stock, instructions and contact details other than the merchant's public website.
create function get_shared_offering(p_offering_no text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  first_slot offerings;
  result jsonb;
begin
  select * into first_slot from offerings
   where offering_no = p_offering_no and share_public and status <> 'draft'
   order by pickup_date, pickup_start limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'offering_no', first_slot.offering_no,
    'cutoff_at', first_slot.cutoff_at,
    'open', exists (
      select 1 from offerings f
       where f.offering_no = p_offering_no and f.merchant_id = first_slot.merchant_id and f.share_public
         and f.status = 'published' and f.cutoff_at > now()
    ),
    'merchant', (
      select jsonb_build_object('name', m.name, 'description', m.description, 'translations', m.translations,
                                'logo_path', m.logo_path, 'website', m.website)
        from merchants m where m.id = first_slot.merchant_id
    ),
    'slots', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', f.id, 'pickup_date', f.pickup_date, 'pickup_start', f.pickup_start, 'pickup_end', f.pickup_end,
               'timezone', p.timezone, 'place', p.name,
               'address', case when f.share_address then p.address end,
               'open', (f.status = 'published' and f.cutoff_at > now())
             ) order by f.pickup_date, f.pickup_start), '[]'::jsonb)
        from offerings f join pickup_points p on p.id = f.pickup_point_id
       where f.offering_no = p_offering_no and f.merchant_id = first_slot.merchant_id and f.share_public and f.status <> 'draft'
    ),
    'foods', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', fi.name, 'description', fi.description, 'translations', fi.translations,
               'image_path', fi.image_path, 'limit', oi.quantity_limit
             ) order by fi.name), '[]'::jsonb)
        from offering_items oi join food_items fi on fi.id = oi.food_item_id
       where oi.offering_id = first_slot.id
    )
  ) into result;
  return result;
end;
$$;
revoke all on function get_shared_offering(text) from public;
grant execute on function get_shared_offering(text) to anon, authenticated;
