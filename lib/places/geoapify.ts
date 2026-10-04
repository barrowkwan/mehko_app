import { PlacesError, type Place, type PlacesProvider, type SearchInput } from "./types";

type Raw = {
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  lat?: number;
  lon?: number;
  category?: string;
  timezone?: { name?: string };
};

const MAX_RESULTS = 8;
const COUNTRY_SUFFIX = /,\s*(United States of America|United States|USA)\s*$/i;

// Geoapify forward geocoding (https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/). One request = one credit,
// so the app searches when the merchant presses Search, not on every keystroke. The key is sent as a query
// parameter (the provider's only option) and is scrubbed from every error message.
export function createGeoapifyProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl = "https://api.geoapify.com",
  timeoutMs = 5000,
): PlacesProvider {
  const redact = (s: string) => (apiKey ? s.split(apiKey).join("[redacted]") : s).slice(0, 200);
  return {
    name: "geoapify",
    async search({ q, near, country }: SearchInput): Promise<Place[]> {
      const url = new URL("/v1/geocode/search", baseUrl);
      url.searchParams.set("text", [q, near].filter(Boolean).join(", "));
      if (/^[a-z]{2}$/i.test(country)) url.searchParams.set("filter", `countrycode:${country.toLowerCase()}`);
      url.searchParams.set("limit", String(MAX_RESULTS));
      url.searchParams.set("format", "json");
      url.searchParams.set("apiKey", apiKey);

      let res: Response;
      try {
        res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
      } catch (e) {
        throw new PlacesError(redact(`Place search failed: ${e instanceof Error ? e.message : String(e)}`));
      }
      if (!res.ok) throw new PlacesError(`Place search failed (HTTP ${res.status})`);
      let body: { results?: unknown };
      try {
        body = (await res.json()) as { results?: unknown };
      } catch {
        throw new PlacesError("Place search returned an unreadable answer");
      }
      if (!Array.isArray(body.results)) return [];

      const places: Place[] = [];
      for (const r of body.results as Raw[]) {
        if (typeof r.lat !== "number" || typeof r.lon !== "number") continue;
        if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon) || Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) continue;
        // A business has its own name; for a plain address the first line is the street.
        const isBusiness = !!r.name && r.address_line1 === r.name;
        const name = (r.name || r.address_line1 || r.formatted || "").trim();
        const address = (isBusiness ? r.address_line2 || r.formatted || "" : r.formatted || r.address_line2 || "").replace(COUNTRY_SUFFIX, "").trim();
        if (!name) continue;
        places.push({
          name: name.slice(0, 120),
          address: address.slice(0, 200),
          lat: r.lat,
          lng: r.lon,
          timezone: typeof r.timezone?.name === "string" ? r.timezone.name : null,
          category: typeof r.category === "string" ? r.category : null,
        });
      }
      return places.slice(0, MAX_RESULTS);
    },
  };
}
