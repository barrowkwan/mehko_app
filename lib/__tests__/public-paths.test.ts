import { describe, expect, it } from "vitest";
import { isPublicPath } from "../public-paths";

describe("isPublicPath", () => {
  it.each(["/login", "/auth/callback", "/auth/signout", "/privacy", "/terms", "/privacy/", "/terms/", "/api/health"])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });
  it.each(["/", "/orders", "/account", "/merchant", "/merchant/foods", "/offerings/abc"])("%s requires login", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
  it("does not match look-alike prefixes", () => {
    expect(isPublicPath("/privacy-evil")).toBe(false);
    expect(isPublicPath("/termsx")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/account/privacy")).toBe(false);
    expect(isPublicPath("/api/health-check-evil")).toBe(false);
    expect(isPublicPath("/api/healthz")).toBe(false);
  });
});
