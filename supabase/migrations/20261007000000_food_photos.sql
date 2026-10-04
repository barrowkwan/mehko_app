-- FEAT-2: food photos. See docs/plans/feat-2-food-photos.md.

-- The path of the photo inside the bucket (not a full URL: URLs break if the project ever changes).
-- The old image_url column was never used.
alter table food_items rename column image_url to image_path;

-- Public-read bucket for food photos: JPEG only, 1 MiB max (the app resizes first and re-checks on the server).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- A file is writable only inside "<merchant_id>/" and only by that merchant's owner. Exactly one folder level,
-- so paths such as "m/../other/x.jpg" or "x.jpg" are refused. Non-UUID folders are refused (not a cast error).
create function is_food_image_owner(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case
        when array_length(f, 1) = 1
         and f[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then is_merchant_owner(f[1]::uuid)
      end
     from (select storage.foldername(object_name) as f) s),
    false);
$$;

-- Reading goes through the public bucket URL (no policy needed); these let the owner list, replace and remove.
create policy food_images_select on storage.objects for select to authenticated
  using (bucket_id = 'food-images' and is_food_image_owner(name));
create policy food_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'food-images' and is_food_image_owner(name));
create policy food_images_update on storage.objects for update to authenticated
  using (bucket_id = 'food-images' and is_food_image_owner(name))
  with check (bucket_id = 'food-images' and is_food_image_owner(name));
create policy food_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'food-images' and is_food_image_owner(name));
