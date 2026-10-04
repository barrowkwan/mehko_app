import { describe, expect, it } from "vitest";
import { isPublicPath } from "../public-paths";

describe("isPublicPath", () => {
  it.each(["/login", "/auth/callback", "/auth/signout", "/privacy", "/terms", "/privacy/", "/terms/", "/api/health", "/unsubscribe", "/api/unsubscribe", "/o/m00001-000001"])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });
  it.each(["/", "/orders", "/account", "/merchant", "/merchant/foods", "/offerings/abc", "/merchants/abc"])("%s requires login", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
  it("does not match look-alike prefixes", () => {
    expect(isPublicPath("/privacy-evil")).toBe(false);
    expect(isPublicPath("/termsx")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/account/privacy")).toBe(false);
    expect(isPublicPath("/api/health-check-evil")).toBe(false);
    expect(isPublicPath("/api/healthz")).toBe(false);
    expect(isPublicPath("/unsubscribe-all")).toBe(false);
    expect(isPublicPath("/api/unsubscribe-everyone")).toBe(false);
    expect(isPublicPath("/offerings/o/abc")).toBe(false);
    expect(isPublicPath("/orders")).toBe(false); // "/o" must not make "/orders" public
    expect(isPublicPath("/oauth")).toBe(false);
    expect(isPublicPath("/api/cron/send-notifications")).toBe(false); // protected by its own secret, not public
  });
});
