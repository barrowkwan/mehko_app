import * as Sentry from "@sentry/nextjs";
import { buildSentryOptions } from "@/lib/sentry-options";
import { readSentryEnv } from "@/lib/sentry-env";

// Browser-side error monitoring (same switch and privacy settings as the server).
Sentry.init(buildSentryOptions(readSentryEnv()));
