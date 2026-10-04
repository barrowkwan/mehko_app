import { describe, expect, it } from "vitest";
import { sharePostText, shareDescription, shareTitle, type ShareT } from "../share-text";
import { parseSharedOffering, previewImageUrl, shareLocale, type SharedOffering } from "../shared-offering";
import { LOCALES } from "../locale";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import zhCN from "../../messages/zh-CN.json";
import zhTW from "../../messages/zh-TW.json";

const MESSAGES = { en, es, "zh-CN": zhCN, "zh-TW": zhTW } as const;
const tFor = (locale: keyof typeof MESSAGES): ShareT =>
  createTranslator({ locale, messages: MESSAGES[locale], namespace: "share" }) as unknown as ShareT;

const offering: SharedOffering = {
  offering_no: "m00001-000001",
  cutoff_at: "2026-10-08T07:00:00Z",
  open: true,
  merchant: { name: "Hong Kong Cafe", description: null, translations: { "zh-TW": { name: "香港茶餐廳" } }, logo_path: null, website: null },
  slots: [
    { id: "a", pickup_date: "2026-10-10", pickup_start: "10:00:00", pickup_end: "11:00:00", timezone: "America/Los_Angeles", place: "Cupertino Ranch 99", address: null, open: true },
    { id: "b", pickup_date: "2026-10-10", pickup_start: "14:00:00", pickup_end: "15:00:00", timezone: "America/Los_Angeles", place: "Mr. Green Bubble", address: "1 Main St", open: true },
  ],
  foods: [
    { name: "Fish ball", description: null, translations: {}, image_path: "m/f.jpg", limit: 10 },
    { name: "Egg waffle", description: null, translations: { "zh-TW": { name: "雞蛋仔" } }, image_path: null, limit: null },
  ],
};
const URL_ = "https://eats.example.com/o/m00001-000001?lang=en";

describe("share text", () => {
  it("builds a complete post in English: title, foods with limits, every pickup, cutoff and the link", () => {
    const text = sharePostText(offering, "en", tFor("en"), URL_);
    expect(text).toContain("Hong Kong Cafe — Sat, Oct 10, 2026");
    expect(text).toContain("• Fish ball (limit 10)");
    expect(text).toContain("• Egg waffle");
    expect(text).toContain("10:00 AM–11:00 AM · Cupertino Ranch 99");
    expect(text).toContain("2:00 PM–3:00 PM · Mr. Green Bubble, 1 Main St"); // address only where the merchant allowed it
    expect(text).not.toMatch(/Cupertino Ranch 99,/);
    expect(text).toContain("Order by Oct 8, 2026, 12:00 AM PDT");
    expect(text.trim().endsWith(URL_)).toBe(true);
  });

  it("uses translated names when the post language has them", () => {
    const text = sharePostText(offering, "zh-TW", tFor("zh-TW"), URL_);
    expect(text).toContain("香港茶餐廳");
    expect(text).toContain("雞蛋仔");
    expect(text).toContain("Fish ball"); // no translation: the original is kept
  });

  it("works in every language without leftover placeholders", () => {
    for (const locale of LOCALES) {
      const text = sharePostText(offering, locale, tFor(locale), URL_);
      expect(text, locale).not.toMatch(/\{\w+\}/);
      expect(text, locale).toContain(URL_);
      expect(shareTitle(offering, locale, tFor(locale)), locale).not.toMatch(/\{\w+\}/);
    }
  });

  it("keeps the preview description short, on one line", () => {
    const long = { ...offering, foods: Array.from({ length: 40 }, (_, i) => ({ name: `Dish number ${i}`, description: null, translations: {}, image_path: null, limit: null })) };
    const d = shareDescription(long, "en", tFor("en"));
    expect(d.length).toBeLessThanOrEqual(200);
    expect(d).not.toContain("\n");
    expect(d.endsWith("…")).toBe(true);
    expect(shareDescription(offering, "en", tFor("en"))).toContain("Fish ball, Egg waffle");
  });

  it("includes the date on each pickup when slots are on different days (older offerings)", () => {
    const multi = { ...offering, slots: [offering.slots[0], { ...offering.slots[1], pickup_date: "2026-10-11" }] };
    const text = sharePostText(multi, "en", tFor("en"), URL_);
    expect(text).toContain("Sat, Oct 10, 2026, 10:00 AM–11:00 AM");
    expect(text).toContain("Sun, Oct 11, 2026, 2:00 PM–3:00 PM");
  });
});

describe("shared-offering helpers", () => {
  it("rejects malformed database answers instead of crashing", () => {
    expect(parseSharedOffering(null)).toBeNull();
    expect(parseSharedOffering({})).toBeNull();
    expect(parseSharedOffering({ ...offering, slots: [] })).toBeNull();
    expect(parseSharedOffering({ ...offering, merchant: null })).toBeNull();
    expect(parseSharedOffering(offering)).not.toBeNull();
  });

  it("picks the first food photo, else the logo, else nothing", () => {
    const base = "https://x.supabase.co";
    expect(previewImageUrl(offering, base)).toBe(`${base}/storage/v1/object/public/food-images/m/f.jpg`);
    expect(previewImageUrl({ ...offering, foods: [{ ...offering.foods[1] }], merchant: { ...offering.merchant, logo_path: "m/logo-1.jpg" } }, base)).toContain("m/logo-1.jpg");
    expect(previewImageUrl({ ...offering, foods: [] }, base)).toBeNull();
  });

  it("only accepts supported languages for ?lang=", () => {
    expect(shareLocale("es", "en")).toBe("es");
    expect(shareLocale("fr", "en")).toBe("en");
    expect(shareLocale(undefined, "zh-CN")).toBe("zh-CN");
  });
});
