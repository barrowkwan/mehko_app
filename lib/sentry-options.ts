import type { BrowserOptions } from "@sentry/nextjs";
import { scrubEvent } from "./sentry-scrub";

export type SentryEnv = {
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;
  NEXT_PUBLIC_SENTRY_RELEASE?: string;
  NODE_ENV?: string;
};

// Shared by the server and browser SDK. Error monitoring only:
//  * no DSN  => disabled (nothing is sent, nothing breaks);
//  * no performance traces, no session replay;
//  * no automatic user info, cookies, headers, bodies, query strings or local variables;
//  * remaining text is scrubbed by scrubEvent (emails, tokens, secrets).
export function buildSentryOptions(env: SentryEnv): BrowserOptions {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
    release: env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "AbortError", /ResizeObserver loop/],
    beforeSend: (event) => scrubEvent(event),
  };
}
