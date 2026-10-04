import { createGeoapifyProvider } from "./geoapify";
import type { PlacesProvider } from "./types";

export type { Place, PlacesProvider } from "./types";

// The place-search provider configured by the environment, or null (search box hidden; merchants type an address or
// click the map instead). PLACES_API_BASE points tests at a local stub.
export function placesFromEnv(env: Record<string, string | undefined> = process.env): PlacesProvider | null {
  const key = env.GEOAPIFY_API_KEY?.trim();
  if (!key) return null;
  return createGeoapifyProvider(key, fetch, env.PLACES_API_BASE?.trim() || undefined);
}
