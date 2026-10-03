# Enhancement & bug-fix recipes

Always finish with: `npm test && npm run typecheck && npm run lint && npm run build`.

## Bug-fix workflow

1. Locate the code via [features.md](features.md).
2. **Reproduce in a test first** — DB rules in `tests/db/schema.test.ts` (use `createDb`, `asUser`, `IDS`, `itemId` from `tests/db/harness.ts`), pure logic in `lib/__tests__/`.
3. Fix at the lowest layer that owns the rule (SQL > action > UI).
4. If the fix changes the schema, add a **new migration** (don't edit an applied one; the initial migration was only edited because nothing had been deployed).
5. Add a line to [decisions.md](decisions.md) if the bug was subtle.

## Schema change

1. New file `supabase/migrations/<timestamp>_<name>.sql`; enable RLS + policies for new tables.
2. `supabase db reset` (applies migrations + seed), then `supabase gen types typescript --local > types/database.ts`. View columns are generated nullable — map them where read (see `app/merchant/reports/page.tsx`).
3. Update [data-model.md](data-model.md); extend `supabase/seed.sql` if useful.
4. Add DB tests; `tests/db/harness.ts` applies every migration in filename order automatically. For anything touching Auth/Realtime/PostgREST also extend `tests/integration/api.test.ts` and run it against `supabase start`.

## Add payments

Hooks exist: `orders.payment_status` (`none`), `orders.payment_ref`, `food_items.price_cents`.
1. Migration: make `price_cents` required for sellable items (or add `price` on `offering_items`), add `total_cents` snapshot on `orders`, allowed `payment_status` values (`pending|paid|refunded|none`).
2. `place_order` computes the total in SQL and sets `payment_status = 'pending'`; `update_order` must recompute (and handle refund/top-up after payment).
3. Payment provider webhook as a route handler (`app/api/webhooks/<provider>/route.ts`) using the admin client to set `paid`; verify signatures; keep it idempotent.
4. Gate `confirm_pickup` on `paid` (or allow pay-at-pickup via a flag).
5. UI: price display in `OrderForm`, checkout step in `placeOrder`, receipts in `/orders/[id]`.
6. Decide cancel-after-pay refund policy before cutoff only (matches existing cutoff rule).

## Add a report dimension (e.g. weekday, merchant-defined tags)

1. If new data is needed, add a column to `offering_context` (or a view column in `order_lines` — re-create the view in a new migration) and fill it in `app/api/cron/fetch-context/route.ts`.
2. Add to `Dimension`, `DIMENSIONS`, `groupKey` in `lib/reports.ts`; add the field to `OrderLine` and to the `.select(...)` in `app/merchant/reports/page.tsx`.
3. Extend `lib/__tests__/reports.test.ts`.

## Add an OAuth provider

See [social-login-setup.md](social-login-setup.md) for provider-specific steps. In code: `supabase/config.toml` (`[auth.external.<provider>]` + env vars), add to `ALL_PROVIDERS` in `app/login/login-buttons.tsx` (id must be a Supabase provider name), include it in `NEXT_PUBLIC_AUTH_PROVIDERS`, document credentials.

## Change weather buckets / thresholds

`lib/context-fetch.ts` (`HOT_C`, `COLD_C`, `weatherBucket`) + update `lib/__tests__/context-fetch.test.ts` and the `check` constraint on `offering_context.weather_bucket` if you add a bucket name (new migration). Existing rows keep old buckets until the cron re-fetches (only rolling window refreshes; backfill by deleting rows).

## Let merchants edit offerings

Add an `updateOffering` action + `/merchant/offerings/[id]/edit` page. Rules to preserve: schedule trigger already validates cutoff on update; changing items after orders exist must not orphan `order_items` (FK to `offering_items` has no cascade) — either block removal of ordered items or add a migration defining the behavior. Add DB tests.

## Image upload for foods

Use Supabase Storage bucket `food-images` with a policy limiting writes to the merchant's own folder (`<merchant_id>/…`); store the public URL in `food_items.image_url` (column exists); add file input to `/merchant/foods` and render in `OrderForm`.

## Notifications (cutoff reminders, location started)

Add a `notifications`/push-subscription table, trigger from `setOfferingStatus` / `updateLocation` (first activation), and a scheduled function for cutoff reminders. PWA push needs a service worker (none yet).

## E2E tests (Playwright)

Needs `supabase start` + a way to log in without OAuth: create users via the admin API and set the session cookie, or add a test-only email/password provider in `config.toml`. Cover: merchant creates offering → customer orders → edit before cutoff / rejected after → scan QR → repeat scan.

## Move to production Supabase

`supabase link` → `supabase db push`; configure OAuth redirect URIs for the hosted project; set env vars on the host; schedule `GET /api/cron/fetch-context` daily with the `CRON_SECRET` bearer; set Auth site URL.
