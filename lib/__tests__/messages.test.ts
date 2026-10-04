import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../locale";

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree => JSON.parse(readFileSync(join(__dirname, `../../messages/${l}.json`), "utf8"));

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}

// ICU placeholders like {name} / {count, plural, …} and rich-text tags like <points>…</points>.
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

const en = flatten(load("en"));

describe.each(LOCALES.filter((l) => l !== "en"))("messages/%s.json", (locale) => {
  const msgs = flatten(load(locale));

  it("has exactly the same keys as English", () => {
    expect(Object.keys(msgs).sort()).toEqual(Object.keys(en).sort());
  });
  it("uses the same placeholders and tags as English in every message", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(placeholders(msgs[key]), `${locale} ${key}`).toEqual(placeholders(value));
      expect(tags(msgs[key]), `${locale} ${key}`).toEqual(tags(value));
    }
  });
  it("has no empty messages", () => {
    for (const [key, value] of Object.entries(msgs)) expect(value.trim(), `${locale} ${key}`).not.toBe("");
  });
});
