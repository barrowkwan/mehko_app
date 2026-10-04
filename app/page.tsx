import { PickupSlotList } from "@/components/pickup-slot-list";
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
      `id, group_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at,
       merchant:merchants(id, name, translations),
       pickup_point:pickup_points(name, address, timezone),
       offering_items(food_item:food_items(name, translations))`,
    )
    .eq("status", "published")
    .gt("cutoff_at", new Date().toISOString())
    .order("pickup_date")
    .order("pickup_start");

  // Slots of one offering (same group) are shown as one card with a choice of pickup slots.
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

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {!offerings?.length && <p className="text-neutral-500">{t("empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {groups.map((slots) => {
          const o = slots[0];
          const tz = o.pickup_point?.timezone ?? "UTC";
          const cardClass = "block rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";
          const slotLine = (s: (typeof slots)[number]) => (
            <>
              <span className="text-sm">
                {formatDate(s.pickup_date, locale)}, {formatTime(s.pickup_start, locale)}–{formatTime(s.pickup_end, locale)}
              </span>
              <span className="block text-sm text-neutral-500">
                {s.pickup_point?.name}
                {s.pickup_point?.address ? ` · ${s.pickup_point.address}` : ""}
              </span>
            </>
          );
          const body = (
            <>
              <p className="font-semibold">
                {o.merchant && localized(o.merchant.name, o.merchant.translations, locale, "name")}
              </p>
              {slots.length === 1 ? (
                <p>{slotLine(o)}</p>
              ) : (
                <p className="text-sm text-neutral-500">{t("slotsCount", { count: slots.length })}</p>
              )}
            </>
          );
          const foods = (
            <>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {o.offering_items
                  .map((i) => i.food_item && localized(i.food_item.name, i.food_item.translations, locale, "name"))
                  .join(", ")}
              </p>
              <p className="mt-2 text-xs text-orange-700">
                <LocalInstantText messageKey="home.orderBy" iso={o.cutoff_at} fallbackTimeZone={tz} />
              </p>
            </>
          );
          return (
            <li key={o.group_id ?? o.id}>
              {slots.length === 1 ? (
                <Link href={`/offerings/${o.id}`} className={`${cardClass} hover:border-orange-500`}>
                  {body}
                  {foods}
                </Link>
              ) : (
                <div className={cardClass}>
                  {body}
                  <div className="mt-2">
                    <PickupSlotList slots={slots} />
                  </div>
                  {foods}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
