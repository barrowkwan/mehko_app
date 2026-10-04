import type { SentryEnv } from "./sentry-options";

// Next.js only inlines NEXT_PUBLIC_* values into browser code when they are written as literal
// `process.env.NEXT_PUBLIC_X` expressions, so they must be listed one by one (not passed as `process.env`).
export function readSentryEnv(): SentryEnv {
  return {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    NODE_ENV: process.env.NODE_ENV,
  };
}
