# Neighborhood Eats

Multi-merchant food pre-order & pickup app (Next.js 16 + Supabase). Merchants publish what they'll sell on a date with an order cutoff and one of several pickup points; customers order (and edit until cutoff) and show a QR code at pickup. No payments yet — orders carry `payment_status` / `payment_ref` placeholders for later.

## Features

- **Social login only** — Google, Facebook, Apple via Supabase Auth.
- **Merchants**: pickup points, foods, offerings (date, pickup window, cutoff, per-item limits), prep list, QR scan to confirm pickup, customer order history, reports.
- **Customers**: browse open offerings, order, edit/cancel before cutoff, order history, QR code, live merchant location map on pickup day.
- **Live location**: merchant opts in per offering on the pickup date; only customers with an order can read it (Supabase Realtime).
- **Reports** (`/merchant/reports`): most-ordered foods by date, location, holiday, weather. Weather (Open-Meteo) and holidays (Nager.Date, country from the merchant profile) are snapshotted per offering by the cron route.
- **PWA**: installable (`app/manifest.ts`); camera QR scanning and geolocation work in the browser.

## Setup

1. `npm install`
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then `supabase start` (applies `supabase/migrations`, runs `supabase/seed.sql`).
3. Copy `.env.example` to `.env.local` and fill in the URL / anon key / service-role key printed by `supabase start`; set `CRON_SECRET` to any random string.
4. Social login (Google, Facebook, GitHub, Apple): follow [docs/social-login-setup.md](docs/social-login-setup.md) — it covers creating each OAuth app, the callback URLs, where credentials go (`supabase/.env` locally), and `NEXT_PUBLIC_AUTH_PROVIDERS` to choose which buttons appear. Instagram isn't supported; Yahoo is possible via custom OIDC.
5. `npm run dev` → <http://localhost:3000>. Sign in, then use **Merchant → Become a merchant**.
6. Weather/holiday snapshots: call `GET /api/cron/fetch-context` daily with `Authorization: Bearer $CRON_SECRET` (Vercel Cron, pg_cron + pg_net, or any scheduler).

## Languages

English, Spanish, Simplified and Traditional Chinese. The language follows the browser on first visit, is changed from the header switcher, and is remembered in a cookie and the user's profile. Merchants can add optional translations of their name and foods. See [docs/i18n.md](docs/i18n.md).

## CI/CD

GitHub Actions runs lint, typecheck, unit/DB tests, build and live-Supabase integration tests on every push/PR. Pushes to `main` can auto-deploy to a free Render service + hosted Supabase — see [docs/deployment.md](docs/deployment.md) (one-time setup; disabled until `DEPLOY_ENABLED=true`).

## Commands

`npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run typecheck` · `npm run lint`

## Design notes

- Orders are written only through the `place_order` / `update_order` / `cancel_order` RPCs (security definer), which enforce the cutoff and stock limits in the database; `confirm_pickup` verifies the QR token belongs to the caller's merchant and is idempotent.
- RLS isolates data: customers see their own orders, merchants only orders on their offerings; `order_lines` is a `security_invoker` view so reports are merchant-scoped.
- `types/database.ts` is generated: after any migration run `supabase gen types typescript --local > types/database.ts` (Postgres views come out with nullable columns; handle that where views are read).
- Next.js 16: the auth gate is `proxy.ts` (formerly `middleware.ts`).

## Not done / next

- Payments (hook points: `orders.payment_*`, `food_items.price_cents`).
- Push notifications; native apps.
- Playwright browser e2e and real OAuth logins (OAuth needs your provider credentials).

## Tests

- `npm test` — unit tests (cutoff, reports, weather/holiday lookup) and `tests/db/`, which applies the real migration and seed to an in-process Postgres ([PGlite](https://pglite.dev)) with stubbed Supabase auth/roles. Covers cutoff and stock enforcement, RLS isolation, QR pickup and live-location rules. No Docker needed.
- `SUPABASE_INTEGRATION=1 npx vitest run tests/integration` — runs against a live `supabase start` stack (real Auth sessions, PostgREST, RPCs, Realtime). Creates and deletes its own users. Defaults to the local demo keys.
