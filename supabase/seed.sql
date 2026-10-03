-- Development seed: two merchants (each with two pickup points) and one customer.
-- These auth users can't sign in (no OAuth identity); they exist so the data model can be explored
-- and so tests can impersonate them. Sign in with a real social account to use the app.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dumplings@example.com', '{"full_name":"Mei Chen"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tacos@example.com', '{"full_name":"Luis Ortega"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer@example.com', '{"full_name":"Sam Customer"}', now(), now())
on conflict do nothing;

insert into merchants (id, owner_id, name, description, country_code) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Mei''s Dumplings', 'Handmade dumplings', 'US'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'Luis Tacos', 'Street-style tacos', 'US');

insert into pickup_points (id, merchant_id, name, address, lat, lng, timezone) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Riverside Park', '100 River Rd', 40.8007, -73.9712, 'America/New_York'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Central Station', '1 Station Plaza', 40.7527, -73.9772, 'America/New_York'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Market Square', '5 Market St', 40.7128, -74.0060, 'America/New_York'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Library Steps', '20 Library Ln', 40.7295, -73.9965, 'America/New_York');

insert into food_items (id, merchant_id, name, description) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Pork dumplings', '12 pieces'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Veggie dumplings', '12 pieces'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Al pastor tacos', '3 tacos'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Elote', 'Grilled corn');

insert into offerings (id, merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   current_date + 3, '17:00', '19:00', ((current_date + 2) + time '20:00') at time zone 'America/New_York'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003',
   current_date + 4, '12:00', '14:00', ((current_date + 3) + time '12:00') at time zone 'America/New_York');

insert into offering_items (offering_id, food_item_id, quantity_limit) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 40),
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 20),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', null),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 30);
