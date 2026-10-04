# Roadmap / backlog

Everything we've decided **not to build yet** lives here, with the reasoning, so future work (and future Claude sessions) can pick it up fast.

## How this file works

1. **Backlog (this file):** ideas and recommendations that are not started. Each item has an ID, why it matters, rough size, dependencies and a "done when" check.
2. **When you start an item**, create a plan file `docs/plans/<phase-or-feature>.md` from the [template](plans/README.md), **move the item's details into that plan**, and replace the item here with a one-line link under *In progress*.
3. **When it ships**, mark the plan `Done`, move the one-liner to *Done* below (date + commit/PR), and update the docs it touched ([features.md](features.md), [data-model.md](data-model.md), …).
4. New ideas or recommendations → add them here under the right section. Don't leave them only in chat.

Size: **S** ≤ half a day · **M** 1–3 days · **L** a week or more. Priority: **P1** next · **P2** soon · **P3** later/when needed.

## In progress

- **Waiting on a person:** see [todo.md](todo.md) (translation review, terms acceptance, real-device check, legal review, restore test, provider go-live).
- _Phase A (in progress):_ OPS-1, SEC-5, SEC-1 are being implemented first (below).
- **Planned (after Phase A):** [MOB · Native iOS + Android apps with Expo (Plan A)](plans/mobile-native-expo.md) — detailed plan, milestones M-1…M5, security gate.

(Link plans here: `- [FEAT-1 Edit & clone offerings](plans/feat-1-edit-clone-offerings.md) — started YYYY-MM-DD`)

## Suggested order

Decided with the product owner: **multi-language first (done), payments last** (most merchants take cash, Venmo or Zelle to avoid card fees).

1. **Phase A – Safe to run for real:** OPS-1 backups → OPS-2 uptime monitoring → OPS-3 error monitoring → SEC-1 privacy & terms → SEC-7 provider go-live → QA-2 real-device check → QA-3 translation review.
2. **Phase B – Merchant usefulness:** FEAT-1 edit/clone offerings → FEAT-2 food photos → FEAT-3 order notes & pickup instructions → FEAT-10 map picker for pickup points.
3. **Phase C – Keep customers informed:** NOTIF-1 email → NOTIF-2 web push.
4. **Phase D – Quality & scale:** QA-1 browser e2e tests, OPS-6 staging, OPS-7 deploy approval gate, reports upgrades.
4b. **Mobile (after Phase A):** [MOB plan](plans/mobile-native-expo.md) — native iOS/Android apps next to the web app; its prerequisites are OPS-1, OPS-2/3, SEC-1, **SEC-5**, SEC-7.
5. **Phase E – Payments (last):** PAY-2 prices → PAY-1 manual cash/Venmo/Zelle tracking → PAY-3 cards only if asked.

---

## Operations & reliability

### OPS-1 · Scheduled database backups — P1 · S — **running** (passphrase set, first hosted run green 2026-10-04). **Open: test-restore into a throw-away Supabase project — deferred; do it before the first real merchants take orders and no later than the first mobile beta** (steps in [backup-restore.md](backup-restore.md)). Until then the backups are unproven: dump + encryption work on the hosted DB, but decrypt + load has not been tried there.
**Why:** Supabase free has **no automatic backups**; a bad migration or deleted project loses everything.
**Do:** GitHub Action (daily/weekly) running `supabase db dump --db-url "$SUPABASE_DB_URL"` (the session-pooler secret already exists) → store as an encrypted/private artifact or private storage; keep N copies; write a restore runbook in `docs/` and test one restore into a local stack.
**Done when:** a restore from last night's dump into `supabase start` is verified and documented.
**Note:** goes away as a need if you upgrade to Supabase Pro (daily backups) — see OPS-5.

### OPS-2 · Uptime monitoring & alerts — P1 · S — **done 2026-10-04** (monitor on `/api/health` set up by the owner; see [monitoring.md](monitoring.md#1-uptime-monitoring))
**Why:** nothing tells you the site is down; Render free also sleeps after ~15 min.
**Do:** free uptime monitor (e.g. UptimeRobot/Better Stack) hitting `/login` every 5 min with email alert. A 5–10 min ping also keeps the free service awake (744 h/month fits the 750 free hours, but only if it's your only free service).
**Done when:** you get an alert when the site is stopped and no cold starts during the day.

### OPS-3 · Error monitoring — P1 · S — **done 2026-10-04** (live; verified with `scripts/verify-sentry.sh`; the owner confirmed the test message (info) and test error (error) in Sentry and created an alert; see [monitoring.md](monitoring.md#2-error-monitoring-with-sentry))
**Why:** server action/RPC errors are only in Render logs. Unmapped DB errors are `console.error`ed (`lib/db-errors.ts`).
**Do:** Sentry (free tier) for Next.js (server + client), source maps in CI, alert on new errors.

### OPS-4 · Don't let the daily job silently stop — P2 · S
**Why:** GitHub disables scheduled workflows after ~60 days without repo activity (verify current rule); the daily job also keeps Supabase from pausing after 7 idle days.
**Do:** alert on failure (GitHub email), add a monthly no-op commit/ping or a second keep-alive path (uptime monitor hitting an endpoint that touches the DB).

### OPS-5 · Upgrade triggers (decision, not code) — P1 · —
Free tiers are for a **pilot**. Render's own docs say not to use free web services for production.
| Trigger | Action | Approx. cost |
| --- | --- | --- |
| Real customers depend on it / cold starts hurt | Render paid instance (no sleep) | ~$7/mo (verify) |
| Data you can't afford to lose / project paused once | Supabase Pro (daily backups, no pause) | $25/mo |
| >200 people on the live map at once, or DB > ~400 MB | Supabase Pro | $25/mo |
Record the date you upgrade in the *Done* log.

### OPS-6 · Staging environment — P3 · M
Second Supabase project (free tier allows 2 active) + second Render service (shares the 750 free hours) deployed from a `staging` branch; `supabase db push` to staging first, smoke test, then production.

### OPS-7 · Production approval gate — P3 · S
Move deploy secrets to a GitHub **Environment** `production` with required reviewers / branch restriction (`environment: production` on the deploy and daily jobs). Required reviewers are free on public repos; private repos need a paid plan.

### OPS-8 · Custom domain — P2 · S
Render custom domain + DNS; update `SITE_URL`, Supabase Site URL/Redirect URLs, Google OAuth JavaScript origins, Render env. ~$10–15/yr for the domain.

### OPS-9 · Dependency updates — P3 · S — **Dependabot added (weekly, grouped, no majors)**; the Supabase CLI pin in `ci.yml` is still bumped by hand
Dependabot/Renovate for npm and GitHub Actions; bump the pinned Supabase CLI deliberately (`ci.yml`).

### OPS-10 · Check weather/holiday API terms — P2 · S (research)
Open-Meteo's free API is, to my knowledge, **non-commercial use**; this is a merchant platform. Read their terms; if needed buy their plan or switch source. Usage is tiny (daily job). Nager.Date needs no key.

### OPS-11 · Secret/credential expiry reminders — P3 · S
Apple client secret expires ≤ 6 months (if Apple login enabled); rotate Supabase access tokens/DB password/`CRON_SECRET` on a schedule.

### OPS-12 · Detect DB/type drift in CI — P3 · S
CI step: apply migrations, run `supabase gen types typescript --local`, fail if `types/database.ts` differs.

## Product features

### FEAT-1 · Edit & clone offerings, delete drafts — P1 · M — **implemented (web)**; plan: [plans/feat-1-edit-clone-offerings.md](plans/feat-1-edit-clone-offerings.md)
**Why:** merchants can only publish/close. Repeating last week's menu is the most common action.
**Do:** `updateOffering`, "Duplicate to new date", delete drafts. **Rules:** schedule trigger already validates cutoff; do not orphan `order_items` (FK to `offering_items`, no cascade) — block removing items that have orders, or define behavior in a migration. Add DB tests.

### FEAT-2 · Food photos — P1 · M — **done 2026-10-04 (web, verified on a phone)**; plan: [plans/feat-2-food-photos.md](plans/feat-2-food-photos.md)
Supabase Storage bucket `food-images`, policy limiting writes to the merchant's own folder, use existing `food_items.image_url`; upload on Foods page; show in order form/home. Resize on upload (free tier storage 1 GB).

### FEAT-3 · Order notes, allergies & pickup instructions — P1 · S — **implemented (web)**; plan: [plans/feat-3-order-notes-instructions.md](plans/feat-3-order-notes-instructions.md)
`orders.note` (customer) and `offerings.instructions` (merchant, e.g. "meet at the north gate"), shown on order/offering pages and in the merchant prep list. Translate instructions like other merchant text (see I18N-3).

### FEAT-4 · Shareable merchant/offering links & QR poster — P2 · M
Public-ish landing page per merchant to share on social/WhatsApp (still requires login to order). Consider locale in shared links.

### FEAT-5 · Reports upgrades — P2 · M
Date-range filter, CSV export, move aggregation to SQL views when > ~10k lines (currently in app, `lib/reports.ts`), revenue once prices exist (PAY-2), translated food names in reports.

### FEAT-6 · Merchant cancels an offering/order with notice — P2 · M
E.g. bad weather/sold out. Needs NOTIF-1 to tell customers; define refund behavior with payments.

### FEAT-7 · Sold-out / remaining-stock indicator on browse — P2 · S

### FEAT-8 · Reorder previous order, favourite merchants — P3 · M

### FEAT-9 · Staff accounts per merchant (helper can scan QR) — P3 · L
Roles table; RLS currently assumes `merchants.owner_id` only (`is_merchant_owner`).

### FEAT-10 · Pickup point map picker / address search — P2 · M — **map picker done** (click/drag pin, 2026-10-04)
Still open: address search (geocoding). Needs a provider decision first: OSM's public Nominatim has a strict usage policy and would send typed addresses to a third party (privacy page update); alternatives are a hosted geocoder with a key.

### FEAT-11 · Customer profile: edit display name, optional phone — P3 · S

## Notifications

### NOTIF-1 · Email notifications — P1 · M — **built (order confirmation, pickup reminder, merchant cutoff summary; Resend, 4 languages); off until the Resend domain/API key are set**: [plans/notif-1-email-notifications.md](plans/notif-1-email-notifications.md)
Order confirmation, cutoff reminder, offering cancelled, "merchant is on the way". **Constraints:** Render free blocks SMTP ports → use an email provider's **HTTPS API** (Resend/Postmark/…); Facebook (and Apple "hide my email") users may have **no usable email** → fall back gracefully; render in the recipient's `profiles.locale` (see I18N-7); add unsubscribe/preferences. Needs a scheduler for reminders (extend the daily job or Supabase pg_cron).

### NOTIF-2 · Web push (PWA) — P2 · M–L
Works on desktop Chrome/Edge/Firefox, desktop Safari, Android Chrome; **iPhone/iPad only on iOS 16.4+ and only after Add to Home Screen**. Needs: service worker, VAPID keys, `push_subscriptions` table, permission prompt on a user gesture, sender (`web-push`), localized payloads. Delivery isn't guaranteed — email stays primary.

## Payments (planned last)

Context: most merchants will take **cash, Venmo or Zelle** to avoid card fees, so start with *manual* tracking; no processor.

### PAY-2 · Prices on foods and order totals — P2 · M  (prerequisite)
Use `food_items.price_cents` (exists, unused) or per-offering price; compute order total in SQL inside `place_order`/`update_order`; show totals to customer and merchant.

### PAY-1 · Manual payment tracking (cash / Venmo / Zelle) — P2 · M
Merchant lists accepted methods + handles (Venmo username, Zelle email/phone) in the merchant profile (translatable); customer sees instructions on the order; merchant marks **paid** (and method); `orders.payment_status` (`none → unpaid → paid`) / `payment_ref` already exist; unpaid-orders view for pickup day; DB tests for who may mark paid.

### PAY-3 · Card payments (Stripe) — P3 · L (only if asked)
Webhook route using the admin client, idempotent; refunds only before cutoff; gate `confirm_pickup` on paid if desired. Recipe in [enhancing.md](enhancing.md#add-payments).

## Quality

### QA-1 · Browser end-to-end tests (Playwright) — P2 · L — **started: 3 journeys run in CI** (customer order → edit → Spanish → cancel; merchant map picker; merchant publishes offering via form + stock limit). Run locally: `supabase start`, `npm run build`, `npm run test:e2e`. Still to add: cutoff-passed errors, QR scan (needs a camera stub)
Run in CI against `supabase start`. Log in without OAuth via admin-created password users (cookie injection works — done manually for smoke tests). Cover: merchant creates offering → customer orders/edits/cutoff → QR scan → language switch.

### QA-2 · Real-device verification — P1 · S (manual) — **checklist ready: [qa-real-device.md](qa-real-device.md); tracked in [todo.md](todo.md)**
iOS Safari and Android Chrome: camera QR scan, GPS sharing, live map, install-to-home-screen, language switcher, Google login. Never tested on devices.

### QA-3 · Native-speaker review of translations — P1 · S — **moved to [todo.md](todo.md)** (needs a native speaker)
Spanish, Simplified and Traditional Chinese were AI-drafted. Review cutoff/pickup/QR wording especially.

### QA-4 · Accessibility & dark-mode pass — P2 · M
Keyboard nav, contrast, labels, focus; check dark mode on all screens.

### QA-5 · Realtime/limits sanity test — P3 · S
Verify behavior near the free-tier 200 concurrent Realtime connections (what customers see when it's exceeded).

## Internationalization

### I18N-3 · "Translate with AI" for merchant text — P3 · M
Optional button in `TranslationFields`; merchant must review before saving (allergen/food accuracy). Needs API key + cost cap. Also translate offering instructions (FEAT-3).

### I18N-4 · More languages — P3 · S each
Recipe in [i18n.md](i18n.md#adding-a-language-eg-french) (needs a migration widening `profiles.locale`).

### I18N-5 · Localize holiday names — P3 · S
Nager.Date returns `localName` and `name`; store/display per locale in reports.

### I18N-6 · Localized PWA manifest — P3 · S
`app/manifest.ts` is English-only.

### I18N-7 · Localized emails/push — P1 with NOTIF-1
Render in `profiles.locale`; add `email.*` namespace to all catalogs.

## Security, privacy & legal

### SEC-1 · Privacy policy & terms pages — P1 · M — **live in 4 languages; contact/operator set (verified 2026-10-04). Open: legal review** — give the reviewer [legal-review-brief.md](legal-review-brief.md); see [legal-pages.md](legal-pages.md)
Required for Facebook login to go **Live**; needed anyway (location sharing, order history). Content needs legal review; make translatable. Link in footer and in provider consoles.

### SEC-2 · Rate limiting / abuse protection — P2 · M
Server actions and `/api/cron/fetch-context` (secret-protected already). Supabase Auth has its own limits; consider per-IP limits at the edge.

### SEC-3 · Security headers (CSP etc.) — P2 · S — **baseline done** (framing, sniffing, base/object/form-action, permissions, HSTS; `lib/security-headers.ts`). Open: nonce-based script-src CSP
Careful with Leaflet tiles (OpenStreetMap), Supabase websockets/HTTPS, inline styles.

### SEC-5 · Account deletion & data export — **P1** · M  (store requirement) — **web implemented**; mobile calls the same rule via an authenticated endpoint (MOB M3/M5); data export still open
Apple 5.1.1(v) and Google Play require **in-app account deletion** for apps with account creation (social-login accounts count). GDPR/CCPA-style too. **Policy:** deletion is blocked while a merchant has upcoming offerings with active orders (close/cancel first); otherwise deleting the account removes the profile, orders, and the merchant with its foods/offerings/pickup points and their past orders (FK cascades fixed in a migration). The auth user is deleted server-side with the admin API (web server action now; an authenticated HTTP endpoint for mobile later). Data export is a later follow-up.

### SEC-8 · Mobile security gate — P1 with MOB · —
The 14-point checklist in [plans/mobile-native-expo.md](plans/mobile-native-expo.md#security-gate-before-each-testflightplay-externalstore-submission) must pass before every TestFlight/Play-external/store submission (encrypted session storage, PKCE, no secrets in bundle, EAS Update code signing, minimal permissions, RLS regression tests…).

### SEC-9 · Record acceptance of the Terms — P2 · S–M — **moved to [todo.md](todo.md)** (waits on the legal review)
Today acceptance is implied ("By continuing you agree…", browsewrap). Add an explicit, versioned acceptance: a checkbox for **merchants** at registration (also "I hold the licences/permits my food business needs") and a first-login prompt for customers; store `terms_accepted_at` + `terms_version` (and re-prompt when `LEGAL_UPDATED` changes materially). Wording and need to be confirmed by the legal review (brief §7, Terms Q4).

### SEC-6 · Public vs private repo — P3 · decision
Repo is public (code visible, Actions free). Private: Actions free-minutes cap (~2000/mo) — CI takes a few minutes per run; required-reviewer environments need a paid plan.

### SEC-7 · Login provider go-live — P1 · S (ops)
Google: **Publish app** (out of Testing). Facebook: privacy URL (SEC-1) then switch to Live. Apple: $99/yr developer account, HTTPS, secret expires ≤ 6 months (OPS-11). GitHub: separate OAuth app per environment. Guide: [social-login-setup.md](social-login-setup.md).

## Platform ideas (maybe never)

- Privacy-friendly analytics.
- Locale-prefixed URLs if per-language SEO ever matters.
- Right-to-left language support.
- Multi-currency / sales tax once payments exist.

---

## Done

- Food photos (FEAT-2, 2026-10-04): resized in the browser, location data stripped on the server, owner-only storage policies; verified on a phone.
- Edit, duplicate and delete offerings (FEAT-1, 2026-10-04) — see [plans/feat-1-edit-clone-offerings.md](plans/feat-1-edit-clone-offerings.md); also closed a data-safety gap (offering delete could cascade to customers' orders).
- Account deletion on web (SEC-5, 2026-10-04) — mobile reuses the same rule later.
- Privacy policy & terms pages in 4 languages (SEC-1 text, 2026-10-04) — still needs your Render settings and a legal review.
- Health endpoint `/api/health` (OPS-2 endpoint) and Sentry error reporting (OPS-3), live 2026-10-04.
- Encrypted daily database backup workflow (OPS-1) — runs once `BACKUP_PASSPHRASE` is set.
- Multi-language (en/es/zh-CN/zh-TW) + merchant translations — see [i18n.md](i18n.md).
- Free deployment (Render + hosted Supabase) with CI/CD — see [deployment.md](deployment.md).
- Social login (Google; Facebook/GitHub/Apple supported in code) — see [social-login-setup.md](social-login-setup.md).
