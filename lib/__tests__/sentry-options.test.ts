import { describe, expect, it } from "vitest";
import { buildSentryOptions } from "../sentry-options";

describe("buildSentryOptions", () => {
  it("is disabled without a DSN", () => {
    const o = buildSentryOptions({});
    expect(o.enabled).toBe(false);
    expect(o.dsn).toBeUndefined();
  });
  it("is disabled for a blank DSN", () => {
    expect(buildSentryOptions({ NEXT_PUBLIC_SENTRY_DSN: "   " }).enabled).toBe(false);
  });
  it("is enabled with a DSN, trimmed", () => {
    const o = buildSentryOptions({ NEXT_PUBLIC_SENTRY_DSN: " https://k@o1.ingest.sentry.io/2 " });
    expect(o.enabled).toBe(true);
    expect(o.dsn).toBe("https://k@o1.ingest.sentry.io/2");
  });
  it("reads environment and release, with a sensible default", () => {
    expect(buildSentryOptions({ NODE_ENV: "production" }).environment).toBe("production");
    expect(buildSentryOptions({ NODE_ENV: "development" }).environment).toBe("development");
    expect(buildSentryOptions({ NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging" }).environment).toBe("staging");
    expect(buildSentryOptions({ NEXT_PUBLIC_SENTRY_RELEASE: "abc123" }).release).toBe("abc123");
  });
  it("sends no performance traces (error monitoring only, keeps the free quota for errors)", () => {
    expect(buildSentryOptions({}).tracesSampleRate).toBe(0);
  });
  it("locks down automatic data collection", () => {
    const d = buildSentryOptions({}).dataCollection!;
    expect(d.userInfo).toBe(false);
    expect(d.cookies).toBe(false);
    expect(d.httpHeaders).toBe(false);
    expect(d.httpBodies).toEqual([]);
    expect(d.urlQueryParams).toBe(false);
    expect(d.stackFrameVariables).toBe(false);
  });
  it("installs the scrubber on events", () => {
    const o = buildSentryOptions({});
    expect(typeof o.beforeSend).toBe("function");
    const out = o.beforeSend!({ message: "x@y.com", user: { id: "1" } } as never, {} as never) as { message: string; user?: unknown };
    expect(out.message).toBe("[email]");
    expect(out.user).toBeUndefined();
  });
});
