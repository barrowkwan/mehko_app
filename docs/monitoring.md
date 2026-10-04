# Monitoring: uptime (OPS-2) and error reporting (OPS-3)

Two independent tools. **Uptime** answers "is the site up and is the database reachable?". **Sentry** answers "what error did a user hit and where?". Both are optional and free to start; both are **off until you set them up**.

## 1. Uptime monitoring

**Endpoint:** `GET https://mehko-app.onrender.com/api/health` (public, no login). It runs a tiny real query (`profiles?select=id&limit=1`, empty for anonymous callers thanks to row-level security) with the public key.
- `200` `{"status":"ok","app":"up","database":"ok"}` — site is up **and** Supabase answers.
- `503` `{"status":"degraded","database":"down"}` — site is up but Supabase is unreachable or misconfigured (this is what a **paused free-tier Supabase project** looks like).
- No answer / timeout — the site itself is down or Render is cold-starting (free Render sleeps after ~15 min idle; a first request can take ~1 minute).

**Pick a monitor** (verify current terms before signing up; checked October 2026):

| Service | Free plan | Notes |
| --- | --- | --- |
| [Better Stack](https://betterstack.com/uptime) | 10 monitors, 3-minute checks, 1 status page | Recommended: no non-commercial restriction found, email/phone alerts, incident timeline |
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5-minute checks | Free plan is **personal, non-commercial use only** (since Dec 2024). A business app needs a paid plan ($7/mo+) |
| Self-hosted Uptime Kuma | Free | You must run and keep it up yourself — not on the same host you monitor |

**Setup (any service):**
1. Create a monitor: type **HTTP(S)**, URL `https://mehko-app.onrender.com/api/health`, interval 3–5 min.
2. Alert when: status is not `200` (or, with keyword monitoring, the response lacks `"status":"ok"`). Require 2 failed checks before alerting to avoid noise from cold starts.
3. Add your email (and phone/SMS if offered) as the alert contact; send yourself a test alert.
4. Optional: a second monitor for the login page `https://mehko-app.onrender.com/login`.
5. Optional: public status page.

**Side benefits:** a 3–5 minute check keeps the free Render service awake (no cold starts during the day). That uses ~744 of the 750 free instance-hours per month — fine only while it is your **only** free Render service. The check also touches Supabase, so it prevents the project being paused for inactivity.

## 2. Error monitoring with Sentry

**What it does:** reports unexpected errors (server components, route handlers, server actions, the auth gate, and browser errors) with a stack trace, so you learn about problems from Sentry instead of from users. Also reports `console.error` calls on the server — e.g. unmapped database errors and failed account deletions.

**What it never sends** (enforced in code and tested — `lib/sentry-options.ts`, `lib/sentry-scrub.ts`): user id/email/IP, cookies, request headers, request bodies, query strings, local variable values, performance traces, session replays. Remaining text is scrubbed of emails, JWTs, API keys and long tokens (QR order tokens). The privacy policy lists Sentry as a service provider.

**Free plan** (checked October 2026): Developer plan, **5,000 errors/month**, 30-day retention, 1 user, email alerts. Check the data region (US/EU) when you create the organization — you cannot change it later.

### Setup (about 10 minutes)
1. Create a free account and organization at <https://sentry.io> (choose the data region), then **Create Project** → platform **Next.js**. Skip the "wizard" and don't install anything: the code is already in the repo.
2. Copy the project's **DSN** (Settings → Projects → your project → *Client Keys (DSN)*). A DSN is not a secret; it only lets someone *send* events.
3. In **Render → mehko-app → Environment** add `NEXT_PUBLIC_SENTRY_DSN=<your DSN>` → *Save, rebuild and deploy* (it is baked in at build time).
4. Verify (after the deploy finishes). One command runs all checks and prints PASS/FAIL for each (it never prints your secret):
   ```bash
   CRON_SECRET='<the same value as in Render>' scripts/verify-sentry.sh
   # or for another host: CRON_SECRET=… scripts/verify-sentry.sh https://your-domain.example
   ```
   It checks (1) `/api/health` is 200, (2) a test message is sent and `"sentryEnabled":true` (if `false`, the DSN was not present at build time), (3) a deliberate server error returns 500. Within about a minute Sentry → **Issues** shows two events: *"Sentry test message…"* and *"Sentry test: deliberate server error…"*.
   Manual equivalent: `curl -H "Authorization: Bearer $CRON_SECRET" "https://mehko-app.onrender.com/api/cron/sentry-test?mode=message"` (and `?mode=throw`).
5. In Sentry: **Alerts → Create Alert → Issues**: "when a new issue is created" → email you. Optionally set a spike alert.
6. Resolve or archive the two test issues.

### Optional: readable stack traces (source maps)
Without it, production stack traces point at minified code. To upload source maps at build time add in Render: `SENTRY_AUTH_TOKEN` (Sentry → Settings → Developer Settings → Auth Tokens, scope *project:releases* / *org:read*), `SENTRY_ORG`, `SENTRY_PROJECT` (slugs). Without the token nothing is uploaded and the build is unchanged. Source-map upload is only exercised at real build time and was **not tested** here.

### Turning it off or changing it
Remove `NEXT_PUBLIC_SENTRY_DSN` and redeploy: the SDK becomes inert (no network calls). Behavior lives in `lib/sentry-options.ts` (the privacy settings), `lib/sentry-scrub.ts` (redaction), `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `app/global-error.tsx`, `app/error.tsx`.

## Not covered yet
Mobile app crash reporting (will use the same Sentry project via the Expo SDK — MOB plan), log aggregation, performance monitoring, paging/on-call.
