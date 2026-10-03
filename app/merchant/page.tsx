import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";

export default async function MerchantDashboard() {
  const { supabase, merchant } = await requireMerchant();
  const today = new Date().toLocaleDateString("en-CA");
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, pickup_date, pickup_start, status, pickup_point:pickup_points(name), orders(status)")
    .eq("merchant_id", merchant.id)
    .gte("pickup_date", today)
    .order("pickup_date")
    .order("pickup_start");

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{merchant.name}</h1>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Upcoming pickups</h2>
        <Link href="/merchant/offerings/new" className="text-sm text-orange-600 hover:underline">
          + New offering
        </Link>
      </div>
      {!offerings?.length && <p className="text-neutral-500">No upcoming offerings.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {offerings?.map((o) => {
          const active = o.orders.filter((x) => x.status !== "cancelled");
          const picked = active.filter((x) => x.status === "picked_up").length;
          return (
            <li key={o.id}>
              <Link
                href={`/merchant/offerings/${o.id}`}
                className="block rounded-lg border border-neutral-200 p-4 hover:border-orange-500 dark:border-neutral-800"
              >
                <p className="font-semibold">
                  {formatDate(o.pickup_date)}, {formatTime(o.pickup_start)}
                </p>
                <p className="text-sm text-neutral-500">{o.pickup_point?.name}</p>
                <p className="mt-1 text-sm">
                  {active.length} orders · {picked} picked up · {o.status}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
