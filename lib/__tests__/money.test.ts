import { describe, expect, it } from "vitest";
import { centsToInput, formatMoney, orderTotal, parsePrice } from "../money";

describe("parsePrice", () => {
  it.each([
    ["12", 1200], ["12.5", 1250], ["12.50", 1250], ["$12.50", 1250], ["$ 3", 300], ["0", 0], ["0.99", 99], ["12,50", 1250], [" 7.05 ", 705], ["10000", 1_000_000],
  ])("accepts %s as %i cents", (input, cents) => {
    expect(parsePrice(input)).toEqual({ ok: true, cents });
  });
  it("treats blank as no price", () => {
    expect(parsePrice("")).toEqual({ ok: true, cents: null });
    expect(parsePrice("  ")).toEqual({ ok: true, cents: null });
  });
  it.each(["abc", "-1", "1.234", "1e3", "12.", ".5", "1,000.00", "$$5", "10000.01", "99999999"])("rejects %s", (input) => {
    expect(parsePrice(input)).toEqual({ ok: false });
  });
});

describe("formatting", () => {
  it("shows US dollars in the viewer's locale", () => {
    expect(formatMoney(1250, "en")).toBe("$12.50");
    expect(formatMoney(5, "en")).toBe("$0.05");
    expect(formatMoney(1250, "es")).toContain("12,50");
    expect(formatMoney(1250, "zh-CN")).toContain("12.50");
  });
  it("fills price fields", () => {
    expect(centsToInput(1250)).toBe("12.50");
    expect(centsToInput(0)).toBe("0.00");
    expect(centsToInput(null)).toBe("");
  });
});

describe("orderTotal", () => {
  it("adds quantity × price", () => {
    expect(orderTotal([{ qty: 2, unitPriceCents: 1200 }, { qty: 1, unitPriceCents: 950 }])).toEqual({ cents: 3350, complete: true, anyPriced: true });
  });
  it("flags lines without a price", () => {
    expect(orderTotal([{ qty: 2, unitPriceCents: 1200 }, { qty: 3, unitPriceCents: null }])).toEqual({ cents: 2400, complete: false, anyPriced: true });
  });
  it("has no total when nothing is priced", () => {
    expect(orderTotal([{ qty: 1, unitPriceCents: null }])).toEqual({ cents: 0, complete: false, anyPriced: false });
    expect(orderTotal([])).toEqual({ cents: 0, complete: true, anyPriced: false });
  });
});
