import { PlacesError, type Place, type PlacesProvider } from "./types";

// The logic behind GET /api/places/search, kept free of Next.js so it can be tested: who may search, input limits,
// a short-lived cache (identical searches cost nothing) and a per-user rate limit.
export type Searcher = {
  search(input: { userId: string; country: string; q: string; near: string }): Promise<
    { ok: true; places: Place[] } | { ok: false; status: 400 | 429 | 502 | 503; error: string }
  >;
};

const MAX_TEXT = 100;
const CACHE_MS = 15 * 60_000;
const CACHE_MAX = 200;
const LIMIT = 20;
const WINDOW_MS = 60_000;

export function createSearcher(provider: PlacesProvider | null, now: () => number = Date.now): Searcher {
  const cache = new Map<string, { at: number; places: Place[] }>();
  const hits = new Map<string, number[]>();
  return {
    async search({ userId, country, q, near }) {
      if (!provider) return { ok: false, status: 503, error: "unavailable" };
      q = q.trim();
      near = near.trim();
      if ((!q && !near) || q.length > MAX_TEXT || near.length > MAX_TEXT) return { ok: false, status: 400, error: "invalid" };

      const t = now();
      const recent = (hits.get(userId) ?? []).filter((x) => t - x < WINDOW_MS);
      if (recent.length >= LIMIT) return { ok: false, status: 429, error: "rate_limited" };

      const key = [country, q, near].join("|").toLowerCase();
      const cached = cache.get(key);
      if (cached && t - cached.at < CACHE_MS) return { ok: true, places: cached.places };

      recent.push(t);
      hits.set(userId, recent);
      try {
        const places = await provider.search({ q, near, country });
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string); // oldest first
        cache.set(key, { at: t, places });
        return { ok: true, places };
      } catch (e) {
        console.error("Place search failed:", e instanceof PlacesError ? e.message : "unexpected error");
        return { ok: false, status: 502, error: "provider_error" };
      }
    },
  };
}
