import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { formatDate, formatInstant, formatTime } from "@/lib/format";
import { localized, type Locale } from "@/lib/locale";
import { parseSharedOffering, previewImageUrl, shareLocale, type SharedOffering } from "@/lib/shared-offering";
import { shareDescription, shareTitle, type ShareT } from "@/lib/share-text";
import { groupSlotsByPoint } from "@/lib/slots";
import { FoodPhoto } from "@/components/food-photo";
import { foodImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";

// The public page of a shared offering (no sign-in). It exists so that a link pasted into Facebook, WhatsApp, etc.
// previews what is on offer: the Open Graph tags below are rendered on the server, where the link-preview robots
// (which cannot sign in) read them. Only offerings the merchant has chosen to share are available; everything else is a
// plain 404. The data comes from one whitelisting SQL function, get_shared_offering.
export const dynamic = "force-dynamic";

const load = cache(async (offeringNo: string): Promise<SharedOffering | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_offering", { p_offering_no: offeringNo });
  return parseSharedOffering(data);
});

async function translator(locale: Locale): Promise<ShareT> {
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return createTranslator({ locale, messages, namespace: "share" }) as unknown as ShareT;
}

type Props = PageProps<"/o/[offeringNo]">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { offeringNo } = await params;
  const sp = await searchParams;
  const data = await load(offeringNo);
  const base = await getSiteUrl();
  const noIndex = { robots: { index: false, follow: false } };
  if (!data) return { title: "Neighborhood Eats", ...noIndex };

  const locale = shareLocale(sp.lang, await getLocale());
  const t = await translator(locale);
  const title = shareTitle(data, locale, t);
  const description = shareDescription(data, locale, t);
  const url = `${base}/o/${encodeURIComponent(data.offering_no)}${typeof sp.lang === "string" ? `?lang=${encodeURIComponent(sp.lang)}` : ""}`;
  const image = previewImageUrl(data, process.env.NEXT_PUBLIC_SUPABASE_URL) ?? `${base}/icons/icon.svg`;
  return {
    metadataBase: base ? new URL(base) : undefined,
    title,
    description,
    ...noIndex,
    openGraph: { type: "website", title, description, url, siteName: "Neighborhood Eats", images: [{ url: image }], locale: locale.replace("-", "_") },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedOfferingPage({ params, searchParams }: Props) {
  const { offeringNo } = await params;
  const sp = await searchParams;
  const data = await load(offeringNo);
  if (!data) notFound();

  const locale = shareLocale(sp.lang, await getLocale());
  const t = await translator(locale);
  const page = (key: string, values?: Record<string, string | number>) => t(`page.${key}`, values);
  const name = localized(data.merchant.name, data.merchant.translations, locale, "name");
  const description = data.merchant.description ? localized(data.merchant.description, data.merchant.translations, locale, "description") : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const logo = foodImageUrl(supabaseUrl, data.merchant.logo_path);
  const openSlot = data.slots.find((s) => s.open);
  const manyDates = new Set(data.slots.map((s) => s.pickup_date)).size > 1;
  const anyAddressHidden = data.slots.some((s) => !s.address);

  return (
    <main lang={locale} className="mx-auto flex w-full max-w-xl flex-col gap-5 p-4">
      <header className="flex items-start gap-3">
        <FoodPhoto url={logo} alt={name} size={64} />
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          {description && <p className="whitespace-pre-line text-sm text-neutral-600 dark:text-neutral-400">{description}</p>}
          <p className="mt-1 font-mono text-xs text-neutral-500">{page("offeringNumber", { number: data.offering_no })}</p>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{page("pickupTitle")}</h2>
        <ul className="flex flex-col gap-2">
          {groupSlotsByPoint(data.slots.map((s) => ({ ...s, pickup_point_id: `${s.place}|${s.address ?? ""}` }))).map((g) => (
            <li key={g.pointId} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="font-medium">{g.slots[0].place}</p>
              {g.slots[0].address && <p className="text-sm text-neutral-500">{g.slots[0].address}</p>}
              <p className="mt-1 flex flex-wrap gap-2 text-sm">
                {g.slots.map((s) => (
                  <span key={s.id} className="rounded-md border border-orange-300 bg-orange-50 px-2 py-1 font-medium text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100">
                    {manyDates ? `${formatDate(s.pickup_date, locale)}, ` : ""}
                    {formatTime(s.pickup_start, locale)}–{formatTime(s.pickup_end, locale)}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
        {!manyDates && <p className="mt-1 text-sm font-medium">{formatDate(data.slots[0].pickup_date, locale)}</p>}
        {anyAddressHidden && <p className="mt-1 text-xs text-neutral-500">{page("addressAfterSignIn")}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{page("foodsTitle")}</h2>
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {data.foods.map((f, i) => (
            <li key={i} className="flex items-center gap-3 p-3">
              <FoodPhoto url={foodImageUrl(supabaseUrl, f.image_path)} alt={localized(f.name, f.translations, locale, "name")} />
              <div>
                <p className="font-medium">
                  {localized(f.name, f.translations, locale, "name")}
                  {f.price_cents != null && <span className="ml-2 text-orange-700">{formatMoney(f.price_cents, locale)}</span>}
                </p>
                {f.description && <p className="whitespace-pre-line text-sm text-neutral-500">{localized(f.description, f.translations, locale, "description")}</p>}
                {f.limit && <p className="text-xs text-neutral-500">{page("limitHint", { count: f.limit })}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm">
        <span className="font-semibold">{page("cutoffTitle")}:</span> {formatInstant(data.cutoff_at, locale, data.slots[0].timezone)}
      </p>

      {data.open && openSlot ? (
        <div className="flex flex-col gap-1">
          <Link href={`/offerings/${openSlot.id}`} className="rounded-lg bg-orange-600 px-4 py-3 text-center text-lg font-semibold text-white hover:bg-orange-700">
            {page("orderNow")}
          </Link>
          <p className="text-center text-xs text-neutral-500">{page("signInNote")}</p>
        </div>
      ) : (
        <p role="status" className="rounded-lg bg-neutral-100 p-3 text-center text-sm dark:bg-neutral-800">
          {page("closed")}
        </p>
      )}
    </main>
  );
}
