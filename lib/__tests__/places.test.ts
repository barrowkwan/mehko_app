import { describe, expect, it, vi } from "vitest";
import { createGeoapifyProvider } from "../places/geoapify";
import { placesFromEnv } from "../places";
import { createSearcher } from "../places/search";
import { timezoneAt } from "../timezone";
import type { Place, PlacesProvider } from "../places/types";

const KEY = "SECRETKEY123";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const ranch = {
  name: "99 Ranch Market",
  address_line1: "99 Ranch Market",
  address_line2: "10983 North Wolfe Road, Cupertino, CA 95014, United States of America",
  formatted: "99 Ranch Market, 10983 North Wolfe Road, Cupertino, CA 95014, United States of America",
  lat: 37.3347,
  lon: -122.0141,
  category: "commercial.supermarket",
  timezone: { name: "America/Los_Angeles" },
};
const street = { formatted: "100 River Rd, Springfield, IL 62701, United States of America", address_line1: "100 River Rd", address_line2: "Springfield, IL 62701, United States of America", lat: 39.8, lon: -89.6 };

describe("geoapify provider", () => {
  it("asks for the text, country filter, limit and key, and normalises businesses and addresses", async () => {
    const fetchImpl = vi.fn(async () => json({ results: [ranch, street, { name: "no coords" }, { ...ranch, lat: 999 }] }));
    const provider = createGeoapifyProvider(KEY, fetchImpl as unknown as typeof fetch, "https://geo.test");
    const places = await provider.search({ q: "99 Ranch", near: "95014", country: "US" });

    const url = new URL((fetchImpl.mock.calls[0] as unknown as [URL])[0]);
    expect(url.origin + url.pathname).toBe("https://geo.test/v1/geocode/search");
    expect(url.searchParams.get("text")).toBe("99 Ranch, 95014");
    expect(url.searchParams.get("filter")).toBe("countrycode:us");
    expect(url.searchParams.get("limit")).toBe("8");
    expect(url.searchParams.get("apiKey")).toBe(KEY);

    expect(places).toEqual<Place[]>([
      { name: "99 Ranch Market", address: "10983 North Wolfe Road, Cupertino, CA 95014", lat: 37.3347, lng: -122.0141, timezone: "America/Los_Angeles", category: "commercial.supermarket" },
      { name: "100 River Rd", address: "100 River Rd, Springfield, IL 62701", lat: 39.8, lng: -89.6, timezone: null, category: null },
    ]);
  });

  it("returns nothing for an answer without results and throws a key-free error on failures", async () => {
    const empty = createGeoapifyProvider(KEY, (async () => json({})) as typeof fetch);
    expect(await empty.search({ q: "x", near: "", country: "US" })).toEqual([]);

    const down = createGeoapifyProvider(KEY, (async () => json({ message: "nope" }, 500)) as typeof fetch);
    await expect(down.search({ q: "x", near: "", country: "US" })).rejects.toThrow(/HTTP 500/);

    const leaky = createGeoapifyProvider(KEY, (async () => {
      throw new Error(`connect failed for https://api.geoapify.com/?apiKey=${KEY}`);
    }) as typeof fetch);
    const err = await leaky.search({ q: "x", near: "", country: "US" }).catch((e: Error) => e);
    expect((err as Error).message).not.toContain(KEY);

    const garbage = createGeoapifyProvider(KEY, (async () => new Response("<html>", { status: 200 })) as typeof fetch);
    await expect(garbage.search({ q: "x", near: "", country: "US" })).rejects.toThrow(/unreadable/);
  });
});

describe("placesFromEnv", () => {
  it("is off without a key and on with one", () => {
    expect(placesFromEnv({})).toBeNull();
    expect(placesFromEnv({ GEOAPIFY_API_KEY: "  " })).toBeNull();
    expect(placesFromEnv({ GEOAPIFY_API_KEY: KEY })?.name).toBe("geoapify");
  });
});

describe("searcher", () => {
  const place: Place = { name: "A", address: "B", lat: 1, lng: 2, timezone: null, category: null };
  const fake = (): PlacesProvider & { calls: number } => {
    const p = { name: "geoapify" as const, calls: 0, async search() { p.calls += 1; return [place]; } };
    return p;
  };

  it("is unavailable without a provider and validates input", async () => {
    expect(await createSearcher(null).search({ userId: "u", country: "US", q: "x", near: "" })).toMatchObject({ ok: false, status: 503 });
    const s = createSearcher(fake());
    expect(await s.search({ userId: "u", country: "US", q: "", near: "  " })).toMatchObject({ ok: false, status: 400 });
    expect(await s.search({ userId: "u", country: "US", q: "x".repeat(101), near: "" })).toMatchObject({ ok: false, status: 400 });
  });

  it("serves identical searches from the cache until it expires", async () => {
    let t = 0;
    const p = fake();
    const s = createSearcher(p, () => t);
    await s.search({ userId: "u", country: "US", q: "Ranch", near: "95014" });
    await s.search({ userId: "v", country: "US", q: " ranch ", near: "95014" });
    expect(p.calls).toBe(1);
    t += 16 * 60_000;
    await s.search({ userId: "u", country: "US", q: "Ranch", near: "95014" });
    expect(p.calls).toBe(2);
  });

  it("limits each user to 20 provider searches a minute", async () => {
    let t = 0;
    const s = createSearcher(fake(), () => t);
    for (let i = 0; i < 20; i++) expect((await s.search({ userId: "u", country: "US", q: `q${i}`, near: "" })).ok).toBe(true);
    expect(await s.search({ userId: "u", country: "US", q: "one more", near: "" })).toMatchObject({ ok: false, status: 429 });
    expect((await s.search({ userId: "other", country: "US", q: "one more", near: "" })).ok).toBe(true);
    t += 61_000;
    expect((await s.search({ userId: "u", country: "US", q: "later", near: "" })).ok).toBe(true);
  });

  it("turns provider failures into a generic 502", async () => {
    const broken: PlacesProvider = { name: "geoapify", async search() { throw new Error(`boom ${KEY}`); } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await createSearcher(broken).search({ userId: "u", country: "US", q: "x", near: "" });
    expect(r).toEqual({ ok: false, status: 502, error: "provider_error" });
    spy.mockRestore();
  });
});

describe("timezoneAt", () => {
  it("finds the timezone of coordinates and rejects nonsense", () => {
    expect(timezoneAt(37.3347, -122.0141)).toBe("America/Los_Angeles");
    expect(timezoneAt(22.3, 114.17)).toBe("Asia/Hong_Kong");
    expect(timezoneAt(40.7, -74)).toBe("America/New_York");
    expect(timezoneAt(Number.NaN, 0)).toBeNull();
    expect(timezoneAt(91, 0)).toBeNull();
  });
});
