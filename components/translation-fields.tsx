import { useTranslations } from "next-intl";
import { LOCALES, LOCALE_LABELS, type Translations } from "@/lib/locale";
import { inputClass } from "@/components/action-form";

// Optional per-language versions of a merchant's own text. Field names are `tr_<locale>_<field>`
// (parsed by parseTranslations on the server). The original text elsewhere in the form is the fallback.
export function TranslationFields({
  translations,
  fields,
}: {
  translations?: unknown;
  fields: ("name" | "description")[];
}) {
  const t = useTranslations("translations");
  const existing = (translations && typeof translations === "object" ? translations : {}) as Translations;
  return (
    <details className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <summary className="cursor-pointer text-sm font-medium">{t("title")}</summary>
      <p className="mt-2 text-xs text-neutral-500">{t("help")}</p>
      <div className="mt-2 flex flex-col gap-3">
        {LOCALES.map((l) => (
          <fieldset key={l} className="flex flex-col gap-1">
            <legend className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{LOCALE_LABELS[l]}</legend>
            {fields.map((f) => (
              <input
                key={f}
                name={`tr_${l}_${f}`}
                defaultValue={existing[l]?.[f] ?? ""}
                placeholder={t(f)}
                aria-label={`${LOCALE_LABELS[l]} – ${t(f)}`}
                className={inputClass}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </details>
  );
}
