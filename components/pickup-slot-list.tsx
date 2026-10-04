import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatTime } from "@/lib/format";
import { groupSlotsByPoint, type SlotLike } from "@/lib/slots";

// Colours for the different times of the SAME place, so two times at one pickup point cannot be mistaken for
// two places (or for each other).
const TIME_COLORS = [
  "border-orange-400 bg-orange-50 text-orange-900 hover:border-orange-600 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100",
  "border-sky-400 bg-sky-50 text-sky-900 hover:border-sky-600 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100",
  "border-emerald-400 bg-emerald-50 text-emerald-900 hover:border-emerald-600 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
  "border-violet-400 bg-violet-50 text-violet-900 hover:border-violet-600 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100",
];

type Slot = SlotLike & { pickup_point: { name: string; address?: string | null } | null };

// Pickup options of an offering, grouped by place. A place with several times shows a badge and one coloured
// button per time; `currentId` marks the slot being viewed.
export async function PickupSlotList({ slots, currentId }: { slots: Slot[]; currentId?: string }) {
  const t = await getTranslations("offering");
  const locale = await getLocale();
  const groups = groupSlotsByPoint(slots);
  const manyDates = new Set(slots.map((s) => s.pickup_date)).size > 1;

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((g) => {
        const place = g.slots[0].pickup_point;
        const several = g.slots.length > 1;
        return (
          <li key={g.pointId} className="rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{place?.name}</span>
              {place?.address && <span className="text-neutral-500">· {place.address}</span>}
              {several && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100">
                  {t("timesHere", { count: g.slots.length })}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.slots.map((s, i) => {
                const current = s.id === currentId;
                const color = several ? TIME_COLORS[i % TIME_COLORS.length] : "border-neutral-300 hover:border-orange-500 dark:border-neutral-700";
                return (
                  <Link
                    key={s.id}
                    href={`/offerings/${s.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${color} ${current ? "ring-2 ring-offset-1 ring-neutral-900 dark:ring-white" : ""}`}
                  >
                    {manyDates ? `${formatDate(s.pickup_date, locale)}, ` : ""}
                    {formatTime(s.pickup_start, locale)}–{formatTime(s.pickup_end, locale)}
                    {current ? ` ${t("here")}` : ""}
                  </Link>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
