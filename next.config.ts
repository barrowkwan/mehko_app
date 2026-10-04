import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  env: {
    // Render exposes the deployed commit; used to group Sentry errors by release (optional).
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.RENDER_GIT_COMMIT ?? "",
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Sentry only uploads source maps when SENTRY_AUTH_TOKEN (+ org/project) are set at build time;
// without them the build is unchanged. Runtime reporting needs only NEXT_PUBLIC_SENTRY_DSN.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
