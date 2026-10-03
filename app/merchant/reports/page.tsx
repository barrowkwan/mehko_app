import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { DIMENSIONS, topFoodsBy, type Dimension } from "@/lib/reports";
import { formatDate } from "@/lib/format";

export default async function ReportsPage({ searchParams }: PageProps<"/merchant/reports">) {
  const sp = await searchParams;
  const by = (DIMENSIONS.find((d) => d.id === sp.by)?.id ?? "date") as Dimension;
  const { supabase, merchant } = await requireMerchant();

  const { data: lines } = await supabase
    .from("order_lines")
    .select("food_name, qty, pickup_date, pickup_point_name, is_holiday, holiday_name, weather_bucket")
    .eq("merchant_id", merchant.id)
    .limit(10000);

  const groups = topFoodsBy(lines ?? [], by);
  const max = Math.max(1, ...groups.flatMap((g) => g.foods.map((f) => f.qty)));

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Most ordered foods</h1>
      <div className="flex gap-2 text-sm">
        {DIMENSIONS.map((d) => (
          <Link
            key={d.id}
            href={`/merchant/reports?by=${d.id}`}
            className={`rounded-full border px-3 py-1 ${by === d.id ? "border-orange-600 bg-orange-600 text-white" : "border-neutral-300 dark:border-neutral-700"}`}
          >
            {d.label}
          </Link>
        ))}
      </div>
      {by === "weather" && (
        <p className="text-xs text-neutral-500">
          Weather and holiday data is added automatically for each pickup date; very recent or future offerings may show as unknown.
        </p>
      )}
      {!groups.length && <p className="text-neutral-500">No orders yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.key} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="mb-2 font-semibold">
              {by === "date" ? formatDate(g.key) : g.key}{" "}
              <span className="text-sm font-normal text-neutral-500">({g.total} items)</span>
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
