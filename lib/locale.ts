// Pure locale helpers (no Next.js imports) so they can be unit-tested and used anywhere.

export const LOCALES = ["en", "es", "zh-CN", "zh-TW"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Each language written in itself, for the switcher.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function tagToLocale(tag: string): Locale | null {
  const t = tag.toLowerCase();
  if (t === "en" || t.startsWith("en-")) return "en";
  if (t === "es" || t.startsWith("es-")) return "es";
  if (t === "zh" || t.startsWith("zh-")) {
    return /-(tw|hk|mo|hant)\b/.test(t) ? "zh-TW" : "zh-CN";
  }
  return null;
}

// Picks the best supported locale from an Accept-Language header (honours q-values).
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number.parseFloat(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? "1");
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 1, index };
    })
    .filter((t) => t.tag && t.tag !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of tags) {
    const locale = tagToLocale(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

// Merchant-written translations: { "es": { "name": "…", "description": "…" }, … }
export type Translations = Partial<Record<Locale, Partial<Record<string, string>>>>;

// Closest other locales to try before falling back to the merchant's original text.
const FALLBACKS: Record<Locale, Locale[]> = {
  en: [],
  es: [],
  "zh-CN": ["zh-TW"],
  "zh-TW": ["zh-CN"],
};

// Returns the merchant's translation for a field if one exists, otherwise the original text.
export function localized<T extends string | null>(
  original: T,
  translations: unknown,
  locale: Locale,
  field: string,
): T | string {
  if (translations && typeof translations === "object" && !Array.isArray(translations)) {
    const t = translations as Translations;
    for (const l of [locale, ...FALLBACKS[locale]]) {
      const value = t[l]?.[field];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
  }
  return original;
}

// Which languages have at least one translated field (for "translated in …" hints).
export function translatedLocales(translations: unknown): Locale[] {
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) return [];
  const t = translations as Translations;
  return LOCALES.filter((l) => Object.values(t[l] ?? {}).some((v) => typeof v === "string" && v.trim() !== ""));
}

// Builds the translations object from a form: fields named `tr_<locale>_<field>`.
export function parseTranslations(formData: FormData, fields: string[]): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    for (const field of fields) {
      const raw = formData.get(`tr_${locale}_${field}`);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value) (out[locale] ??= {})[field] = value.slice(0, 2000);
    }
  }
  return out;
}
