import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { formatDate, formatTime, yesterdayUtc } from "@/lib/format";
import { localized } from "@/lib/locale";
import { groupOfferings } from "@/lib/slots";

export default async function MerchantDashboard() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("dashboard");
  const tStatus = await getTranslations("offerings.status");
  const locale = await getLocale();
  // Show offerings from yesterday on so pickups in timezones behind the server's aren't hidden.
  const since = yesterdayUtc();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, group_id, pickup_date, pickup_start, pickup_end, status, pickup_point:pickup_points(name), orders(status)")
    .eq("merchant_id", merchant.id)
    .neq("status", "closed") // the dashboard is the working view: closed offerings live in History
    .gte("pickup_date", since)
    .order("pickup_date")
    .order("pickup_start");

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{localized(merchant.name, merchant.translations, locale, "name")}</h1>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("upcoming")}</h2>
        <Link href="/merchant/offerings/new" className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white">
          {t("newOffering")}
        </Link>
      </div>
      {!offerings?.length && <p className="text-neutral-500">{t("none")}</p>}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {groupOfferings(offerings ?? []).map((slots) => {
          const o = slots[0];
          const count = (list: typeof slots) => {
            const active = list.flatMap((s) => s.orders).filter((x) => x.status !== "cancelled");
            return { orders: active.length, picked: active.filter((x) => x.status === "picked_up").length };
          };
          const total = count(slots);
          const statuses = [...new Set(slots.map((s) => s.status as "draft" | "published" | "closed"))];
          return (
            <li key={o.group_id ?? o.id}>
              <Link
                href={`/merchant/offerings/${o.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-orange-50 sm:flex-row sm:items-center sm:gap-4 dark:hover:bg-neutral-900"
              >
                <span className="font-semibold sm:w-48 sm:shrink-0">{formatDate(o.pickup_date, locale)}</span>
                <span className="min-w-0 flex-1 text-sm">
                  {slots.map((s) => {
                    const c = count([s]);
                    return (
                      <span key={s.id} className="block">
                        {formatTime(s.pickup_start, locale)}–{formatTime(s.pickup_end, locale)} · {s.pickup_point?.name}
                        {slots.length > 1 && <span className="text-neutral-500"> — {t("slotStats", { orders: c.orders, picked: c.picked })}</span>}
                      </span>
                    );
                  })}
                </span>
                <span className="text-sm sm:text-right">
                  {t("stats", { orders: total.orders, picked: total.picked, status: statuses.map((st) => tStatus(st)).join(" / ") })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
