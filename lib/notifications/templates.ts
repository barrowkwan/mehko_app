import { createTranslator } from "next-intl";
import { formatDate, formatInstant, formatTime } from "../format";
import type { Locale } from "../locale";

// Plain, accessible HTML + text emails. Every piece of user-supplied text is HTML-escaped; the subject is forced
// onto a single line (no header injection). Strings live in messages/*.json under "email" (all four languages).

export type PickupPoint = { name: string; address: string | null };
export type Line = { name: string; qty: number };

export type OrderEmailData = {
  recipientName: string | null;
  merchantName: string;
  items: Line[];
  pickupDate: string; // YYYY-MM-DD
  pickupStart: string; // HH:MM[:SS]
  pickupEnd: string;
  timezone: string; // the pickup point's IANA zone
  pickupPoint: PickupPoint;
  cutoffAt: string; // ISO instant
  instructions: string | null; // already localized for the recipient
  orderUrl: string;
};

export type MerchantSummaryData = {
  merchantName: string;
  pickupDate: string;
  pickupStart: string;
  pickupEnd: string;
  timezone: string;
  pickupPoint: PickupPoint;
  totals: Line[];
  orders: { customerName: string; items: Line[]; note: string | null }[];
  offeringUrl: string;
};

export type EmailType = "order_confirmed" | "pickup_reminder" | "merchant_cutoff_summary";
export type RenderInput =
  | { type: "order_confirmed" | "pickup_reminder"; data: OrderEmailData }
  | { type: "merchant_cutoff_summary"; data: MerchantSummaryData };
export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// CR, LF and the Unicode line/paragraph separators (built from code points so the source has no invisible characters).
const LINE_BREAKS = new RegExp(`[${String.fromCharCode(13, 10, 0x2028, 0x2029)}]+`, "g");
const oneLine = (s: string) => s.replace(LINE_BREAKS, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);

export function renderEmail(input: RenderInput & { locale: Locale; messages: Record<string, unknown>; unsubscribeUrl: string; site: string }): RenderedEmail {
  const { locale, messages, unsubscribeUrl, site } = input;
  const t = createTranslator({ locale, messages: messages as never, namespace: "email" as never }) as unknown as (key: string, values?: Record<string, string | number>) => string;

  const when = (d: { pickupDate: string; pickupStart: string; pickupEnd: string }) =>
    t("common.when", { date: formatDate(d.pickupDate, locale), start: formatTime(d.pickupStart, locale), end: formatTime(d.pickupEnd, locale) });
  const place = (p: PickupPoint) => [p.name, p.address].filter(Boolean).join(" · ");
  const lines = (items: Line[]) => items.map((i) => `${i.qty}× ${i.name}`);
  const e = escapeHtml;

  // Collects parallel HTML and text so they cannot drift apart.
  const html: string[] = [];
  const text: string[] = [];
  const p = (s: string) => {
    html.push(`<p style="margin:0 0 12px">${e(s)}</p>`);
    text.push(s, "");
  };
  const h = (s: string) => {
    html.push(`<h2 style="font-size:16px;margin:20px 0 6px">${e(s)}</h2>`);
    text.push(s.toUpperCase());
  };
  const list = (items: string[]) => {
    html.push(`<ul style="margin:0 0 12px;padding-left:20px">${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>`);
    text.push(...items.map((i) => `- ${i}`), "");
  };
  const block = (title: string, rows: string[]) => {
    h(title);
    html.push(`<p style="margin:0 0 12px">${rows.map(e).join("<br>")}</p>`);
    text.push(...rows, "");
  };
  const button = (label: string, url: string) => {
    html.push(`<p style="margin:16px 0"><a href="${e(url)}" style="background:#ea580c;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${e(label)}</a></p>`);
    text.push(`${label}: ${url}`, "");
  };

  let subject: string;

  if (input.type === "merchant_cutoff_summary") {
    const d = input.data;
    const date = formatDate(d.pickupDate, locale);
    subject = t("merchantSummary.subject", { count: d.orders.length, date, merchant: d.merchantName });
    p(t("merchantSummary.intro", { date }));
    block(t("orderConfirmed.pickup"), [when(d), place(d.pickupPoint)]);
    h(t("merchantSummary.toPrepare"));
    list(lines(d.totals));
    h(t("merchantSummary.orders"));
    list(d.orders.map((o) => `${o.customerName}: ${lines(o.items).join(", ")}`));
    h(t("merchantSummary.customerNotes"));
    const notes = d.orders.filter((o) => o.note);
    if (notes.length) list(notes.map((o) => `${o.customerName}: ${o.note}`));
    else p(t("merchantSummary.noNotes"));
    button(t("merchantSummary.button"), d.offeringUrl);
  } else {
    const d = input.data;
    const key = input.type === "order_confirmed" ? "orderConfirmed" : "pickupReminder";
    subject =
      input.type === "order_confirmed"
        ? t("orderConfirmed.subject", { merchant: d.merchantName, date: formatDate(d.pickupDate, locale) })
        : t("pickupReminder.subject", { merchant: d.merchantName, date: formatDate(d.pickupDate, locale), start: formatTime(d.pickupStart, locale) });
    p(d.recipientName ? t("greeting", { name: d.recipientName }) : t("greetingAnon"));
    p(t(`${key}.intro`, { merchant: d.merchantName }));
    block(t("orderConfirmed.pickup"), [when(d), place(d.pickupPoint)]);
    if (input.type === "order_confirmed") {
      h(t("orderConfirmed.yourOrder"));
      list(lines(d.items));
      p(t("orderConfirmed.changeUntil", { time: formatInstant(d.cutoffAt, locale, d.timezone) }));
    } else {
      h(t("orderConfirmed.yourOrder"));
      list(lines(d.items));
      p(t("pickupReminder.showQr"));
    }
    if (d.instructions) block(t("orderConfirmed.instructions"), [d.instructions]);
    button(t(`${key}.button`), d.orderUrl);
  }

  const reason = t("common.footerReason", { site });
  const unsub = t("common.unsubscribe");
  const body = html.join("\n");
  return {
    subject: oneLine(subject),
    html:
      `<!doctype html><html lang="${e(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
      `<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#171717;max-width:560px;margin:0 auto;padding:16px">${body}` +
      `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px">` +
      `<p style="font-size:12px;color:#737373;margin:0">${e(reason)} <a href="${e(unsubscribeUrl)}" style="color:#737373">${e(unsub)}</a></p></body></html>`,
    text: `${text.join("\n").trim()}\n\n--\n${reason}\n${unsub}: ${unsubscribeUrl}\n`,
  };
}
