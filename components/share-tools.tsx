"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/locale";

// Buttons for a shared offering: copy the link, copy the ready-made post, the phone's share sheet (Facebook, WhatsApp,
// Messages, …) and Facebook's share dialog. The texts and links for every language are built on the server.
export function ShareTools({
  defaultLocale,
  links,
  texts,
  titles,
}: {
  defaultLocale: Locale;
  links: Record<Locale, string>;
  texts: Record<Locale, string>;
  titles: Record<Locale, string>;
}) {
  const t = useTranslations("share.merchant");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy(kind: "link" | "text") {
    const value = kind === "link" ? links[locale] : texts[locale];
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API unavailable (older browser / insecure page): select the text so the merchant can copy it by hand
      const el = document.getElementById(kind === "link" ? "share-link" : "share-text") as HTMLInputElement | HTMLTextAreaElement | null;
      el?.select();
      return;
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("language")}</span>
        <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700">
          {LOCALES.map((l) => (
            <option key={l} value={l} className="text-black">
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("link")}</span>
        <input id="share-link" readOnly value={links[locale]} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-neutral-300 bg-transparent p-2 font-mono text-xs dark:border-neutral-700" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("postText")}</span>
        <textarea id="share-text" readOnly rows={10} value={texts[locale]} className="w-full rounded border border-neutral-300 bg-transparent p-2 text-sm dark:border-neutral-700" />
      </label>

      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => copy("link")} className="rounded-lg bg-orange-600 px-3 py-2 font-medium text-white hover:bg-orange-700">
          {copied === "link" ? t("copied") : t("copyLink")}
        </button>
        <button type="button" onClick={() => copy("text")} className="rounded-lg bg-orange-600 px-3 py-2 font-medium text-white hover:bg-orange-700">
          {copied === "text" ? t("copied") : t("copyText")}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => void navigator.share({ title: titles[locale], text: texts[locale].replace(links[locale], "").trim(), url: links[locale] }).catch(() => {})}
            className="rounded-lg border border-neutral-300 px-3 py-2 font-medium dark:border-neutral-700"
          >
            {t("shareButton")}
          </button>
        )}
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(links[locale])}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-neutral-300 px-3 py-2 font-medium dark:border-neutral-700"
        >
          {t("facebook")}
        </a>
        <a href={links[locale]} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-neutral-300 px-3 py-2 font-medium dark:border-neutral-700">
          {t("previewPage")}
        </a>
      </div>
      <p className="text-xs text-neutral-500">{t("debuggerNote")}</p>
    </div>
  );
}
