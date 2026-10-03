# Decisions, gotchas and past bugs

## Decisions

| Decision | Why |
| --- | --- |
| Rules in SQL (RPCs + RLS), app is thin | One enforcement point; works for any future client (native app); testable without a browser |
| Orders written only via RPCs; no direct insert/update policies | Cutoff/stock can't be bypassed from the client |
| Role implicit (own a `merchants` row) | A person can be both customer and merchant without a role switch |
| `order_lines` is `security_invoker` | Merchants automatically only see their own sales |
| Cutoff stored as absolute `timestamptz`; the form converts `datetime-local` using the merchant's **browser** timezone | Simple; the DB trigger validates against the pickup point's timezone. Merchants traveling across timezones could mis-set the cutoff |
| Cron route instead of a Supabase Edge Function | Shares/tests `lib/context-fetch.ts` with the app; any scheduler can call it |
| Leaflet + OpenStreetMap, circle markers | No API key; avoids Leaflet's bundled marker-icon asset issue under bundlers |
| Hand-written `types/database.ts` | Supabase CLI wasn't available; regenerate later |
| PGlite for DB tests | Runs the real migration with no Docker; auth schema/roles are stubbed in `tests/db/harness.ts` |

## Past bugs (found by tests) — don't reintroduce

- **Cancelled order blocked re-ordering.** `unique (customer_id, offering_id)` counted cancelled orders. Now a partial unique index `where status <> 'cancelled'`.
- **Stopping location sharing after pickup day failed.** An `upsert` re-runs the INSERT policy (`can_share_location`, pickup-day only). `updateLocation(null)` therefore uses a plain `update`.
- **Cutoff check by timezone hack.** Validation lives in trigger `check_offering_schedule`, evaluated in the pickup point's timezone — not in TypeScript.

## Gotchas

- **Next.js 16**: `middleware` → `proxy`; `cookies()`, `params`, `searchParams` are async; run `npx next typegen` after adding routes or `PageProps<...>`/`LayoutProps<...>` won't resolve.
- **`.gitignore`** has `.env*`; `.env.example` is explicitly un-ignored.
- **Typed embeds** need `Relationships` in `types/database.ts`; one-to-one FKs (`location_shares`, `offering_context`) need `isOneToOne: true`.
- **Realtime** requires the table in the `supabase_realtime` publication (done in the migration) and RLS that lets the subscriber `select` the row.
- **Weather API windows**: forecast API ≈ 92 days back/16 ahead; older dates use the archive API (handled in `fetchWeather`). The cron only refreshes `pickup_date >= today-7`; older offerings are filled once (backfill) if missing.
- **Customers can't read other customers' orders** — use `offering_stock` for remaining quantities, never aggregate `order_items` from the client.
- **Service-role key** is only used in `lib/supabase/admin.ts` for the cron route; never import it from client code.
- **`vitest` v5 needs `@types/node` ≥ 22**; the repo pins `^24`.
- **Unverified in a real browser/stack**: OAuth providers, camera scanning, live map, Supabase itself (tests use PGlite). Smoke-test these after `supabase start`.
