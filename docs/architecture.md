# Architecture

> **This is the short layer map.** For the full explanation, with diagrams, reasons for each choice, pros/cons and alternatives, read the [Design & architecture guide](design/README.md) (start with [01 System overview](design/01-system-overview.md)). Parts of this page predate later features (slots, prices, sharing, notifications); the guide and [data-model.md](data-model.md) are current.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth, Realtime) · Zod · Leaflet/OpenStreetMap · `qrcode` + `html5-qrcode` · Vitest + PGlite. PWA via `app/manifest.ts`. No payments yet.

## Layers

```
Browser (PWA)
  ├─ Server Components (pages)      read data with the signed-in user's Supabase client  → RLS applies
  ├─ Client Components              forms (useActionState), QR scanner, live map, location toggle
  └─ Server Actions                 mutations; thin: validate (zod) → call table/RPC
Next.js server
  ├─ proxy.ts                       refreshes session, redirects anonymous users to /login
  └─ app/api/cron/fetch-context     service-role job: weather + holiday snapshot
Supabase
  ├─ Auth (Google/Facebook/Apple)   profiles row auto-created by trigger on auth.users
  ├─ Postgres: tables + RLS + RPCs  ← source of truth for business rules
  └─ Realtime                       location_shares changes → customer map
```

**Principle:** the app never trusts itself. Cutoff, stock, ownership and pickup-day rules are enforced in SQL; server actions only validate shape and call them.

## Directory map

| Path | Contents |
| --- | --- |
| `app/` | Routes. Customer: `/`, `/offerings/[id]`, `/orders`, `/orders/[id]`. Merchant: `/merchant/**`. `/login`, `/auth/*`, `/api/cron/*` |
| `app/orders/actions.ts` | Customer server actions: `placeOrder`, `updateOrder`, `cancelOrder` (call RPCs) |
| `app/merchant/actions.ts` | Merchant server actions: merchant setup, pickup points, foods, offerings, location, `confirmPickup` |
| `components/` | `order-form`, `action-form` (+`Field`), `live-map` (+`live-map-loader`), `location-toggle` |
| `lib/auth.ts` | `requireUser`, `getMyMerchant`, `requireMerchant`, `safeNext` |
| `lib/supabase/` | `client.ts` (browser), `server.ts` (RSC/actions), `admin.ts` (service role, cron only), `proxy.ts` (session refresh) |
| `lib/cutoff.ts`, `lib/format.ts` | Pure helpers (`format.ts`: locale-aware dates, instants in a timezone) |
| `lib/locale.ts`, `i18n/`, `messages/` | Languages, locale negotiation, merchant-translation fallback, UI strings — see [i18n.md](i18n.md) |
| `lib/db-errors.ts` | Maps English database errors to translated messages |
| `lib/reports.ts` | Pure report aggregation (`topFoodsBy`) |
| `lib/context-fetch.ts` | Open-Meteo + Nager.Date clients, `weatherBucket` |
| `types/database.ts` | Generated DB types (`supabase gen types typescript --local`) |
| `supabase/migrations/` | Schema, RLS, RPCs, triggers, views |
| `supabase/seed.sql`, `config.toml` | Dev seed; auth provider config |
| `tests/db/` | PGlite tests of the real migration + seed |
| `tests/integration/` | Live-Supabase tests (opt-in, `SUPABASE_INTEGRATION=1`) |
| `lib/__tests__/` | Unit tests |

## Key flows

**Auth.** `/login` → `supabase.auth.signInWithOAuth` → provider → `/auth/callback` (exchanges code, redirects to a `safeNext` path) → session cookies. `proxy.ts` calls `getClaims()` on each request and redirects anonymous users (public: `/login`, `/auth/*`). Role is implicit: you're a merchant if you own a `merchants` row (`/merchant/setup` creates it).

**Ordering.** Offering page → `OrderForm` → `placeOrder` action → `place_order` RPC (checks published, cutoff, stock, one active order) → redirect `/orders/[id]`. Edit/cancel use `update_order` / `cancel_order` (cutoff re-checked in SQL).

**Pickup.** Order detail renders its `qr_token` as a QR image server-side. Merchant `/merchant/scan` decodes → `confirmPickup` → `confirm_pickup` RPC (token must belong to the caller's merchant; idempotent).

**Live location.** Merchant `LocationToggle` (only enabled on pickup date in the pickup point's timezone) → `watchPosition` → `updateLocation` (throttled 10 s) → `location_shares` upsert (RLS `can_share_location`). Customer `LiveMap` loads the row and subscribes to Realtime; RLS only exposes it to customers with a non-cancelled order and `active = true`.

**Reports.** `order_lines` view (security invoker, so merchant-scoped by RLS) → `topFoodsBy(lines, dimension)` → `/merchant/reports?by=date|location|holiday|weather`.

**Weather/holiday.** Daily `GET /api/cron/fetch-context` (Bearer `CRON_SECRET`) upserts `offering_context` (weather bucket, holiday) per offering using the service-role client.

## Conventions

- Server Components fetch; mutations go through Server Actions; interactive bits are small Client Components.
- Form actions return `{ error?: string }` (`FormState`) and `redirect()` on success.
- Supabase embeds are typed by `types/database.ts` (needs `Relationships` entries for each FK).
- `params` / `searchParams` are Promises (Next 16); route prop types (`PageProps<"/x">`) come from `npx next typegen`.
- `middleware.ts` is now `proxy.ts`.
