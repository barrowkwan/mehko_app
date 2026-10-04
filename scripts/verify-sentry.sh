#!/usr/bin/env bash
# Verifies the Sentry setup end to end (docs/monitoring.md, step 4).
#   CRON_SECRET='<same value as in Render>' scripts/verify-sentry.sh [site-url]
# Default site: https://mehko-app.onrender.com. The secret is only sent as a header and never printed.
set -uo pipefail

SITE="${1:-https://mehko-app.onrender.com}"
SITE="${SITE%/}"
: "${CRON_SECRET:?Set CRON_SECRET (the same value as in Render), e.g. CRON_SECRET=… scripts/verify-sentry.sh}"

fail=0
say() { printf '%s\n' "$*"; }

say "Site: $SITE"
say ""
say "1) Health (site up and database reachable)"
code=$(curl -s -m 120 -o /tmp/verify-health.json -w '%{http_code}' "$SITE/api/health")
if [ "$code" = "200" ]; then say "   PASS  /api/health -> 200 $(cat /tmp/verify-health.json)"; else say "   FAIL  /api/health -> $code $(cat /tmp/verify-health.json 2>/dev/null)"; fail=1; fi

say ""
say "2) Test message (is NEXT_PUBLIC_SENTRY_DSN present in the deployed build?)"
code=$(curl -s -m 120 -H "Authorization: Bearer $CRON_SECRET" -o /tmp/verify-msg.json -w '%{http_code}' "$SITE/api/cron/sentry-test?mode=message")
body=$(cat /tmp/verify-msg.json 2>/dev/null)
if [ "$code" = "401" ]; then
  say "   FAIL  401 unauthorized: CRON_SECRET does not match the one configured in Render"; fail=1
elif [ "$code" != "200" ]; then
  say "   FAIL  HTTP $code $body"; fail=1
elif printf '%s' "$body" | grep -q '"sentryEnabled":true'; then
  say "   PASS  Sentry is enabled and a test message was sent: $body"
else
  say "   FAIL  Sentry is NOT enabled: $body"
  say "         Add NEXT_PUBLIC_SENTRY_DSN in Render and choose 'Save, rebuild and deploy' (it is baked in at build time)."
  fail=1
fi

say ""
say "3) Deliberate server error (expect HTTP 500; checks automatic error capture)"
code=$(curl -s -m 120 -H "Authorization: Bearer $CRON_SECRET" -o /dev/null -w '%{http_code}' "$SITE/api/cron/sentry-test?mode=throw")
if [ "$code" = "500" ]; then say "   PASS  server returned 500 as expected"; else say "   FAIL  expected 500, got $code"; fail=1; fi

say ""
if [ "$fail" = "0" ]; then
  say "All checks passed. In Sentry open Issues: within about a minute you should see 2 new events"
  say "('Sentry test message…' and 'Sentry test: deliberate server error…'). Resolve or archive them."
else
  say "Some checks failed (see above)."
fi
rm -f /tmp/verify-health.json /tmp/verify-msg.json
exit "$fail"
