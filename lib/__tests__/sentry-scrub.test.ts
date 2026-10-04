import { describe, expect, it } from "vitest";
import { redactText, scrubEvent, stripUrlQuery } from "../sentry-scrub";

describe("redactText", () => {
  it("redacts email addresses", () => {
    expect(redactText("failed for jane.doe+x@example.co.uk today")).toBe("failed for [email] today");
  });
  it("redacts JWTs and long hex tokens (QR tokens, API secrets)", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc_DEF-123";
    expect(redactText(`token ${jwt} end`)).toBe("token [token] end");
    const qr = "a".repeat(64);
    expect(redactText(`order token=${qr}`)).toBe("order token=[token]");
  });
  it("redacts Supabase-style API keys", () => {
    // Fake keys in a real key's format, assembled at runtime so secret scanners don't flag this file.
    const fakeKey = (kind: "secret" | "publishable") => ["sb", kind, "FAKEFAKEFAKE-fake_fakeFAKE00"].join("_");
    expect(redactText(`key ${fakeKey("secret")} used`)).toBe("key [token] used");
    expect(redactText(fakeKey("publishable"))).toBe("[token]");
  });
  it("keeps ordinary text, UUIDs and short hex", () => {
    const s = "Order 8b1e436e-79ca-4065-aceb-c040f868f8d5 failed, code abc123";
    expect(redactText(s)).toBe(s);
  });
});

describe("stripUrlQuery", () => {
  it("removes query string and hash but keeps path", () => {
    expect(stripUrlQuery("https://x.test/orders/1?code=abc&next=%2F#frag")).toBe("https://x.test/orders/1");
    expect(stripUrlQuery("/auth/callback?code=secret")).toBe("/auth/callback");
  });
  it("leaves clean URLs alone", () => {
    expect(stripUrlQuery("https://x.test/login")).toBe("https://x.test/login");
  });
});

describe("scrubEvent", () => {
  const event = {
    message: "Error for a@b.com",
    user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4", username: "amy" },
    request: {
      url: "https://x.test/auth/callback?code=secret#h",
      query_string: "code=secret",
      cookies: { "sb-127-auth-token": "base64-abc" },
      headers: { cookie: "x=y", authorization: "Bearer eyJabc.def.ghi", "user-agent": "UA" },
      data: { password: "p" },
    },
    exception: { values: [{ type: "Error", value: "bad token aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa for e@x.io" }] },
    breadcrumbs: [
      { message: "fetch https://x.test/api?token=zzz", data: { url: "https://x.test/orders?x=1", method: "GET" } },
      { category: "console", message: "user bob@x.io" },
    ],
  };

  it("drops user, cookies, headers, body and query string", () => {
    const out = scrubEvent(structuredClone(event))!;
    expect(out.user).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.url).toBe("https://x.test/auth/callback");
  });

  it("redacts secrets/emails in message, exception text and breadcrumbs", () => {
    const out = scrubEvent(structuredClone(event))!;
    expect(out.message).toBe("Error for [email]");
    expect(out.exception?.values?.[0].value).toBe("bad token [token] for [email]");
    expect(out.breadcrumbs?.[0].message).toBe("fetch https://x.test/api");
    expect((out.breadcrumbs?.[0].data as { url: string }).url).toBe("https://x.test/orders");
    expect(out.breadcrumbs?.[1].message).toBe("user [email]");
  });

  it("never returns null (events are still sent) and tolerates sparse events", () => {
    expect(scrubEvent({})).toEqual({});
    expect(scrubEvent({ request: {} })).toEqual({ request: {} });
  });
});
