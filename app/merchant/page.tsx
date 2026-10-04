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
    .gte("pickup_date", since)
    .order("pickup_date")
    .order("pickup_start");

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{localized(merchant.name, merchant.translations, locale, "name")}</h1>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("upcoming")}</h2>
        <Link href="/merchant/offerings/new" className="text-sm text-orange-600 hover:underline">
          {t("newOffering")}
        </Link>
      </div>
      {!offerings?.length && <p className="text-neutral-500">{t("none")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
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
                className="block rounded-lg border border-neutral-200 p-4 hover:border-orange-500 dark:border-neutral-800"
              >
                <p className="font-semibold">
                  {formatDate(o.pickup_date, locale)}
                  {slots.length === 1 ? `, ${formatTime(o.pickup_start, locale)}` : ""}
                </p>
                {slots.length === 1 ? (
                  <p className="text-sm text-neutral-500">{o.pickup_point?.name}</p>
                ) : (
                  <ul className="text-sm text-neutral-500">
                    {slots.map((s) => {
                      const c = count([s]);
                      return (
                        <li key={s.id}>
                          {formatTime(s.pickup_start, locale)} · {s.pickup_point?.name} — {t("slotStats", { orders: c.orders, picked: c.picked })}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-1 text-sm">
                  {t("stats", { orders: total.orders, picked: total.picked, status: statuses.map((st) => tStatus(st)).join(" / ") })}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
