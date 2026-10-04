# MOB · Native iOS + Android apps (Expo) next to the Next.js web app ("Plan A")

**Status:** Planned — starts after roadmap *Phase A* (backups, monitoring, privacy/terms, account deletion). Phase A items already in progress: see [roadmap](../roadmap.md).
**Roadmap items:** new (MOB-*), pulls in SEC-1, SEC-5, SEC-7, NOTIF-2, QA-2   **Size:** L (~5–8 weeks part-time, indicative)   **Owner:** product owner + Claude

**Decisions (confirmed):** keep the Next.js web app and add a separate Expo (React Native) app sharing packages · iOS + Android, **private beta first** (TestFlight + Play internal testing) · Phase A before mobile · merchants and customers in the **same** app.

## Goal
Customers and merchants can use the app natively on iOS and Android (reliable push later, native camera QR scan, GPS), while the web app keeps working unchanged.

## Why / why not (summary)
- The backend is "all rules in SQL" (RPCs + RLS). A native client only needs a **client-side data layer**, not a new backend.
- **Plan A** keeps the live web app untouched (no migration risk; keeps the server layer, SSR, Render, tests). Cost: **two UIs** — every future feature is built twice; mitigated by shared `core`/`data`/`messages` packages and a parity checklist.
- Rejected: one universal Expo codebase (bigger rewrite; web loses its server layer — revisit later as an optional Expo-web experiment), Capacitor/WebView wrapper (App Store 4.2 risk; depends on the sleeping Render host).
- Store friction: **Sign in with Apple** required (4.8) because Google/Facebook login is offered; **in-app account deletion** required (5.1.1(v)); privacy policy URL; permission strings. Costs: Apple $99/yr, Google Play $25 once; EAS free tier (15 iOS + 15 Android builds/month, low priority).
- v1 location sharing is **foreground-only** (store scrutiny of background location).

## Architecture
```
(repo root)         Next.js web app stays (no move → Render/CI untouched)
apps/mobile/        Expo Router app, iOS + Android only
packages/core/      types/database.ts, locale, format, cutoff, reports, db-errors, zod schemas (error CODES, not text)
packages/messages/  en, es, zh-CN, zh-TW JSON (unchanged)
packages/data/      fn(client, input) → Result; named query functions
supabase/           unchanged + delete-account support, later push_tokens
```
- npm workspaces (`apps/*`, `packages/*`); Next uses `transpilePackages`; EAS prefers Yarn workspaces → decided by spike S6.
- `Result = { ok: true, data } | { ok: false, code: ErrorKey | "validation", field? }`; web server actions become thin wrappers; mobile translates codes with `t()`.
- Mobile: TanStack Query; supabase-js with **PKCE**, `detectSessionInUrl:false`, **encrypted session storage** (AES-256 key in `expo-secure-store`, ciphertext in AsyncStorage); OAuth via `expo-web-browser` + scheme `neighborhoodeats://`; **Apple via `expo-apple-authentication` + `signInWithIdToken`** on iOS; `use-intl` + `expo-localization`; QR via `react-native-qrcode-svg` / `expo-camera`; map = WebView with the same Leaflet page (vs `react-native-maps`, spike S5); `expo-location` foreground sharing; EAS Build/Submit from CI; EAS Update with **code signing**.
- Push (NOTIF-2): `expo-notifications` + `push_tokens` (owner-only RLS) + Expo push API; localized payloads, no sensitive content.

## Reuse vs rewrite
| Bucket | Files |
| --- | --- |
| Reuse → packages | `lib/locale.ts` (let `parseTranslations` take a plain object), `lib/cutoff.ts`, `lib/format.ts`, `lib/reports.ts`, `lib/context-fetch.ts`, `lib/db-errors.ts` (return only `ErrorKey`), `messages/*.json`, `types/database.ts`; unchanged `supabase/migrations`, `tests/db`, `lib/__tests__` |
| Refactor → `packages/data` | `app/orders/actions.ts`, `app/merchant/actions.ts` (~20 actions → `fn(client,input)→Result`), inline `select()` joins in pages, `lib/auth.ts`, `tests/integration/api.test.ts` |
| New in `apps/mobile` | all screens, order form, translation fields, locale switcher, live map, location toggle, QR scan/display, auth/session, i18n provider |
| Web stays | `app/**`, `proxy.ts`, `components/*`, `app/auth/*`, `app/api/cron/*`, `render.yaml` |

## Milestones
**Prerequisites (Phase A + store needs):** OPS-1 backups · OPS-2/3 monitoring · SEC-1 privacy & terms · **SEC-5 account deletion** · SEC-7 provider go-live · enroll Apple Developer + Google Play · check Xcode / Android Studio (or EAS dev builds).
- **M-1 Spikes + go/no-go (~1 wk):** S2 use-intl ICU on Hermes · S3 native OAuth + PKCE + Apple + encrypted storage · S4 early external TestFlight build · S5 map approach · S6 monorepo + EAS · S8 free-tier limits. *Gate:* S2/S3/S6 failing without workaround → reassess.
- **M0 Workspaces (S):** root workspaces + empty packages + `apps/mobile` scaffold; Next `transpilePackages`. *Verify:* CI green, Render deploys, no visible change.
- **M1 Extract `core`/`messages`/`data` (M):** `Result` functions; thin web wrappers; port tests; data-layer tests against `supabase start`. *Verify:* all existing tests pass, web identical.
- **M2 Expo skeleton, auth, i18n (M):** login (Google/Facebook/GitHub + native Apple), guard, language switcher, locale sync. *Verify (dev builds):* login, session survives restart, 4 languages incl. plurals.
- **M3 Customer screens (L):** browse, offering, order form, orders + QR, live map, profile/settings (+ account deletion UI) → **TestFlight + Play internal**. *Verify:* place/edit/cancel, cutoff & stock race, Realtime marker.
- **M4 Merchant screens (L):** setup, profile, foods (+translations), pickup points, offerings, customers, reports, QR scanner, foreground location sharing. *Verify:* Maestro flow publish → order → scan → picked up.
- **M5 Store readiness + public release (M + review time):** privacy URL, account deletion, permission strings, Sign in with Apple, review notes (reviewer uses their own Apple ID — **no backdoor accounts**), screenshots, content rating, Play Data-safety, **security gate**.
- Follow-ups: NOTIF-1 email, NOTIF-2 push, QA-1 web e2e, PAY-1/2 (each for **web and mobile**).

## Parity discipline (two UIs)
Every item lists **Web / Mobile / Shared** work; logic in `packages/*`; one string = four catalogs once; contract tests in `packages/data` are the behavior spec for both clients; `docs/features.md` tracks Web/Mobile status.

## Security gate (before each TestFlight/Play-external/store submission)
1. Session storage encrypted (SecureStore key + AsyncStorage ciphertext), `WHEN_UNLOCKED`.
2. OAuth: PKCE, system browser sessions only, never an embedded WebView; validate redirects.
3. No secrets in the bundle (only `EXPO_PUBLIC_*` URL + anon/publishable key); EAS secrets for credentials; `service_role` key never leaves Render/GitHub secrets.
4. HTTPS only (ATS on, Android `usesCleartextTraffic:false`); no cert pinning in v1.
5. EAS Update code signing; preview/production channels; updates only via CI.
6. Camera + location *when in use* only; purpose strings; **no background location**; no tracking SDKs; accurate privacy labels / Data-safety.
7. Data minimization: location only on pickup date to ordering customers (RLS); `push_tokens` owner-only; no PII in push payloads, logs or crash reports.
8. QR token: 244-bit single-use bearer; shown only to the owner; consider Android `FLAG_SECURE` on the QR screen.
9. Abuse limits: per-customer order/quantity caps and cancel limits; rate limiting (SEC-2); web CSP/headers (SEC-3).
10. Account deletion with defined behavior for merchants that have other customers' orders (SEC-5).
11. Supply chain: lockfile + Dependabot, pinned Expo SDK, reviewed native modules, builds from CI only, 2FA on all accounts, minimal-scope tokens.
12. RLS/RPC regression tests in `tests/db` for every new table/function + IDOR/enumeration checklist.
13. Reviewers use their own Apple ID; no hard-coded reviewer account or production password login.
14. Root/jailbreak detection & obfuscation: out of scope for v1.

## Verification
Per milestone: its *Verify* line + `npm test`, data-layer tests, typecheck, lint, web build. Native: Maestro flows on simulator/emulator + manual real-device checklist (camera, GPS, map, 4 languages, Google/Facebook/Apple login, kill/restart, offline errors). Web: existing CI + smoke test unchanged after every shared-package change.

## Rollout notes
Mobile ships to testers first; the web is never blocked. Migrations stay backward-compatible (they run before the new web version starts and while old mobile builds may still be in use — never drop/rename columns in one step).

## Working agreement
Spec first → failing test first → implement → independent review before each milestone merges → docs updated in the same change. (Superpowers plugin v6.4.1 is installed; its skills load in new sessions.)
