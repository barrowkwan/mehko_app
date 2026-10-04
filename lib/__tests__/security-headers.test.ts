import { describe, expect, it } from "vitest";
import { securityHeaders } from "../security-headers";

const get = (isProd: boolean, key: string) => securityHeaders(isProd).find((h) => h.key === key)?.value;

describe("securityHeaders", () => {
  it("forbids framing and plugin/base-tag injection", () => {
    const csp = get(true, "Content-Security-Policy")!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(get(true, "X-Frame-Options")).toBe("DENY");
    expect(get(true, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps the camera and location the app needs, and nothing else", () => {
    const p = get(true, "Permissions-Policy")!;
    expect(p).toContain("camera=(self)");
    expect(p).toContain("geolocation=(self)");
    expect(p).toContain("microphone=()");
  });

  it("sends HSTS only in production", () => {
    expect(get(true, "Strict-Transport-Security")).toContain("max-age=");
    expect(get(false, "Strict-Transport-Security")).toBeUndefined();
  });
});
