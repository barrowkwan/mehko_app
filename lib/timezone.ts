import tzlookup from "tz-lookup";

// The IANA timezone of a point on the map (offline lookup, no network). null for anything unusable.
export function timezoneAt(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  try {
    return tzlookup(lat, lng);
  } catch {
    return null;
  }
}
