import { getLocale, getTranslations } from "next-intl/server";
import { createTranslator } from "next-intl";
import { ActionForm } from "@/components/action-form";
import { ShareSwitches } from "@/components/share-switches";
import { ShareTools } from "@/components/share-tools";
import { LOCALES, type Locale } from "@/lib/locale";
import { sharePostText, shareTitle, type ShareT } from "@/lib/share-text";
import type { SharedOffering } from "@/lib/shared-offering";
import { setOfferingSharing } from "@/app/merchant/actions";

// "Share this offering" on the merchant's offering page: the opt-in switch, and (once on) the link and ready-made
// post in every language. `data` is built from the merchant's own rows, with the address only if it will be public.
export async function ShareSection({
  offeringId,
  data,
  isPublic,
  showAddress,
  siteUrl,
}: {
  offeringId: string;
  data: SharedOffering;
  isPublic: boolean;
  showAddress: boolean;
  siteUrl: string;
}) {
  const t = await getTranslations("share.merchant");
  const current = (await getLocale()) as Locale;

  const links = {} as Record<Locale, string>;
  const texts = {} as Record<Locale, string>;
  const titles = {} as Record<Locale, string>;
  if (isPublic) {
    for (const l of LOCALES) {
      const messages = (await import(`../messages/${l}.json`)).default;
      const tl = createTranslator({ locale: l, messages, namespace: "share" }) as unknown as ShareT;
      links[l] = `${siteUrl}/o/${encodeURIComponent(data.offering_no)}?lang=${l}`;
      texts[l] = sharePostText(data, l, tl, links[l]);
      titles[l] = shareTitle(data, l, tl);
    }
  }

  return (
    <section className="flex max-w-md flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <h2 className="font-semibold">{t("sectionTitle")}</h2>
      {!isPublic && <p className="text-xs text-neutral-500">{t("newHint")}</p>}
      <ActionForm action={setOfferingSharing.bind(null, offeringId)} submitLabel={t("save")} className="flex flex-col gap-2">
        <ShareSwitches isPublic={isPublic} showAddress={showAddress} />
      </ActionForm>
      {isPublic && <ShareTools defaultLocale={current} links={links} texts={texts} titles={titles} />}
    </section>
  );
}
