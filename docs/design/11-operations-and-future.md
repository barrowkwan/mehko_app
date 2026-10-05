# 11 · Operations, limits and the future

What it takes to *run* the app, where it will hit limits first, what is planned, and a first-week plan for a new engineer. Backlog details: [`../roadmap.md`](../roadmap.md); things waiting on people: [`../todo.md`](../todo.md); plans: [`../plans/`](../plans/README.md).

## 1. Routine operations

| When | Task | Where |
| --- | --- | --- |
| **Every deploy** | Watch the CI run (latest run, not a cancelled older one); after "Deploy" is green wait for Render **Live**; smoke-test the changed feature | GitHub Actions, Render |
| **Daily (automatic)** | Weather/holiday snapshot + stale-location wipe; encrypted backup | `scheduled.yml`, `backup.yml` |
| **Every 10 min (automatic)** | Queue and send due emails | `notifications.yml` |
| **Weekly** | Review Dependabot PRs (grouped); merge after CI is green; for GitHub Actions *major* bumps, watch the deploy job and run Backup once by hand | GitHub PRs |
| **Weekly** | Triage Sentry issues; check uptime history; glance at Supabase usage (DB size, MAU) and Resend/Geoapify quotas | dashboards |
| **Monthly** | Check backup artifacts exist and decrypt a recent one locally; confirm Render instance-hours are not near the free limit | `docs/backup-restore.md` |
| **Every ≤ 6 months** | **Rotate the Apple client secret** (it expires) | `docs/social-login-setup.md`, roadmap OPS-11 |
| **Once, soon** | Rehearse a **restore** into a throw-away Supabase project | todo OPS-1 |
| **Before first real merchants** | Legal review of privacy/terms; real-device QA; native translation review | `docs/todo.md` |

## 2. Runbook snippets

| Situation | First actions |
| --- | --- |
| **Site down / very slow** | Is it a Render cold start (first request after idle)? Check Render deploy status and logs; `/api/health` JSON tells whether the database is reachable |
| **Everything errors, health 503 "database down"** | Supabase project paused or in trouble: open the dashboard, restore the project; make sure the daily job/monitor are running |
| **Bad deploy** | Render can redeploy a previous commit; if a migration was the cause, write a **new** forward migration (do not edit applied ones). Take a backup first |
| **A merchant says an order vanished** | Check `orders` by order number (`m00001-…`) in Supabase Studio; remember cancelled orders are kept with status `cancelled` |
| **Emails not arriving** | `notification_outbox` rows: status/last_error; verify domain, `NOTIFICATIONS_*` env, `NOTIFICATIONS_ENABLED` variable, Resend dashboard |
| **Facebook shows no preview** | Re-scrape in the Sharing Debugger; confirm the offering has "Share publicly" on |
| **Suspected key leak** | Rotate immediately (Supabase keys, `CRON_SECRET`, provider keys); check GitHub secret scanning; review recent logs |
| **User asks to delete data** | They can self-serve in Account; if blocked (merchant with upcoming orders) the page says why |

## 3. Capacity and where it breaks first

| Component | Comfortable range today | First symptom of strain | Remedy |
| --- | --- | --- | --- |
| Render free instance | tens of concurrent users (single small instance) | slow responses, cold starts | paid instance (no sleep), then larger/instances |
| Supabase free DB | hundreds of merchants, thousands of orders; 500 MB | size warnings; pausing | Pro plan; archive/aggregate old data |
| Realtime | ~200 concurrent connections (free) | live map stops updating | Pro; reduce subscriptions |
| Browse page | few dozen merchants | slower first paint (loads all open offerings, groups in code) | FEAT-13: group in SQL, paginate, search |
| Place search | 3,000/day | "unavailable" message | paid plan or provider swap |
| Email | 100/day | failures/retries | paid plan |
| Order numbering | counter row lock per offering | contention only if thousands of simultaneous orders on *one* offering | not a concern at this scale |

The architecture scales **vertically** easily (bigger Render + Supabase plans). Horizontal scaling is possible because the Next.js server is stateless; the only in-memory state (place-search cache/rate limit) is a convenience and can move to a shared store (SEC-2).

## 4. Known limitations and technical debt

- No staging environment; first contact with real data is production (OPS-6).
- Backups never test-restored on hosted (todo).
- No shared rate limiter or WAF (SEC-2); CSP lacks `script-src` (SEC-3).
- Weather API licence for commercial use unverified (OPS-10).
- Translations (es, zh-CN, zh-TW) not native-reviewed; legal texts AI-drafted (todo).
- Web only: live location pauses when the page is closed or the screen locks; no push notifications.
- Types and docs must be kept in sync by hand (OPS-12: CI check for DB/type drift).
- Single operator knowledge: runbooks and secrets in one person's accounts: use a team password manager and add a second admin on Supabase/Render/GitHub.

## 5. Roadmap themes

| Theme | Items (see roadmap for status) |
| --- | --- |
| **Safe to run for real** | legal review, backup rehearsal, real-device QA, provider go-live (Google publish, Facebook Live, Apple), custom domain, uptime/Sentry already live |
| **Merchant usefulness** | reports upgrades, merchant-initiated cancellations with notice, sold-out indicators, staff accounts, shareable QR poster, Browse pagination/search |
| **Keep customers informed** | email (built), web push (NOTIF-2), later native push |
| **Quality** | more Playwright journeys, accessibility/dark-mode pass, staging, deploy approval gate, drift detection |
| **Payments (last, by decision)** | PAY-1 manual cash/Venmo/Zelle tracking → PAY-3 cards via Stripe only if asked (prices/totals already exist) |
| **Native mobile** | Expo/React Native app next to the web app ("Plan A": two UIs, shared packages) |

### The native app plan in one page ([`../plans/mobile-native-expo.md`](../plans/mobile-native-expo.md))

- **Why:** push notifications that really arrive, native camera/GPS, store presence.
- **Approach (Plan A):** keep the Next.js web app; add `apps/mobile` (Expo) and shared packages (`core` types/helpers, `messages`, a `data` layer returning typed results). The mobile app talks to Supabase **directly with the public key**, which is only safe because rules live in the database ([03](03-database-supabase.md)). Server actions are not callable from mobile, hence the shared data layer.
- **Store requirements that shape today's choices:** in-app **account deletion** (done), privacy policy URL (done), **Sign in with Apple** if other social logins are offered, accurate permission strings, no background location in v1.
- **Rejected:** a single universal Expo codebase (bigger rewrite, loses the server layer) and a WebView wrapper (store-review risk, depends on a sleeping host).

## 6. Principles to keep when extending

1. New rule → SQL first, with tests for each role.
2. New exposure of data → opt-in, whitelisted, documented in the privacy policy.
3. New dependency/vendor → adapter, env switch, graceful absence, fake in tests, quota noted.
4. New migration → backward compatible with the running site; never edit an applied one.
5. New string → four languages.
6. Keep docs current; move backlog items through *plan → done*.

## 7. First-week plan for a new engineer

| Day | Do | Outcome |
| --- | --- | --- |
| 1 | Read this guide's README, 01 and 03 (§1–6). Clone, `npm ci`, install Docker, `supabase start`, `npm run dev`; sign in with a seeded or password user | You can run the app locally |
| 2 | Read 04 and 07 (§2–3). Place an order as a customer and view it as the merchant; read `place_order` in the migrations | You understand the central rule path |
| 3 | Read 09. Run all four test layers. Write one new `tests/db` test (a refusal case) | You can change SQL safely |
| 4 | Read 10. Add a tiny UI string in all four languages behind a harmless element; run e2e | You know the front-end conventions |
| 5 | Read 05 and 06. Trace a CI run and a deploy; review a Dependabot PR; pick a small roadmap item (e.g. an e2e journey from QA-1) | You can contribute and ship |

## 8. FAQ

**Why isn't there an admin panel?** Not needed yet: Supabase Studio and GitHub cover operations; add one when support load justifies it.
**Can a merchant have staff?** Not yet (FEAT-9). Today the owner scans QR codes.
**Why are prices optional?** Some merchants only want to take pre-orders; totals appear only when something is priced.
**Why no card payments?** Product decision: payments last; most merchants use cash/Venmo/Zelle and want to avoid card fees.
**Is the public repo a problem?** It makes secrets hygiene critical (push protection, encrypted backups) and keeps Actions free; moving to private trades that for capped free minutes (SEC-6).
**Where do I record a decision?** [`../decisions.md`](../decisions.md) for gotchas/decisions, a file in [`../plans/`](../plans/README.md) for a feature, and update the relevant document in this guide if the *reasoning* changed.
