# 02 · Tech stack and the alternatives we weighed

How to read each section: **What it is → Why it is here → Pros → Cons → Alternatives → When to revisit.** Database/auth/hosting have their own documents ([03](03-database-supabase.md), [04](04-authentication-oauth.md), [06](06-hosting-deployment-ci.md)); this one covers the application layer.

> Honest framing: most stack choices were made for **one small team, one codebase, free hosting, and a possible mobile app later**. Different constraints (a big team, heavy realtime, strict compliance) would pick differently. Where we say "alternative", it is a *fair* option, not a strawman.

---

## 1. TypeScript

**What:** JavaScript with types, checked at build time (`npm run typecheck`).
**Why here:** The data crosses many boundaries (browser ↔ server ↔ SQL). Generated database types (`types/database.ts`) mean a typo in a column name or a wrong embed fails the build, not production. Message keys for translations are type-checked too.
**Pros:** catches a whole class of bugs early; great editor support; one language front to back.
**Cons:** build step; types can lie at runtime (we still validate input with Zod and defensive parsers such as `parseSharedOffering`); generated types need regenerating after each migration.
**Alternatives:** plain JavaScript (faster to start, much riskier as the app grows); Python/Django, Ruby/Rails, PHP/Laravel (excellent batteries-included frameworks, but a second language would be needed for the interactive UI and a future React Native app).
**Revisit when:** never realistically; the cost is low.

## 2. Next.js 16 (App Router) + React 19

**What:** React framework that renders pages **on the server** (Server Components), handles forms with **Server Actions**, and bundles route handlers (`app/api/**`). `proxy.ts` replaces the old `middleware.ts` in Next.js 16.
**Why here:**
- Pages are mostly "read data, show it": server components fetch with the user's session and send HTML. Little JavaScript reaches the phone.
- Forms are plain `<form>` + a server function; no hand-written REST layer for our own UI.
- Link previews (Facebook) need server-rendered `<meta>` tags: Next's `generateMetadata` does that for the public share page.
- React Native later can reuse knowledge (and, with care, logic).
**Pros:** one codebase for UI + server logic; great defaults (routing, caching, images, fonts); huge ecosystem and hiring pool; PWA-capable; works on Render as a normal Node server.
**Cons:**
- **Fast-moving and surprising:** Next 16 differs from older tutorials (async `cookies()`/`params`, `proxy.ts`, `PageProps` types from `next typegen`). That is why [`AGENTS.md`](../../AGENTS.md) tells contributors to read `node_modules/next/dist/docs/` before using an API.
- Server/client boundary is easy to get wrong ("why is `useState` not allowed here?").
- Server Actions are not a public API: a mobile app would need another entry point (the plan in [`../plans/mobile-native-expo.md`](../plans/mobile-native-expo.md) moves logic into shared data functions).
- Some features (cache, streaming) are powerful but hard to reason about; we mostly opt out with `force-dynamic` where freshness matters.
**Alternatives:**

| Option | When it is better | Why we did not pick it |
| --- | --- | --- |
| **Remix / React Router framework mode** | You prefer web-standard loaders/actions and fewer magic caches | Smaller ecosystem for our needs; team familiarity with Next |
| **SvelteKit / Nuxt** | Smaller bundles, simpler reactivity | Different language ecosystem from the planned React Native app |
| **Vite + React SPA + separate API** | Pure static hosting, clear API for mobile | Two deployables, no server-rendered link previews, more plumbing for auth/session |
| **Rails / Django / Laravel** | Fastest CRUD apps, admin included | A JS UI would still be required for QR scanning/maps/offline; two stacks |
| **HTMX + server templates** | Minimal JS | Rich pieces (map, QR scanner, live updates) fight the model |
**Revisit when:** a native mobile app becomes the primary client (then a shared "data layer" package matters more than Next specifics).

## 3. Server Actions vs REST/tRPC/GraphQL for our own UI

**What we do:** the browser submits a `<form>` to a Server Action (`app/**/actions.ts`); the action validates with Zod and calls Supabase (a table write or an RPC). Reads happen in server components. Realtime and location use `supabase-js` directly in the browser.
**Pros:** least code; automatic CSRF protection (Next checks `Origin` for actions); types flow naturally; progressive enhancement.
**Cons:** not callable by other clients; error handling convention is ours (`FormState {error?, saved?}`); React 19 resets forms after actions unless you handle it (we do: `components/use-action-form.ts`, see [10](10-code-structure-patterns.md)).
**Alternatives:** REST/OpenAPI (clear contract for many clients, more boilerplate), tRPC (type-safe RPC between TS client and server, extra layer), GraphQL (flexible for many clients, heavy for a small app). Supabase itself already exposes REST (PostgREST) which the planned mobile app can call directly because the **rules are in the database**, not in these actions. That is a key reason actions can stay thin.

## 4. Tailwind CSS 4

**What:** utility-first CSS (`className="rounded-lg border p-3"`), configured through PostCSS (`@tailwindcss/postcss`). Dark mode via `dark:` classes.
**Why:** quick, consistent UI without writing/maintaining a CSS architecture; styles live next to markup; unused CSS is stripped.
**Pros:** speed; small CSS output; no naming debates; works with server components.
**Cons:** long class strings; designers used to component CSS find it noisy; team must agree on patterns (we keep repeated bits in small components such as `PickupSlotList`).
**Alternatives:** CSS Modules (scoped CSS, more files), styled-components/Emotion (runtime CSS-in-JS conflicts with server components), component kits (shadcn/ui, MUI: faster polish, more weight and lock-in), plain CSS.
**Revisit when:** a designer joins and wants a design-token system; consider extracting components first.

## 5. Zod 4 (input validation)

**What:** schema library. Server actions parse `FormData` into typed values with human error messages.
**Why:** form input is untrusted; Zod gives one place to define shape + message. Messages are translated because schemas are built **inside** the action with `t(...)`.
**Pros:** typed output, composable, good messages. **Cons:** another API to learn; Zod 4 changed some typing (`.pipe`, coercion).
**Important:** Zod validates *shape* ("price looks like 12.50"). **Business rules** (cutoff, stock) are in SQL, never only in Zod.
**Alternatives:** Valibot (smaller), Yup, ArkType, hand-rolled checks (error-prone), or relying only on database constraints (we also do this: CHECK constraints are the last line of defence).

## 6. Internationalization with next-intl (4 languages)

**What:** UI strings in `messages/{en,es,zh-CN,zh-TW}.json`; the locale comes from a cookie, else the browser's `Accept-Language`, else English; **no `/en/` in URLs**; the choice is saved on the profile. Details: [`../i18n.md`](../i18n.md).
**Why no URL prefix:** the same URL works for everyone, so OAuth redirect URLs, emails and shared links do not multiply by language. (Trade-off: search engines cannot index per-language URLs, irrelevant for a logged-in app; public share pages take `?lang=`.)
**Merchant content** (food names, descriptions, instructions) is translated **by the merchant**, optionally, with the original as fallback. No machine translation: no API cost, no wrong allergen translations.
**Pros:** type-checked keys; ICU plurals; a test fails if any language misses a key or changes placeholders. **Cons:** four catalogs to keep in sync (AI-drafted Spanish/Chinese still need native review: `docs/todo.md`); dates/times need explicit locale handling.
**Alternatives:** react-i18next (popular, less tightly integrated with server components), Lingui, Paraglide, URL-prefixed locales (better SEO, more routing complexity), machine translation at runtime (cheap, risky for food/allergy wording).

## 7. Maps: Leaflet + OpenStreetMap tiles (+ Geoapify search)

**What:** the live map and the pickup-point picker use Leaflet (open source) with OSM tiles; **place search** (find a business/ZIP) is Geoapify, called from our server. Details of the search flow: [08](08-integrations.md).
**Why:** no API key or billing for the map itself; enough for pins and a moving marker.
**Pros:** free, light, flexible. **Cons:** OSM's tile servers have a usage policy (fine at our scale; use a paid tile provider if traffic grows); Leaflet touches `window`, so the map is loaded with `dynamic(..., {ssr:false})`; fewer polished features than Google Maps (business photos, reviews, street view).
**Alternatives:** Google Maps/Places (best business data, needs billing), Mapbox GL (beautiful, key and pricing), MapLibre (open fork for vector maps), a static map image only.

## 8. QR codes: `qrcode` (generate) and `html5-qrcode` (scan)

**What:** the order page renders a QR image **on the server** from the order's secret `qr_token` (244 bits of randomness); the merchant's scan page uses the phone camera via `html5-qrcode`, then calls the `confirm_pickup` SQL function.
**Why:** QR is the fastest way to verify "this order is real, belongs to my business, is not already collected".
**Pros:** works offline-ish (the code is just text), cheap, familiar. **Cons:** camera permission and lighting issues (real-device QA is still on the checklist); a screenshot of a QR can be reused until scanned once (the function is idempotent and shows "already picked up").
**Alternatives:** a short numeric pickup code (easier by voice, easier to guess), NFC, name-based lookup. We keep a manual-entry field as a fallback.

## 9. Time zones: `Intl` + `tz-lookup`

**What:** all instants are stored as UTC; every pickup point stores an IANA timezone. Formatting uses `Intl.DateTimeFormat` with explicit zones (`lib/format.ts`); `tz-lookup` derives the timezone from latitude/longitude offline when a pickup point is created.
**Why:** servers run in UTC (Render), merchants and customers are elsewhere; "pickup day" must be judged at the pickup place. This was the source of several real bugs (see [`../decisions.md`](../decisions.md)).
**Alternatives:** date-fns-tz / Luxon / Temporal (nice APIs; `Intl` was enough), asking merchants to type timezones (error-prone, which is why we stopped).

## 10. Money: integer cents, US dollars

**What:** prices are whole cents (`price_cents`), formatted with `Intl.NumberFormat` (`lib/money.ts`). Nothing is charged by the app.
**Why:** floating-point dollars cause rounding bugs; cents are exact.
**Alternatives:** decimal/`numeric` types (fine in SQL; we use integers for simplicity), a money library (needed when multiple currencies/tax arrive, see roadmap PAY items).

## 11. PWA (installable web app)

**What:** `app/manifest.ts` + icons make the site installable to the home screen. No service worker yet (so no offline mode and no web push).
**Why:** cheapest "app-like" experience; one codebase.
**Cons:** iOS limits (push only for installed apps on iOS 16.4+), no store presence.
**Alternative:** native apps (Expo/React Native) are planned later ([`../plans/mobile-native-expo.md`](../plans/mobile-native-expo.md)): better push/camera/background GPS, but two UIs to maintain.

## 12. No ORM, no state-management library

- **No ORM (Prisma/Drizzle):** `supabase-js` + generated types is enough because the heavy logic is in SQL. An ORM would duplicate the schema and tempt us to put rules back in app code.
- **No Redux/Zustand/React Query:** server components fetch; client state is tiny (a form, a map). React Query becomes relevant in the mobile app, which has no server components.

## 13. Testing tools (summary; full detail in [09](09-testing-quality.md))

| Tool | Role | Why this one |
| --- | --- | --- |
| **Vitest** | unit tests | fast, TypeScript-native |
| **PGlite** | real Postgres in-process for migration/RLS tests | no Docker; runs the *actual* migrations |
| **Live local Supabase** | integration tests (Auth, REST, Realtime, concurrency) | covers what PGlite cannot |
| **Playwright** | browser journeys | real Chromium against a production build |

## 14. Other libraries worth knowing

| Library | Used for |
| --- | --- |
| `@supabase/ssr`, `@supabase/supabase-js` | Supabase clients with cookie sessions ([04](04-authentication-oauth.md)) |
| `@sentry/nextjs` | error reporting (privacy-scrubbed; [08](08-integrations.md)) |
| `eslint` + `eslint-config-next` | lint, including React hooks rules (they catch real bugs, e.g. "cannot update ref during render") |

## 15. Decision summary

| Decision | Core reason | Biggest trade-off |
| --- | --- | --- |
| TypeScript everywhere | safety across many boundaries | build step, runtime validation still needed |
| Next.js server-first | little JS, easy forms, link previews | fast-moving framework, server/client confusion |
| Rules in SQL, thin actions | un-bypassable rules, reusable by mobile | SQL skills required; testing needs PGlite/Supabase |
| Tailwind | speed, consistency | long class lists |
| next-intl without URL prefix | one URL per page, simple OAuth | no per-language URLs |
| OSM + Leaflet, Geoapify search | free map, cheap search | tile usage policy, fewer map features |
| Integer cents, USD only | exact money, simple | multi-currency later needs work |
