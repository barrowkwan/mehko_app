import { foodImageUrl } from "./images";
import { LOCALES, isLocale, type Locale } from "./locale";

// What the public share page needs: the answer of the SQL function get_shared_offering (a whitelist of fields; see
// supabase/migrations/20261020000000_share_offering.sql). Also built from the merchant's own data to preview the post.
export type SharedSlot = {
  id: string;
  pickup_date: string; // YYYY-MM-DD
  pickup_start: string; // HH:MM[:SS]
  pickup_end: string;
  timezone: string;
  place: string;
  address: string | null; // only when the merchant allowed showing it publicly
  open: boolean;
};
export type SharedFood = { name: string; description: string | null; translations: unknown; image_path: string | null; limit: number | null; price_cents?: number | null };
export type SharedOffering = {
  offering_no: string;
  cutoff_at: string;
  open: boolean;
  merchant: { name: string; description: string | null; translations: unknown; logo_path: string | null; website: string | null };
  slots: SharedSlot[];
  foods: SharedFood[];
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// The database result is trusted, but a malformed answer must never crash a public page.
export function parseSharedOffering(json: unknown): SharedOffering | null {
  if (!isObj(json) || typeof json.offering_no !== "string" || typeof json.cutoff_at !== "string") return null;
  if (!isObj(json.merchant) || typeof json.merchant.name !== "string") return null;
  if (!Array.isArray(json.slots) || json.slots.length === 0 || !Array.isArray(json.foods)) return null;
  return json as unknown as SharedOffering;
}

// Which language to render the shared page in: the link's ?lang=, else the visitor's.
export function shareLocale(lang: unknown, fallback: Locale): Locale {
  return isLocale(lang) ? lang : fallback;
}

// The picture Facebook & co. show: the first food photo, else the merchant's logo, else null (the page then uses the app icon).
export function previewImageUrl(d: SharedOffering, supabaseUrl: string | undefined): string | null {
  for (const f of d.foods) {
    const url = foodImageUrl(supabaseUrl, f.image_path);
    if (url) return url;
  }
  return foodImageUrl(supabaseUrl, d.merchant.logo_path);
}

export { LOCALES };
