import { describe, expect, it } from "vitest";
import { isPlausibleEmail, splitLegalText } from "../legal";

const vars = { operator: "Acme Eats", contact: "hello@example.com", site: "https://eats.example.com", updated: "Oct 4, 2026" };

describe("splitLegalText", () => {
  it("replaces operator, site and updated tokens", () => {
    expect(splitLegalText("{operator} runs {site}. Updated {updated}.", vars, "fallback")).toEqual([
      { kind: "text", text: "Acme Eats runs https://eats.example.com. Updated Oct 4, 2026." },
    ]);
  });
  it("turns {contact} into a mailto part when an email is configured", () => {
    expect(splitLegalText("Write to {contact} today", vars, "fallback")).toEqual([
      { kind: "text", text: "Write to " },
      { kind: "contact", email: "hello@example.com" },
      { kind: "text", text: " today" },
    ]);
  });
  it("uses the fallback sentence when no contact email is configured", () => {
    expect(splitLegalText("Write to {contact}.", { ...vars, contact: null }, "the operator")).toEqual([
      { kind: "text", text: "Write to " },
      { kind: "text", text: "the operator" },
      { kind: "text", text: "." },
    ]);
  });
  it("handles several contact tokens and none", () => {
    expect(splitLegalText("{contact} and {contact}", vars, "x").filter((p) => p.kind === "contact")).toHaveLength(2);
    expect(splitLegalText("nothing here", vars, "x")).toEqual([{ kind: "text", text: "nothing here" }]);
  });
});

describe("isPlausibleEmail", () => {
  it("accepts normal addresses and rejects junk", () => {
    expect(isPlausibleEmail("a@b.co")).toBe(true);
    expect(isPlausibleEmail(" a@b.co ")).toBe(true);
    for (const bad of ["", "nope", "a@b", "a b@c.d", "<x@y.z>", undefined, null]) expect(isPlausibleEmail(bad as string)).toBe(false);
  });
});
