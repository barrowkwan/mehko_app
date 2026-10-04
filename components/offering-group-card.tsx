import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/locale";
import { LocalInstantText } from "@/components/local-instant";
import { PickupSlotList } from "@/components/pickup-slot-list";

type Slot = {
  id: string;
  group_id: string | null;
  pickup_point_id: string;
  pickup_date: string;
  pickup_start: string;
  pickup_end: string;
  cutoff_at: string;
  pickup_point: { name: string; address: string | null; timezone: string } | null;
  offering_items: { food_item: { name: string; translations: unknown } | null }[];
};

// One offering of a merchant (all its pickup slots). A single slot is a link to the order page; several slots
// show the places/times to choose from.
export async function OfferingGroupCard({ slots }: { slots: Slot[] }) {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const o = slots[0];
  const tz = o.pickup_point?.timezone ?? "UTC";
  const cardClass = "block rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

  const head = (
    <>
      <p className="font-semibold">{formatDate(o.pickup_date, locale)}</p>
      {slots.length === 1 ? (
        <>
          <p className="text-sm">
            {formatTime(o.pickup_start, locale)}–{formatTime(o.pickup_end, locale)}
          </p>
          <p className="text-sm text-neutral-500">
            {o.pickup_point?.name}
            {o.pickup_point?.address ? ` · ${o.pickup_point.address}` : ""}
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">{t("slotsCount", { count: slots.length })}</p>
      )}
    </>
  );
  const foods = (
    <>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {o.offering_items.map((i) => i.food_item && localized(i.food_item.name, i.food_item.translations, locale, "name")).join(", ")}
      </p>
      <p className="mt-2 text-xs text-orange-700">
        <LocalInstantText messageKey="home.orderBy" iso={o.cutoff_at} fallbackTimeZone={tz} />
      </p>
    </>
  );

  return slots.length === 1 ? (
    <Link href={`/offerings/${o.id}`} className={`${cardClass} hover:border-orange-500`}>
      {head}
      {foods}
    </Link>
  ) : (
    <div className={cardClass}>
      {head}
      <div className="mt-2">
        <PickupSlotList slots={slots} />
      </div>
      {foods}
    </div>
  );
}
