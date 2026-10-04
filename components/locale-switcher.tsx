"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS } from "@/lib/locale";

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={t("language")}
      value={locale}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await setLocale(e.target.value);
          router.refresh();
        })
      }
      className="rounded border border-neutral-300 bg-transparent px-1 py-0.5 text-sm dark:border-neutral-700"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} className="text-black">
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
