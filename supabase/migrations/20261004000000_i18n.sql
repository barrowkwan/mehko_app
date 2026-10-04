-- Multi-language support.
--  * profiles.locale: the user's chosen UI language, restored on a new device after login.
--  * translations: optional merchant-written translations of customer-facing text, shaped
--      {"es": {"name": "...", "description": "..."}, "zh-CN": {...}}
--    The original text stays in the base columns and is the fallback.

alter table profiles
  add column locale text check (locale in ('en', 'es', 'zh-CN', 'zh-TW'));

alter table merchants
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 16384);

alter table food_items
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 16384);
