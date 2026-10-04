import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "../locale";
import { escapeHtml, renderEmail, type MerchantSummaryData, type OrderEmailData } from "../notifications/templates";

const messages = (l: Locale) => JSON.parse(readFileSync(join(__dirname, `../../messages/${l}.json`), "utf8"));
const unsubscribeUrl = "https://eats.example.com/unsubscribe?token=abc.def";
const site = "https://eats.example.com";

const order: OrderEmailData = {
  recipientName: "Nina Customer",
  merchantName: "Mei's Dumplings",
  items: [{ name: "Pork dumplings", qty: 2 }, { name: "Elote", qty: 1 }],
  pickupDate: "2026-10-09",
  pickupStart: "17:00:00",
  pickupEnd: "19:00:00",
  timezone: "America/New_York",
  pickupPoint: { name: "Riverside Park", address: "100 River Rd" },
  cutoffAt: "2026-10-08T22:00:00.000Z", // 6:00 PM in New York (EDT)
  instructions: "North gate, red tent",
  orderUrl: "https://eats.example.com/orders/123",
};
const summary: MerchantSummaryData = {
  merchantName: "Mei's Dumplings",
  pickupDate: "2026-10-09",
  pickupStart: "17:00:00",
  pickupEnd: "19:00:00",
  timezone: "America/New_York",
  pickupPoint: { name: "Riverside Park", address: "100 River Rd" },
  totals: [{ name: "Pork dumplings", qty: 5 }, { name: "Elote", qty: 2 }],
  orders: [
    { customerName: "Nina", items: [{ name: "Pork dumplings", qty: 3 }], note: "No nuts — severe allergy" },
    { customerName: "Sam", items: [{ name: "Pork dumplings", qty: 2 }, { name: "Elote", qty: 2 }], note: null },
  ],
  offeringUrl: "https://eats.example.com/merchant/offerings/456",
};

const render = (type: Parameters<typeof renderEmail>[0]["type"], locale: Locale, data: OrderEmailData | MerchantSummaryData) =>
  renderEmail({ type, locale, messages: messages(locale), data, unsubscribeUrl, site } as Parameters<typeof renderEmail>[0]);

describe("escapeHtml", () => {
  it("escapes the characters that matter in HTML text and attributes", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'q'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;");
  });
});

describe.each(LOCALES)("emails in %s", (locale) => {
  it("order confirmation: subject, items, pickup details, instructions, links and unsubscribe", () => {
    const e = render("order_confirmed", locale, order);
    expect(e.subject).toContain("Mei's Dumplings");
    for (const s of [e.html, e.text]) {
      expect(s).toContain("Pork dumplings");
      expect(s).toContain("Riverside Park");
      expect(s).toContain("100 River Rd");
      expect(s).toContain("North gate, red tent");
      expect(s).toContain("https://eats.example.com/orders/123");
      expect(s).toContain(unsubscribeUrl);
      expect(s).not.toMatch(/\{\w+\}/); // no unreplaced placeholders
    }
    expect(e.html).toContain(`href="${order.orderUrl}"`);
  });

  it("pickup reminder: pickup time in the pickup point's timezone and the order link", () => {
    const e = render("pickup_reminder", locale, order);
    expect(e.subject).toContain("Mei's Dumplings");
    expect(e.subject).toMatch(/5:00|17:00|下午5:00/);
    expect(e.text).toContain(order.orderUrl);
    expect(e.text).not.toMatch(/\{\w+\}/);
  });

  it("merchant summary: totals, every order, and the customer notes", () => {
    const e = render("merchant_cutoff_summary", locale, summary);
    expect(e.subject).toContain("Mei's Dumplings");
    for (const s of [e.html, e.text]) {
      expect(s).toContain("Pork dumplings");
      expect(s).toContain("No nuts — severe allergy"); // allergies must reach the merchant
      expect(s).toContain("Nina");
      expect(s).toContain(summary.offeringUrl);
      expect(s).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("content safety", () => {
  const hostile: OrderEmailData = {
    ...order,
    recipientName: `<img src=x onerror=alert(1)>`,
    merchantName: `Evil <b>Kitchen</b>\r\nBcc: attacker@example.com`,
    instructions: `<script>steal()</script>`,
    items: [{ name: `"><svg onload=1>`, qty: 1 }],
    pickupPoint: { name: `<i>Park</i>`, address: `5 "Main" St & Co` },
  };

  it("escapes user-supplied text in the HTML body", () => {
    const e = render("order_confirmed", "en", hostile);
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).not.toContain("<svg onload");
    expect(e.html).not.toContain("<b>Kitchen</b>");
    expect(e.html).toContain("&lt;script&gt;steal()&lt;/script&gt;");
    expect(e.html).toContain("5 &quot;Main&quot; St &amp; Co");
  });

  it("keeps the subject a single clean line (no header injection)", () => {
    const e = render("order_confirmed", "en", hostile);
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.subject.length).toBeLessThanOrEqual(200);
  });

  it("never puts a customer note into a customer email", () => {
    const withNote = { ...order, note: "secret allergy detail" } as unknown as OrderEmailData;
    for (const type of ["order_confirmed", "pickup_reminder"] as const) {
      const e = render(type, "en", withNote);
      expect(e.html + e.text).not.toContain("secret allergy detail");
    }
  });

  it("does not link anything except our own URLs and the unsubscribe link", () => {
    const e = render("merchant_cutoff_summary", "en", { ...summary, orders: [{ customerName: "javascript:alert(1)", items: [], note: "http://evil.example.com" }] });
    const hrefs = [...e.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const h of hrefs) expect(h.startsWith("https://eats.example.com/"), h).toBe(true);
  });
});

describe("plurals and formatting", () => {
  it("pluralizes the summary subject correctly", () => {
    const one = renderEmail({ type: "merchant_cutoff_summary", locale: "es", messages: messages("es"), data: { ...summary, orders: [summary.orders[0]] }, unsubscribeUrl, site });
    const two = renderEmail({ type: "merchant_cutoff_summary", locale: "es", messages: messages("es"), data: summary, unsubscribeUrl, site });
    expect(one.subject).toContain("1 pedido ");
    expect(two.subject).toContain("2 pedidos");
    const en = renderEmail({ type: "merchant_cutoff_summary", locale: "en", messages: messages("en"), data: summary, unsubscribeUrl, site });
    expect(en.subject).toContain("2 orders");
  });

  it("shows the cutoff in the pickup point's timezone with its zone name", () => {
    const e = render("order_confirmed", "en", order);
    expect(e.text).toMatch(/6:00\s?PM/);
    expect(e.text).toContain("EDT");
  });

  it("greets by name, or neutrally when there is none", () => {
    expect(render("order_confirmed", "en", order).text).toContain("Hi Nina Customer,");
    expect(render("order_confirmed", "en", { ...order, recipientName: null }).text).toContain("Hello,");
  });
});
