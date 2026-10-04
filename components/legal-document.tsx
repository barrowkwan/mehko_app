import { getLocale, getTranslations } from "next-intl/server";
import type { LegalDoc } from "@/content/legal/types";
import { LEGAL_UPDATED } from "@/content/legal/meta";
import { formatDate } from "@/lib/format";
import { splitLegalText } from "@/lib/legal";
import { getContactEmail, getOperatorName, getSiteUrl } from "@/lib/site";

export async function LegalDocument({ doc }: { doc: LegalDoc }) {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const vars = {
    operator: getOperatorName(),
    contact: getContactEmail(),
    site: await getSiteUrl(),
    updated: formatDate(LEGAL_UPDATED, locale),
  };
  const text = (s: string) =>
    splitLegalText(s, vars, t("contactFallback")).map((part, i) =>
      part.kind === "contact" ? (
        <a key={i} href={`mailto:${part.email}`} className="text-orange-600 underline">
          {part.email}
        </a>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    );

  return (
    <main className="flex max-w-3xl flex-col gap-6 p-4 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <p className="text-neutral-600 dark:text-neutral-400">{text(doc.intro)}</p>
      </header>

      <nav aria-label={t("onThisPage")} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <p className="mb-1 font-semibold">{t("onThisPage")}</p>
        <ol className="list-decimal pl-5 columns-1 sm:columns-2">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-orange-600 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="flex scroll-mt-4 flex-col gap-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          {s.blocks.map((b, i) =>
            "p" in b ? (
              <p key={i}>{text(b.p)}</p>
            ) : (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.ul.map((li, j) => (
                  <li key={j}>{text(li)}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </main>
  );
}
