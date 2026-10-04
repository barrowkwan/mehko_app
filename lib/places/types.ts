// A place a merchant can pick as a pickup point (the provider's answer, normalised).
export type Place = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  timezone: string | null;
  category: string | null;
};

export type SearchInput = { q: string; near: string; country: string };

export type PlacesProvider = {
  name: "geoapify";
  search(input: SearchInput): Promise<Place[]>;
};

export class PlacesError extends Error {}
