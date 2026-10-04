import { LocalInstantText } from "@/components/local-instant";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/locale";

export default async function Home() {
  const { supabase } = await requireUser();
  const t = await getTranslations("home");
  const locale = await getLocale();
  const { data: offerings } = await supabase
    .from("offerings")
    .select(
      `id, pickup_date, pickup_start, pickup_end, cutoff_at,
       merchant:merchants(id, name, translations),
       pickup_point:pickup_points(name, address, timezone),
       offering_items(food_item:food_items(name, translations))`,
    )
    .eq("status", "published")
    .gt("cutoff_at", new Date().toISOString())
    .order("pickup_date")
    .order("pickup_start");

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {!offerings?.length && <p className="text-neutral-500">{t("empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {offerings?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/offerings/${o.id}`}
              className="block rounded-lg border border-neutral-200 p-4 hover:border-orange-500 dark:border-neutral-800"
            >
              <p className="font-semibold">
                {o.merchant && localized(o.merchant.name, o.merchant.translations, locale, "name")}
              </p>
              <p className="text-sm">
                {formatDate(o.pickup_date, locale)}, {formatTime(o.pickup_start, locale)}–{formatTime(o.pickup_end, locale)}
              </p>
              <p className="text-sm text-neutral-500">
                {o.pickup_point?.name}
                {o.pickup_point?.address ? ` · ${o.pickup_point.address}` : ""}
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {o.offering_items
                  .map((i) => i.food_item && localized(i.food_item.name, i.food_item.translations, locale, "name"))
                  .join(", ")}
              </p>
              <p className="mt-2 text-xs text-orange-700">
                <LocalInstantText messageKey="home.orderBy" iso={o.cutoff_at} fallbackTimeZone={o.pickup_point?.timezone ?? "UTC"} />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
