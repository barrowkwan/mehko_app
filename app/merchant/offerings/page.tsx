import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";

export default async function OfferingsPage() {
  const { supabase, merchant } = await requireMerchant();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, pickup_date, pickup_start, pickup_end, status, pickup_point:pickup_points(name), offering_items(food_item:food_items(name))")
    .eq("merchant_id", merchant.id)
    .order("pickup_date", { ascending: false });

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Offerings</h1>
        <Link href="/merchant/offerings/new" className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white">
          New offering
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {offerings?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/merchant/offerings/${o.id}`}
              className="block rounded-lg border border-neutral-200 p-3 hover:border-orange-500 dark:border-neutral-800"
            >
              <p className="font-medium">
                {formatDate(o.pickup_date)}, {formatTime(o.pickup_start)}–{formatTime(o.pickup_end)} · {o.pickup_point?.name}
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">{o.status}</span>
              </p>
              <p className="text-sm text-neutral-500">{o.offering_items.map((i) => i.food_item?.name).join(", ")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
