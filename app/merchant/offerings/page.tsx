import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/locale";
import { groupOfferings } from "@/lib/slots";

const FILTERS = ["all", "draft", "published", "closed"] as const;
type Filter = (typeof FILTERS)[number];

export default async function OfferingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(status ?? "") ? (status as Filter) : "all";
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("offerings");
  const locale = await getLocale();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, group_id, pickup_date, pickup_start, pickup_end, status, pickup_point:pickup_points(name), offering_items(food_item:food_items(name, translations)), orders(status)")
    .eq("merchant_id", merchant.id)
    .order("pickup_date", { ascending: false });
  const all = offerings ?? [];
  const shown = filter === "all" ? all : all.filter((o) => o.status === filter);
  const countOf = (f: Filter) => groupOfferings(f === "all" ? all : all.filter((o) => o.status === f)).length;

  // The slots of one offering (same group) show as a single row; its page lists every slot.
  const groups = groupOfferings(shown);
  for (const g of groups) g.sort((a, b) => (a.pickup_date + a.pickup_start).localeCompare(b.pickup_date + b.pickup_start));

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("historyTitle")}</h1>
        <Link href="/merchant/offerings/new" className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white">
          {t("newButton")}
        </Link>
      </div>
      <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/merchant/offerings" : `/merchant/offerings?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${f === filter ? "border-orange-600 bg-orange-600 text-white" : "border-neutral-300 hover:border-orange-500 dark:border-neutral-700"}`}
          >
            {f === "all" ? t("filterAll") : t(`status.${f}`)} ({countOf(f)})
          </Link>
        ))}
      </nav>
      {groups.length === 0 && <p className="text-neutral-500">{t("historyEmpty")}</p>}
      <ul className="flex flex-col gap-2">
        {groups.map((slots) => {
          const o = slots[0];
          const statuses = [...new Set(slots.map((s) => s.status as "draft" | "published" | "closed"))];
          const places = [...new Set(slots.map((s) => s.pickup_point?.name).filter(Boolean))];
          return (
            <li key={o.group_id ?? o.id}>
              <Link
                href={`/merchant/offerings/${o.id}`}
                className="block rounded-lg border border-neutral-200 p-3 hover:border-orange-500 dark:border-neutral-800"
              >
                <p className="font-medium">
                  {slots.length === 1 ? (
                    <>
                      {formatDate(o.pickup_date, locale)}, {formatTime(o.pickup_start, locale)}–{formatTime(o.pickup_end, locale)} · {o.pickup_point?.name}
                    </>
                  ) : (
                    formatDate(o.pickup_date, locale)
                  )}
                  {statuses.map((st) => (
                    <span key={st} className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                      {t(`status.${st}`)}
                    </span>
                  ))}
                </p>
                {slots.length > 1 && (
                  <p className="text-sm">
                    {t("slotsSummary", { count: slots.length })} · {places.join(", ")}
                  </p>
                )}
                <p className="text-sm">{t("ordersCount", { count: slots.flatMap((x) => x.orders).filter((x) => x.status !== "cancelled").length })}</p>
                <p className="text-sm text-neutral-500">{o.offering_items.map((i) => i.food_item && localized(i.food_item.name, i.food_item.translations, locale, "name")).join(", ")}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
