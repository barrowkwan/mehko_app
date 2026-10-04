# Feature map

Each feature → where it lives → how it's tested. Status: ✅ built, 🔌 hook only, ⛔ not built.

| # | Feature | Status | Routes / UI | Logic | DB objects | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Social login (Google/Facebook/Apple) | ✅ | `app/login/*`, `app/auth/callback`, `app/auth/signout` | `lib/auth.ts`, `proxy.ts`, `lib/supabase/proxy.ts` | `handle_new_user` trigger, `profiles` | DB test (profile trigger); manual for OAuth |
| 2 | Merchant registration | ✅ | `/merchant/setup` | `createMerchant` | `merchants` | — |
| 3 | Multiple pickup points: search a business/address/ZIP (Geoapify), click the map or use my location; edit; coordinates and timezone filled in automatically | ✅ | `/merchant/pickup-points` (+`place-search.tsx`, `map-picker.tsx`), `app/api/places/search`, `lib/places/*`, `lib/timezone.ts` | `addPickupPoint`, `updatePickupPoint`, `setPickupPointActive` | `pickup_points` | RLS cross-merchant test |
| 4 | Foods | ✅ | `/merchant/foods` | `addFood`, `setFoodActive` | `food_items` | — |
| 4e | Merchant codes (m00001), offering numbers (m00001-000001) and order numbers (m00001-000001-000001, counting per offering), shown to customers, merchants, scan and emails | ✅ | `app/orders/*`, `app/merchant/*`, `lib/notifications/templates.ts` | – | `merchants.code`, `orders.order_no`, `merchant_order_counters` | `tests/db/order-numbers.test.ts`, live concurrency test, e2e |
| 4d | Merchant profile: optional logo, website, contact email/phone (shown to customers); US-only country select; multi-line food descriptions; Dashboard as a list | ✅ | `app/merchant/profile/page.tsx`, `app/merchants/[id]/page.tsx`, `app/merchant/foods/page.tsx`, `app/merchant/page.tsx` | `updateMerchantProfile` | `merchants.logo_path/website/contact_*` | `tests/db/merchant-profile.test.ts`, e2e |
| 4c | Merchant **Dashboard** = working view (upcoming offerings that are not closed, orders per slot); **History** (`/merchant/offerings`) = every offering with status filters (All / Draft / Published / Closed) and order counts | ✅ | `app/merchant/page.tsx`, `app/merchant/offerings/page.tsx` | – | – | e2e |
| 4b | Browse = one short card per merchant with something open ("Open offerings: N · Next pickup"); details on `/merchants/[id]`, where the customer picks an offering | ✅ | `app/page.tsx`, `app/merchants/[id]/page.tsx`, `components/offering-group-card.tsx` | – | – | e2e |
| 5c | Review step before publishing a new offering (foods/limits, slots, cutoff in the merchant's time, instructions) | ✅ | `components/offering-review.tsx` | – | – | e2e |
| 5b | Several pickup slots per offering (shared cutoff/foods/limits; customer picks and can move their order) | ✅ | new-offering form, offering pages, `/orders/[id]` | `createOffering`, `addOfferingSlot`, `changeOrderSlot` | `offerings.group_id`, `add_offering_slot`, `change_order_slot`, `offering_pool` | `tests/db/pickup-slots.test.ts`, e2e |
| 5 | Offerings (food, date, pickup, cutoff) — create, **edit, duplicate to a new date, delete** | ✅ | `/merchant/offerings`, `/new` (+`cutoff-input.tsx`), `/[id]` | `createOffering`, `setOfferingStatus` | `offerings`, `offering_items`, `check_offering_schedule` | schedule trigger test |
| 6 | Browse & order | ✅ | `/`, `/offerings/[id]` | `placeOrder`, `OrderForm` | `place_order`, `offering_stock` | ordering tests |
| 7 | Edit/cancel until cutoff | ✅ | `/orders/[id]` | `updateOrder`, `cancelOrder` | `update_order`, `cancel_order` | cutoff tests |
| 8 | Order history (customer) | ✅ | `/orders` | RSC query | RLS on `orders` | RLS tests |
| 9 | QR per order + pickup confirm | ✅ | order page (QR image), `/merchant/scan` | `confirmPickup`, `scanner.tsx` | `orders.qr_token`, `confirm_pickup` | QR tests |
| 10 | Customer history (merchant) | ✅ | `/merchant/customers`, `/[id]` | RSC queries | `profiles_merchant_sees_customers` policy | RLS test |
| 11 | Optional live location (pickup day only; banner while sharing; auto-off on leaving the page / 4 h; customers never see a position older than 2 min; daily wipe of old coordinates) | ✅ | `/merchant/offerings/[id]` (toggle), `/orders/[id]` (map) | `updateLocation`, `LocationToggle`, `LiveMap` | `location_shares`, `can_share_location`, Realtime | DB + live Realtime tests; **map/GPS manual** |
| 12 | Reports (date/location/holiday/weather) | ✅ | `/merchant/reports` | `lib/reports.ts` | `order_lines` view | `lib/__tests__/reports.test.ts` |
| 13 | Weather + holiday data | ✅ | — | `lib/context-fetch.ts`, `app/api/cron/fetch-context` | `offering_context` | `lib/__tests__/context-fetch.test.ts` (mocked HTTP); route manually verified against real APIs |
| 14g | Order notes (allergies/requests) and pickup instructions (translatable) | ✅ web | order form note; offering form instructions; merchant "Customer notes" box; instructions on order/offering pages | `app/orders/actions.ts`, `app/merchant/actions.ts`, `components/{order-form,offering-form,translation-fields}.tsx` | `orders.note`, `offerings.instructions/translations`; optional-parameter versions of the order/offering functions | `tests/db/order-notes.test.ts`, live API test |
| 14f | Food photos (resized, location data stripped) | ✅ web | Foods page (add/edit), photo on browse/order screens | `lib/images.ts`, `components/{image-input,food-photo}.tsx`, `app/merchant/actions.ts` | `food-images` bucket + storage RLS, `food_items.image_path` | `lib/__tests__/images.test.ts`, `tests/db/food-images.test.ts`, live Storage integration test |
| 14 | PWA | ✅ | `app/manifest.ts`, `public/icons/icon.svg` | — | — | manual |
| 14b | Multi-language (en/es/zh-CN/zh-TW), merchant translations | ✅ | header switcher, `/merchant/profile`, foods edit | `lib/locale.ts`, `i18n/request.ts`, `messages/*.json`, `app/actions/locale.ts` | `profiles.locale`, `merchants/food_items.translations` | `lib/__tests__/{locale,messages,format,db-errors}.test.ts`, DB tests |
| 14c | Account deletion (store requirement) | ✅ web · mobile later | `/account` (nav → Account), blocked notice for merchants with active orders | `app/account/actions.ts` (`deleteAccount`, admin API), `lib/supabase/admin.ts` | `account_deletion_blocker()`, cascade FK + `merchants_delete_offerings_first` | `tests/db/account-deletion.test.ts`, live cascade test in `tests/integration/api.test.ts` |
| 14d | Privacy policy & terms (public, 4 languages) | ✅ web | `/privacy`, `/terms`, footer + login line | `content/legal/*`, `lib/legal.ts`, `lib/site.ts`, `lib/public-paths.ts` | — | `lib/__tests__/{legal,legal-content,public-paths}.test.ts` |
| 14e | Uptime endpoint + Sentry error reporting (privacy-scrubbed, off by default) | ✅ web | `/api/health`, `/api/cron/sentry-test`, `app/error.tsx` | `lib/health.ts`, `lib/sentry-*.ts`, `instrumentation*.ts`, `sentry.server.config.ts` | — | `lib/__tests__/{health,sentry-scrub,sentry-options}.test.ts` |
| 15 | Manual payment tracking (cash/Venmo/Zelle) — planned last | 🔌 | — | — | `orders.payment_*` | — |
| 15b | Card payments (optional, much later) | 🔌 | — | — | `orders.payment_status/payment_ref`, `food_items.price_cents` | — |
| 16 | Notifications, native apps, e2e tests | ⛔ | — | — | — | — |

## Implementation breakdown (build order)

Useful as a dependency map: each step only needs the ones above it.

1. **Scaffold** — Next.js app, deps, Vitest.
2. **Schema** — tables, helpers, triggers, order RPCs, RLS, Realtime, `order_lines` view (one migration).
3. **Platform** — Supabase clients, `proxy.ts` auth gate, `lib/auth.ts`, layout/nav, manifest.
4. **Auth UI** — `/login`, callback, sign-out.
5. **Typed DB** — `types/database.ts` (needed for typed embeds).
6. **Customer flow** — browse, offering page, order form + actions, order list/detail (QR).
7. **Merchant management** — setup, pickup points, foods, offerings (+ detail/prep list).
8. **Pickup** — scanner + `confirm_pickup`.
9. **Live location** — toggle, map, policies.
10. **Customer history (merchant)**.
11. **Insights** — `lib/context-fetch.ts` + cron route → `lib/reports.ts` + reports page.
12. **Hardening** — PGlite DB tests, README, these docs.

## Known gaps / ideas

Moved to the backlog: see [roadmap.md](roadmap.md) (e.g. FEAT-1 edit/clone offerings, FEAT-2 food photos, FEAT-5 reports upgrades, NOTIF-1/2 notifications, QA-1 browser e2e, SEC-1 privacy/terms). Add new ideas there.
