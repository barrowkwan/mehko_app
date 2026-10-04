# FEAT-10b · Find a pickup point by business, address or ZIP

**Status:** Done (2026-10-04). Migration `20261016000000_pickup_point_protect.sql`. Needs `GEOAPIFY_API_KEY` in Render to switch the search on ([todo.md](../todo.md)).

## Goal
Merchants never type latitude/longitude/timezone. They search ("99 Ranch" near "95014"), pick a result, or click the map; the rest is filled in. Coordinates and timezone are still stored.

## Decisions (product owner)
Provider **Geoapify** (free 3,000 credits/day, commercial use and storing results allowed, "Powered by Geoapify" credit, key required). **Edit** existing points with the same search.

## Design
- `lib/places/` provider interface + Geoapify adapter (`/v1/geocode/search`, `filter=countrycode:<merchant country>`, 5 s timeout, key scrubbed from errors); `placesFromEnv()` is null without a key, so the search box is hidden and the map/manual entry still work.
- `GET /api/places/search` (merchants only, behind the normal sign-in): input limits, 15-minute in-memory cache, 20 searches/min per user (in-memory; a shared limiter is SEC-2).
- Search runs when the merchant presses Search/Enter, not per keystroke (one request = one credit).
- Timezone: taken from the result, else worked out offline from the map position (`tz-lookup`, `lib/timezone.ts`).
- `PlaceSearch` component (add and edit); lat/lng/timezone under "Technical details".
- DB: `protect_pickup_point_location` refuses changing address/lat/lng while an upcoming offering at the point has active orders; name and timezone stay editable.
- Privacy policy lists Geoapify as a processor of the search text.

## Tests
Unit: adapter (fake fetch), searcher (cache, rate limit, validation), timezone. DB: `tests/db/pickup-point-protect.test.ts`. E2E: search → pick → save, no results / provider down, edit and the blocked move, and a no-key server (`tests/e2e/nokey.spec.ts`); a local stand-in for Geoapify (`tests/e2e/geoapify-stub.mjs`) so tests never spend quota.
