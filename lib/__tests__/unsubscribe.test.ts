import { describe, expect, it } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "../notifications/unsubscribe";

const SECRET = "test-secret-with-enough-length-0123456789";
const USER = "00000000-0000-0000-0000-0000000000c1";

describe("unsubscribe tokens", () => {
  it("round-trips a user id", () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(USER, SECRET), SECRET)).toBe(USER);
  });
  it("rejects a token signed with another secret, a tampered id or signature, and junk", () => {
    const t = signUnsubscribeToken(USER, SECRET);
    expect(verifyUnsubscribeToken(t, "another-secret-another-secret-123456")).toBeNull();
    const [id, sig] = t.split(".");
    const otherId = Buffer.from("00000000-0000-0000-0000-0000000000c2").toString("base64url");
    expect(verifyUnsubscribeToken(`${otherId}.${sig}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${id}.${sig.slice(0, -2)}xx`, SECRET)).toBeNull();
    for (const junk of ["", "abc", "a.b.c", ".", "..", `${id}.`, `.${sig}`]) expect(verifyUnsubscribeToken(junk, SECRET), junk).toBeNull();
  });
  it("only accepts UUID subjects", () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken("not-a-uuid", SECRET), SECRET)).toBeNull();
  });
  it("refuses to sign or verify without a strong secret", () => {
    expect(() => signUnsubscribeToken(USER, "")).toThrow(/secret/i);
    expect(() => signUnsubscribeToken(USER, "short")).toThrow(/secret/i);
    expect(verifyUnsubscribeToken("a.b", "")).toBeNull();
  });
  it("is deterministic (the same link every time) and URL-safe", () => {
    const a = signUnsubscribeToken(USER, SECRET);
    expect(a).toBe(signUnsubscribeToken(USER, SECRET));
    expect(a).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});
