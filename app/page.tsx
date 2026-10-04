import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { localized } from "@/lib/locale";
import { groupOfferings } from "@/lib/slots";
import { FoodPhoto, foodPhotoUrl } from "@/components/food-photo";

// Browse: one short card per merchant that has something open. Details (days, places, foods) are on the
// merchant's page, so the list stays quiet however many merchants there are.
export default async function Home() {
  const { supabase } = await requireUser();
  const t = await getTranslations("home");
  const locale = await getLocale();
  const { data: rows } = await supabase
    .from("offerings")
    .select("id, group_id, pickup_date, merchant:merchants(id, name, description, translations, logo_path)")
    .eq("status", "published")
    .gt("cutoff_at", new Date().toISOString())
    .order("pickup_date")
    .order("pickup_start");

  const merchants = new Map<string, { merchant: NonNullable<NonNullable<typeof rows>[number]["merchant"]>; offerings: number; nextDate: string }>();
  for (const slots of groupOfferings(rows ?? [])) {
    const m = slots[0].merchant;
    if (!m) continue;
    const entry = merchants.get(m.id);
    if (entry) entry.offerings += 1;
    else merchants.set(m.id, { merchant: m, offerings: 1, nextDate: slots[0].pickup_date }); // rows are sorted by date, so the first is the soonest
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {merchants.size === 0 && <p className="text-neutral-500">{t("empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {[...merchants.values()].map(({ merchant, offerings, nextDate }) => (
          <li key={merchant.id}>
            <Link
              href={`/merchants/${merchant.id}`}
              className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4 hover:border-orange-500 dark:border-neutral-800"
            >
              <FoodPhoto url={foodPhotoUrl(merchant.logo_path)} alt="" size={48} />
              <div className="min-w-0">
              <p className="font-semibold">{localized(merchant.name, merchant.translations, locale, "name")}</p>
              {merchant.description && (
                <p className="line-clamp-2 whitespace-pre-line text-sm text-neutral-600 dark:text-neutral-400">
                  {localized(merchant.description, merchant.translations, locale, "description")}
                </p>
              )}
              <p className="mt-2 text-xs text-orange-700">
                {t("openCount", { count: offerings })} · {t("nextPickup", { date: formatDate(nextDate, locale) })}
              </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
