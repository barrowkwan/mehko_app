import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/locale";

export default async function OfferingsPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("offerings");
  const locale = await getLocale();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, pickup_date, pickup_start, pickup_end, status, pickup_point:pickup_points(name), offering_items(food_item:food_items(name, translations))")
    .eq("merchant_id", merchant.id)
    .order("pickup_date", { ascending: false });

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Link href="/merchant/offerings/new" className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white">
          {t("newButton")}
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {offerings?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/merchant/offerings/${o.id}`}
              className="block rounded-lg border border-neutral-200 p-3 hover:border-orange-500 dark:border-neutral-800"
            >
              <p className="font-medium">
                {formatDate(o.pickup_date, locale)}, {formatTime(o.pickup_start, locale)}–{formatTime(o.pickup_end, locale)} · {o.pickup_point?.name}
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {t(`status.${o.status as "draft" | "published" | "closed"}`)}
                </span>
              </p>
              <p className="text-sm text-neutral-500">{o.offering_items.map((i) => i.food_item && localized(i.food_item.name, i.food_item.translations, locale, "name")).join(", ")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
