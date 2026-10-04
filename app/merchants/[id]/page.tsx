import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { localized } from "@/lib/locale";
import { groupOfferings } from "@/lib/slots";
import { OfferingGroupCard } from "@/components/offering-group-card";

// A merchant's open offerings. Browse shows one card per merchant; this page is where the customer picks an offering.
export default async function MerchantPublicPage({ params }: PageProps<"/merchants/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const t = await getTranslations("merchantPage");
  const locale = await getLocale();

  const { data: merchant } = await supabase.from("merchants").select("id, name, description, translations").eq("id", id).maybeSingle();
  if (!merchant) notFound();

  const { data: rows } = await supabase
    .from("offerings")
    .select(
      `id, group_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at,
       pickup_point:pickup_points(name, address, timezone),
       offering_items(food_item:food_items(name, translations))`,
    )
    .eq("merchant_id", id)
    .eq("status", "published")
    .gt("cutoff_at", new Date().toISOString())
    .order("pickup_date")
    .order("pickup_start");
  const offerings = groupOfferings(rows ?? []);

  return (
    <main className="flex flex-col gap-4 p-4">
      <Link href="/" className="text-sm text-orange-600 hover:underline">
        {t("back")}
      </Link>
      <div>
        <h1 className="text-xl font-bold">{localized(merchant.name, merchant.translations, locale, "name")}</h1>
        {merchant.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{localized(merchant.description, merchant.translations, locale, "description")}</p>
        )}
      </div>
      {!offerings.length && <p className="text-neutral-500">{t("empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {offerings.map((slots) => (
          <li key={slots[0].group_id ?? slots[0].id}>
            <OfferingGroupCard slots={slots} />
          </li>
        ))}
      </ul>
    </main>
  );
}
