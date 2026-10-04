import { createHmac, timingSafeEqual } from "node:crypto";

// Signed "unsubscribe" links that work without logging in: base64url(userId) + "." + base64url(HMAC-SHA256(userId)).
// They identify the user and nothing else; they only allow switching that user's email notifications off.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SECRET = 24;

const hmac = (userId: string, secret: string) => createHmac("sha256", secret).update(userId).digest();

export function signUnsubscribeToken(userId: string, secret: string): string {
  if (!secret || secret.length < MIN_SECRET) throw new Error(`UNSUBSCRIBE_SECRET must be set (at least ${MIN_SECRET} characters)`);
  return `${Buffer.from(userId).toString("base64url")}.${hmac(userId, secret).toString("base64url")}`;
}

// Returns the user id, or null for anything that isn't a valid token for this secret.
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret || secret.length < MIN_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const userId = Buffer.from(parts[0], "base64url").toString();
  if (!UUID.test(userId)) return null;
  const expected = hmac(userId, secret);
  const given = Buffer.from(parts[1], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}
