import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "../locale";
import { privacy } from "../../content/legal/privacy";
import { terms } from "../../content/legal/terms";
import type { LegalDoc } from "../../content/legal/types";

const docs: [string, Record<Locale, LegalDoc>][] = [
  ["privacy", privacy],
  ["terms", terms],
];

const strings = (doc: LegalDoc): string[] => [
  doc.title,
  doc.intro,
  ...doc.sections.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => ("p" in b ? [b.p] : b.ul))]),
];
const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const ALLOWED_TOKENS = new Set(["operator", "contact", "site", "updated"]);

describe.each(docs)("%s content", (_name, doc) => {
  it("exists for every supported language", () => {
    for (const l of LOCALES) expect(doc[l], l).toBeTruthy();
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%s has the same structure as English", (locale) => {
    const en = doc.en;
    const t = doc[locale];
    expect(t.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
    t.sections.forEach((s, i) => {
      expect(s.blocks.length, `${locale} ${s.id} block count`).toBe(en.sections[i].blocks.length);
      s.blocks.forEach((b, j) => {
        const eb = en.sections[i].blocks[j];
        expect("ul" in b, `${locale} ${s.id}[${j}] block kind`).toBe("ul" in eb);
        if ("ul" in b && "ul" in eb) expect(b.ul.length, `${locale} ${s.id}[${j}] bullets`).toBe(eb.ul.length);
      });
    });
  });

  it.each(LOCALES)("%s has no empty text and only known {tokens}", (locale) => {
    for (const s of strings(doc[locale])) {
      expect(s.trim(), `${locale}: empty string`).not.toBe("");
      for (const tok of tokens(s)) expect(ALLOWED_TOKENS.has(tok), `${locale}: unknown token {${tok}}`).toBe(true);
    }
  });

  it("section ids are unique, URL-safe anchors", () => {
    const ids = doc.en.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("privacy policy covers what the app actually does", () => {
  const text = strings(privacy.en).join("\n").toLowerCase();
  it.each([
    ["location sharing", "location"],
    ["account deletion", "delete"],
    ["login providers", "google"],
    ["hosting providers", "supabase"],
    ["cookies", "cookie"],
    ["children", "children"],
    ["retention / backups", "backup"],
    ["maps", "openstreetmap"],
  ])("mentions %s", (_label, needle) => {
    expect(text).toContain(needle);
  });
  it("has the anchor used for data-deletion instructions (Facebook console)", () => {
    expect(privacy.en.sections.map((s) => s.id)).toContain("deleting-your-data");
  });
});
