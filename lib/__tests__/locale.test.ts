import { describe, expect, it } from "vitest";
import { localized, negotiateLocale, parseTranslations, translatedLocales } from "../locale";

describe("negotiateLocale", () => {
  it("defaults to English", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("fr-FR,de;q=0.8")).toBe("en");
  });
  it("matches Spanish variants", () => {
    expect(negotiateLocale("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
  });
  it("maps Chinese variants to simplified or traditional", () => {
    expect(negotiateLocale("zh-CN,zh;q=0.9")).toBe("zh-CN");
    expect(negotiateLocale("zh")).toBe("zh-CN");
    expect(negotiateLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(negotiateLocale("zh-TW")).toBe("zh-TW");
    expect(negotiateLocale("zh-HK,en;q=0.5")).toBe("zh-TW");
    expect(negotiateLocale("zh-Hant")).toBe("zh-TW");
  });
  it("honours q-values and skips unsupported tags", () => {
    expect(negotiateLocale("en;q=0.5,es;q=0.9")).toBe("es");
    expect(negotiateLocale("fr,es;q=0.4")).toBe("es");
    expect(negotiateLocale("es;q=0")).toBe("en");
  });
});

describe("localized", () => {
  const tr = { es: { name: "Empanadas" }, "zh-CN": { name: "饺子", description: "  手工  " } };
  it("returns the translation when present", () => {
    expect(localized("Dumplings", tr, "es", "name")).toBe("Empanadas");
    expect(localized("x", tr, "zh-CN", "description")).toBe("手工");
  });
  it("falls back to the original", () => {
    expect(localized("Dumplings", tr, "en", "name")).toBe("Dumplings");
    expect(localized("Dumplings", tr, "es", "description")).toBe("Dumplings");
    expect(localized(null, tr, "es", "description")).toBeNull();
  });
  it("falls back between Chinese variants", () => {
    expect(localized("Dumplings", tr, "zh-TW", "name")).toBe("饺子");
  });
  it("ignores malformed translations", () => {
    expect(localized("A", null, "es", "name")).toBe("A");
    expect(localized("A", [], "es", "name")).toBe("A");
    expect(localized("A", { es: { name: "" } }, "es", "name")).toBe("A");
    expect(localized("A", { es: { name: 5 } }, "es", "name")).toBe("A");
  });
});

describe("parseTranslations", () => {
  it("collects non-empty tr_<locale>_<field> entries", () => {
    const fd = new FormData();
    fd.set("tr_es_name", " Empanadas ");
    fd.set("tr_es_description", "");
    fd.set("tr_zh-TW_name", "餃子");
    fd.set("tr_fr_name", "ignored");
    expect(parseTranslations(fd, ["name", "description"])).toEqual({ es: { name: "Empanadas" }, "zh-TW": { name: "餃子" } });
  });
});

describe("translatedLocales", () => {
  it("lists languages with a non-empty translated field, in catalog order", () => {
    expect(translatedLocales({ "zh-TW": { name: "餃子" }, es: { name: "", description: "x" }, en: { name: " " } })).toEqual(["es", "zh-TW"]);
  });
  it("handles empty or malformed input", () => {
    expect(translatedLocales({})).toEqual([]);
    expect(translatedLocales(null)).toEqual([]);
    expect(translatedLocales([])).toEqual([]);
  });
});
