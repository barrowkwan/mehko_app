# NOTIF-1 · Email notifications

**Status:** Planned — design check done 2026-10-04 (see "Open decisions"). The pipeline can be built and tested before real delivery is enabled; **real delivery needs a domain you own**.
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

## Open decisions (owner)
1. **Domain:** do you own one, will you buy one, or should the pipeline be built now with delivery switched off (dry-run) until you have one?
2. **Provider:** Resend (recommended) or Brevo.
3. **Which emails in v1:** order confirmation · pickup reminder · merchant cutoff summary · "merchant is on the way".

## Tasks
- [ ] Decisions above
- [ ] Migration: outbox, preferences, producers, pg_cron schedule (hosted only)
- [ ] Sender route + provider adapters + templates (4 languages) with tests (fake provider receiver)
- [ ] Account toggle + signed unsubscribe
- [ ] Privacy policy / brief, docs
- [ ] End-to-end locally (dry-run + fake receiver); enable on production when the domain is verified

## Verification
DB tests for producers/dedupe; template tests per language; adapter tests against a fake HTTP receiver (as done for Sentry); a full local run (place order → outbox → sender → captured email). Real delivery is verified once with your own mailbox after DNS is set.

## Rollout notes
Starts disabled (`dry-run`). Enabling = set the provider env vars in Render and the SPF/DKIM DNS records at the domain. Free-tier ceiling: 100 emails/day on Resend.
