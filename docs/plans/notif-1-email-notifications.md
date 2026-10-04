# NOTIF-1 · Email notifications

**Status:** In progress (started 2026-10-04). Decisions made: owner **has a domain**, provider **Resend**, v1 emails = **order confirmation, pickup reminder, merchant cutoff summary** ("merchant is on the way" deferred). The pipeline starts in `dry-run` mode; real delivery is switched on after the domain is verified in Resend.
**Roadmap items:** NOTIF-1 (+ OPS-8 custom domain, I18N-7 localized emails)   **Size:** M–L   **Owner:** Claude + product owner

## Goal
Customers get an order confirmation and a pickup reminder; merchants get a summary of the orders (with allergy notes) when ordering closes. Emails are in the recipient's language, can be turned off, and never include more than needed.

## Findings from the design check
| Topic | Finding | Consequence |
| --- | --- | --- |
| Hosting | Render's free tier blocks SMTP ports (25/465/587) | Use an email provider's **HTTPS API** |
| Provider | **Resend** free: 3,000/month, **100/day**, up to 3 domains, **a verified domain is required to send to real recipients** (without it: only to your own address). **Brevo** free: 300/day. Postmark has no real free tier; Mailgun's free tier is small | Pick Resend (simple API, good deliverability tooling) or Brevo (higher daily cap) |
| Domain | SPF/DKIM must pass for inbox delivery; sending "from" a Gmail/free-mail address fails DMARC and lands in spam | **Own a domain** (~$10–15/yr). It also gives `privacy@yourdomain` for the legal pages (OPS-8) |
| Missing emails | Facebook may not return an email; Apple may return a **private-relay** address (to reach it the sending domain must be registered with Apple, needs the paid developer account and SPF/DKIM) | Skip users without a usable email (recorded, not an error); relay users work once the domain is registered |
| Timeliness | GitHub Actions cron is ≥5 min and often delayed; Render free sleeps | Use Supabase **pg_cron + pg_net** to poke the sender every few minutes, plus an immediate best-effort send after a web order |

## Design
- **Outbox table** `notification_outbox` (user, type, entity id, payload, locale snapshot, due time, status, attempts, last error). **Unique (type, entity, user)** so a notification is never queued twice.
- **Producers (in the database, so web and future mobile behave the same):**
  - `order_confirmed` — trigger on order insert.
  - `pickup_reminder` — SQL function run by pg_cron: orders whose pickup starts within ~3 h.
  - `merchant_cutoff_summary` — once per offering after the cutoff if it has active orders: totals + **customer notes**.
  - (optional) `merchant_on_the_way` — first time live location is switched on, to customers with an active order.
- **Sender** — `/api/cron/send-notifications` (secret-protected like the other cron routes): takes due rows, looks up the recipient's email (admin API) and language, renders the template, sends via the provider, marks sent / retries with back-off (max 5) / `no_email`.
- **Provider abstraction:** `sendEmail({to, subject, html, text, headers})` with adapters: Resend (HTTPS), Brevo (HTTPS), and a **dry-run** adapter that only logs (used until a domain exists).
- **Templates:** plain, accessible HTML + text, strings in `messages/*.json` (`email.*`) in all four languages, rendered with the same ICU formatter; dates/times in the pickup point's timezone (`formatInstant`).
- **Controls:** `profiles.email_notifications` (default on) toggle on the Account page; every email has an **unsubscribe link** (signed token, works without login) and a `List-Unsubscribe` header; daily per-user cap; no notes in customer emails (notes appear only in the merchant summary).
- **Privacy:** email provider added to the privacy policy (processor) and legal brief; emails contain order details only.
- **Config (env):** `NOTIFICATIONS_PROVIDER` (`dry-run` | `resend` | `brevo`), `EMAIL_API_KEY`, `EMAIL_FROM`, `UNSUBSCRIBE_SECRET`, reuse `CRON_SECRET`.

## Scope
- In: outbox + producers, sender route, provider adapters (Resend/Brevo/dry-run), 4-language templates, preferences + unsubscribe, privacy text, tests (DB, templates, fake provider receiver), docs.
- Out: SMS/push (NOTIF-2, mobile), marketing email, merchant→customer broadcast, rich HTML design, bounce/complaint handling dashboards (provider's own).

## Platform split
- **Shared:** outbox/producers (SQL), templates and messages, provider adapter.
- **Web:** Account toggle, unsubscribe page, sender route.
- **Mobile:** none for email (push later).

## Decisions (owner, 2026-10-04)
1. Domain: **already owned** — add the DNS records Resend gives you; sender e.g. `Neighborhood Eats <orders@yourdomain>`.
2. Provider: **Resend** (free: 3,000/month, max 100/day).
3. v1 emails: order confirmation · pickup reminder · merchant orders summary at cutoff. Deferred: "merchant is on the way".

## Scheduling (refined)
Producers that depend on time (pickup reminder, cutoff summary) run in `enqueue_due_notifications()`, called at the start of every sender run. The sender is poked every ~10 minutes by a scheduled GitHub Action (`notifications.yml`, free, no secrets stored in the database) and immediately after a web order via Next's `after()`. pg_cron + pg_net is a later optimization (needs the app URL and secret inside the database).

## Tasks
- [x] Decisions above
- [x] Migration: outbox, preferences, producers (scheduling via GitHub Action instead of pg_cron)
- [x] Sender route + provider adapters + templates (4 languages) with tests
- [x] Account toggle + signed unsubscribe
- [x] Privacy policy, docs
- [x] Live local end-to-end (outbox → store → processor)
- [ ] Enable on production (see "Turning it on" below)

## Turning it on
1. Resend: add your domain, add the SPF/DKIM DNS records it shows, create an API key.
2. Render env: `NOTIFICATIONS_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` (e.g. `Neighborhood Eats <orders@yourdomain>`), `UNSUBSCRIBE_SECRET` (long random string), optionally `EMAIL_REPLY_TO`, `NEXT_PUBLIC_SITE_URL`.
3. GitHub repo variable `NOTIFICATIONS_ENABLED=true` (starts the 10-minute sender; needs `CRON_SECRET`/`SITE_URL`/`DEPLOY_ENABLED` already set).
4. Try `NOTIFICATIONS_PROVIDER=dry-run` first (logs only), then place an order with your own account.

## Verification
DB tests for producers/dedupe; template tests per language; adapter tests against a fake HTTP receiver (as done for Sentry); a full local run (place order → outbox → sender → captured email). Real delivery is verified once with your own mailbox after DNS is set.

## Rollout notes
Starts disabled (`dry-run`). Enabling = set the provider env vars in Render and the SPF/DKIM DNS records at the domain. Free-tier ceiling: 100 emails/day on Resend.
