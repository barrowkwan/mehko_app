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
| Render free + hosted Supabase free, deployed by GitHub Actions deploy hook | Vercel Hobby forbids commercial use; Render free allows it and needs no card. Trade-off: cold starts, Supabase pauses (daily job keeps it awake), no backups |
| next-intl without URL prefix; locale = cookie → browser → `en`, saved to profile | Same URLs for all languages (OAuth callback and redirects unchanged); a returning user gets their language on any device |
| Merchant screens show translations in the UI language (original shown on the Foods list) | First version showed originals on merchant screens, so switching language looked like translations hadn't saved. Showing the translation + original + translated languages makes the result visible |
| Merchant text translated by the merchant (optional), not auto-translated | No API cost, no machine errors on allergen/food names; original text is always the fallback |
| Leaflet + OpenStreetMap, circle markers | No API key; avoids Leaflet's bundled marker-icon asset issue under bundlers |
| `types/database.ts` generated from the local DB | Typed embeds and RPCs; was hand-written first and matched except view columns (generated as nullable) |
| PGlite for DB tests + opt-in live-stack integration tests | PGlite: fast, no Docker, stubbed auth schema/roles. Integration tests cover what PGlite can't (Auth, PostgREST, Realtime) |

## Past bugs (found by tests) — don't reintroduce

- **Cancelled order blocked re-ordering.** `unique (customer_id, offering_id)` counted cancelled orders. Now a partial unique index `where status <> 'cancelled'`.
- **Stopping location sharing after pickup day failed.** An `upsert` re-runs the INSERT policy (`can_share_location`, pickup-day only). `updateLocation(null)` therefore uses a plain `update`.
- **`supabase db push` failed on hosted: `function gen_random_bytes does not exist`.** pgcrypto lives in the `extensions` schema on hosted Supabase, which isn't on the search_path during pushed migrations (the local stack and PGlite hid this). The QR token default now uses core `gen_random_uuid()` only; no extensions. Lesson: don't depend on extension functions in migrations without schema-qualifying them, and check migrations against `set search_path = public`.
- **CI: `supabase/setup-cli` `version: latest` hit a GitHub API rate limit.** The Supabase CLI version is pinned in `.github/workflows/ci.yml` (both jobs). Bump it deliberately; keep it close to the CLI you use locally.
- **CI: `supabase db push` couldn't connect (IPv6).** GitHub runners are IPv4-only and the direct DB host is IPv6-only on the free plan; CI uses the session-pooler string in `SUPABASE_DB_URL`.
- **Login redirected to `https://localhost:10000` on Render.** Behind a reverse proxy, `request.url` / `request.nextUrl.origin` in route handlers is the server's internal address. Route handlers that redirect (`/auth/callback`, `/auth/signout`) now use `publicOrigin()` (`lib/origin.ts`, from `x-forwarded-host`/`Host` + `x-forwarded-proto`). `proxy.ts` redirects were unaffected. Rule: never build redirect URLs from `request.url` in route handlers.
- **Times were shown in the server's timezone (UTC on Render).** Cutoff times are now formatted in the pickup point's timezone with the zone name (`formatInstant`), and "today"/"pickup day" use `todayIn(pickupTz)` instead of the server date.
- **Backups must be encrypted:** the repo is public and artifacts of public repos are downloadable by anyone; the backup workflow encrypts the dump (openssl AES-256/PBKDF2) before upload and excludes session/token tables. Don't upload plaintext dumps anywhere public.
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
- **Realtime cold start**: right after the stack (or first subscriber) starts, an immediate first `postgres_changes` event can be missed. The map loads the current row on mount and the merchant pushes updates every ≥10 s, so users recover on the next update; tests retry.
- **Clean-checkout typecheck**: `PageProps<...>`/`LayoutProps<...>` come from `.next/types`, so `npm run typecheck` runs `next typegen` first (CI caught this).
- **`next build` type-checks `tests/`** — run `npm run typecheck` after editing tests.
- **Verified against a live local Supabase** (migration, seed, RLS, RPCs, QR, Realtime, SSR pages with a session cookie, cron route with real Open-Meteo/Nager). **Still unverified**: real OAuth logins (need provider credentials), camera QR scanning and the Leaflet map in a real browser, geolocation on a phone.
