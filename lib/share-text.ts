import { formatDate, formatInstant, formatTime } from "./format";
import { localized, type Locale } from "./locale";
import { formatMoney } from "./money";
import type { SharedOffering } from "./shared-offering";

// A translator for the "share" message namespace (next-intl's createTranslator or getTranslations result).
export type ShareT = (key: string, values?: Record<string, string | number>) => string;

const MAX_DESCRIPTION = 200;

function foodNames(d: SharedOffering, locale: Locale): string[] {
  return d.foods.map((f) => {
    const name = localized(f.name, f.translations, locale, "name");
    return f.price_cents != null ? `${name} ${formatMoney(f.price_cents, locale)}` : name;
  });
}

function slotTime(s: SharedOffering["slots"][number], locale: Locale, withDate: boolean): string {
  const range = `${formatTime(s.pickup_start, locale)}–${formatTime(s.pickup_end, locale)}`;
  return withDate ? `${formatDate(s.pickup_date, locale)}, ${range}` : range;
}

const cutoffText = (d: SharedOffering, locale: Locale) =>
  formatInstant(d.cutoff_at, locale, d.slots[0].timezone); // shown with the pickup point's timezone abbreviation

export function shareTitle(d: SharedOffering, locale: Locale, t: ShareT): string {
  return t("title", { merchant: localized(d.merchant.name, d.merchant.translations, locale, "name"), date: formatDate(d.slots[0].pickup_date, locale) });
}

// The text that appears under the title in a Facebook/WhatsApp/… link preview: short, no line breaks.
export function shareDescription(d: SharedOffering, locale: Locale, t: ShareT): string {
  const manyDates = new Set(d.slots.map((s) => s.pickup_date)).size > 1;
  const pickups = d.slots.map((s) => `${slotTime(s, locale, manyDates)} ${t("at")} ${s.place}`).join("; ");
  const full = t("description", { foods: foodNames(d, locale).join(", "), pickups, time: cutoffText(d, locale) });
  if (full.length <= MAX_DESCRIPTION) return full;
  return `${full.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
}

// The ready-made post a merchant pastes next to the link, so nothing has to be retyped.
export function sharePostText(d: SharedOffering, locale: Locale, t: ShareT, url: string): string {
  const manyDates = new Set(d.slots.map((s) => s.pickup_date)).size > 1;
  const lines: string[] = [shareTitle(d, locale, t), ""];
  lines.push(t("foodsHeading"));
  for (const f of d.foods) {
    const name = localized(f.name, f.translations, locale, "name");
    const priced = f.price_cents != null ? `${name} — ${formatMoney(f.price_cents, locale)}` : name;
    lines.push(f.limit ? `• ${t("foodLimit", { name: priced, count: f.limit })}` : `• ${priced}`);
  }
  lines.push("", t("pickupHeading"));
  for (const s of d.slots) {
    const when = slotTime(s, locale, manyDates);
    lines.push(`• ${s.address ? t("pickupLineAddress", { time: when, place: s.place, address: s.address }) : t("pickupLine", { time: when, place: s.place })}`);
  }
  lines.push("", t("orderBy", { time: cutoffText(d, locale) }), "", t("orderHere", { url }));
  return lines.join("\n");
}
