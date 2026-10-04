import type { Event } from "@sentry/nextjs";

// Removes personal data and secrets from error reports before they leave the app.
// Used as Sentry's `beforeSend` (see lib/sentry-options.ts). Pure, so it is unit-tested.

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g; // Supabase/Auth access tokens
const SB_KEY = /\bsb_(?:secret|publishable)_[\w-]+/g; // new-style Supabase API keys
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_HEX = /\b[a-f0-9]{32,}\b/gi; // QR order tokens (64 hex), hashes, legacy keys
const URL_WITH_QUERY = /(https?:\/\/[^\s?#]+)[?#]\S*/g;

export function redactText(text: string): string {
  return text.replace(JWT, "[token]").replace(SB_KEY, "[token]").replace(EMAIL, "[email]").replace(LONG_HEX, "[token]");
}

// Query strings and fragments can carry OAuth codes and tokens; drop them from URLs.
export function stripUrlQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

const clean = (text: string) => redactText(text.replace(URL_WITH_QUERY, "$1"));

export function scrubEvent<T extends Event>(event: T): T {
  const e = event as Event;
  delete e.user; // id, email, IP address, username

  if (e.request) {
    delete e.request.cookies;
    delete e.request.headers; // cookie, authorization, user-agent …
    delete e.request.data; // request bodies
    delete e.request.query_string;
    if (typeof e.request.url === "string") e.request.url = stripUrlQuery(e.request.url);
  }

  if (typeof e.message === "string") e.message = clean(e.message);
  for (const ex of e.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = clean(ex.value);
  }
  for (const b of e.breadcrumbs ?? []) {
    if (typeof b.message === "string") b.message = clean(b.message);
    const data = b.data as { url?: unknown } | undefined;
    if (data && typeof data.url === "string") data.url = stripUrlQuery(data.url);
  }
  return event;
}
