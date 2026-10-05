// Money is whole US cents everywhere (database, code); dollars only appear in forms and on screen.
// Prices are shown to people; nothing is charged by this app (payments are arranged directly with the merchant).
const MAX_CENTS = 1_000_000; // $10,000.00 per item, matches the database check

export function formatMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);
}

// What a merchant types: "12", "12.5", "12.50", "$12.50", "12,50". Blank means "no price".
export function parsePrice(input: string): { ok: true; cents: number | null } | { ok: false } {
  let s = input.trim().replace(/^\$\s*/, "");
  if (s === "") return { ok: true, cents: null };
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", "."); // decimal comma
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false };
  const cents = Math.round(Number(s) * 100);
  return cents <= MAX_CENTS ? { ok: true, cents } : { ok: false };
}

// For a price field: 1250 -> "12.50"; null -> "".
export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

export type PricedLine = { qty: number; unitPriceCents: number | null };

// The total of an order's lines. `complete` is false when some line has no price (the total then only covers the priced
// ones, and the screen says so); `anyPriced` is false when nothing has a price (no total is shown at all).
export function orderTotal(lines: PricedLine[]): { cents: number; complete: boolean; anyPriced: boolean } {
  let cents = 0;
  let priced = 0;
  for (const l of lines) {
    if (l.unitPriceCents === null) continue;
    cents += l.qty * l.unitPriceCents;
    priced += 1;
  }
  return { cents, complete: priced === lines.length, anyPriced: priced > 0 };
}
