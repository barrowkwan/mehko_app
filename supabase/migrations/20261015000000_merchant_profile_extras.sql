-- Optional merchant profile extras: logo, website, contact email and phone (shown to customers on the merchant's page).
-- The logo is a file in the same public bucket and per-merchant folder as food photos ("<merchant_id>/logo-<random>.jpg"),
-- so the existing storage policies already cover it. Values are validated here so every client gets the same rules.

alter table merchants
  add column logo_path text,
  add column website text,
  add column contact_email text,
  add column contact_phone text,
  add constraint merchants_logo_path_in_own_folder check (logo_path is null or logo_path like id::text || '/%'),
  add constraint merchants_website_format check (website is null or (char_length(website) <= 200 and website ~* '^https?://[^[:space:]]+$')),
  add constraint merchants_contact_email_format check (contact_email is null or (char_length(contact_email) <= 200 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  add constraint merchants_contact_phone_format check (contact_phone is null or contact_phone ~ '^[0-9+()./ -]{5,30}$');
