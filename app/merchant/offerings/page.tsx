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
    .select("id, group_id, pickup_date, pickup_start, pickup_end, status, pickup_point:pickup_points(name), offering_items(food_item:food_items(name, translations))")
    .eq("merchant_id", merchant.id)
    .order("pickup_date", { ascending: false });

  // The slots of one offering (same group) show as a single row; its page lists every slot.
  const groups: NonNullable<typeof offerings>[] = [];
  const index = new Map<string, number>();
  for (const o of offerings ?? []) {
    const key = o.group_id ?? o.id;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, groups.length);
      groups.push([o]);
    } else groups[at].push(o);
  }
  for (const g of groups) g.sort((a, b) => (a.pickup_date + a.pickup_start).localeCompare(b.pickup_date + b.pickup_start));

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Link href="/merchant/offerings/new" className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white">
          {t("newButton")}
        </Link>
      </div>
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
                <p className="text-sm text-neutral-500">{o.offering_items.map((i) => i.food_item && localized(i.food_item.name, i.food_item.translations, locale, "name")).join(", ")}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
