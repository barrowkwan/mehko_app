import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatCutoff } from "@/lib/cutoff";
import { formatDate, formatTime } from "@/lib/format";

export default async function Home() {
  const { supabase } = await requireUser();
  const { data: offerings } = await supabase
    .from("offerings")
    .select(
      `id, pickup_date, pickup_start, pickup_end, cutoff_at,
       merchant:merchants(id, name),
       pickup_point:pickup_points(name, address),
       offering_items(food_item:food_items(name))`,
    )
    .eq("status", "published")
    .gt("cutoff_at", new Date().toISOString())
    .order("pickup_date")
    .order("pickup_start");

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Open for ordering</h1>
      {!offerings?.length && <p className="text-neutral-500">Nothing is open for ordering right now.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {offerings?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/offerings/${o.id}`}
              className="block rounded-lg border border-neutral-200 p-4 hover:border-orange-500 dark:border-neutral-800"
            >
              <p className="font-semibold">{o.merchant?.name}</p>
              <p className="text-sm">
                {formatDate(o.pickup_date)}, {formatTime(o.pickup_start)}–{formatTime(o.pickup_end)}
              </p>
              <p className="text-sm text-neutral-500">
                {o.pickup_point?.name}
                {o.pickup_point?.address ? ` · ${o.pickup_point.address}` : ""}
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {o.offering_items.map((i) => i.food_item?.name).join(", ")}
              </p>
              <p className="mt-2 text-xs text-orange-700">Order by {formatCutoff(o.cutoff_at)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
