import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { DIMENSIONS, topFoodsBy, type Dimension, type OrderLine } from "@/lib/reports";
import { formatDate } from "@/lib/format";

export default async function ReportsPage({ searchParams }: PageProps<"/merchant/reports">) {
  const sp = await searchParams;
  const by = (DIMENSIONS.find((d) => d.id === sp.by)?.id ?? "date") as Dimension;
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("reports");
  const locale = await getLocale();

  const { data: lines } = await supabase
    .from("order_lines")
    .select("food_name, qty, pickup_date, pickup_point_name, is_holiday, holiday_name, weather_bucket")
    .eq("merchant_id", merchant.id)
    .limit(10000);

  // View columns are typed nullable by Postgres; rows from a valid join always have these set.
  const rows: OrderLine[] = (lines ?? []).map((l) => ({
    food_name: l.food_name ?? "?",
    qty: l.qty ?? 0,
    pickup_date: l.pickup_date ?? "",
    pickup_point_name: l.pickup_point_name ?? "?",
    is_holiday: l.is_holiday ?? false,
    holiday_name: l.holiday_name,
    weather_bucket: l.weather_bucket,
  }));
  const groups = topFoodsBy(rows, by);
  const max = Math.max(1, ...groups.flatMap((g) => g.foods.map((f) => f.qty)));

  const weatherKeys = ["clear", "cloudy", "rain", "snow", "hot", "cold", "unknown"] as const;
  function label(key: string): string {
    if (by === "date") return formatDate(key, locale);
    if (by === "holiday") {
      if (key === "regular") return t("regularDay");
      return t("holiday", { name: key.slice("holiday:".length) || t("publicHoliday") });
    }
    if (by === "weather") return (weatherKeys as readonly string[]).includes(key) ? t(`weather.${key as (typeof weatherKeys)[number]}`) : key;
    return key;
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {DIMENSIONS.map((d) => (
          <Link
            key={d.id}
            href={`/merchant/reports?by=${d.id}`}
            className={`rounded-full border px-3 py-1 ${by === d.id ? "border-orange-600 bg-orange-600 text-white" : "border-neutral-300 dark:border-neutral-700"}`}
          >
            {t(d.labelKey)}
          </Link>
        ))}
      </div>
      {by === "weather" && <p className="text-xs text-neutral-500">{t("weatherNote")}</p>}
      {!groups.length && <p className="text-neutral-500">{t("empty")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.key} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="mb-2 font-semibold">
              {label(g.key)} <span className="text-sm font-normal text-neutral-500">{t("items", { count: g.total })}</span>
            </h2>
            <ul className="flex flex-col gap-1.5">
              {g.foods.map((f) => (
                <li key={f.name} className="text-sm">
                  <div className="flex justify-between">
                    <span>{f.name}</span>
                    <span>{f.qty}</span>
                  </div>
                  <div className="h-1.5 rounded bg-neutral-100 dark:bg-neutral-800">
                    <div className="h-1.5 rounded bg-orange-500" style={{ width: `${(f.qty / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
