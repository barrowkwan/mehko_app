import * as Sentry from "@sentry/nextjs";
import { buildSentryOptions } from "@/lib/sentry-options";
import { readSentryEnv } from "@/lib/sentry-env";

// Server-side error monitoring. Disabled unless NEXT_PUBLIC_SENTRY_DSN is set (docs/monitoring.md).
// console.error calls are reported too: unmapped database errors and failed account deletions log that way.
Sentry.init({
  ...buildSentryOptions(readSentryEnv()),
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
