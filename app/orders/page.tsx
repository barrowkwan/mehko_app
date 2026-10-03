import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";

export default async function OrdersPage() {
  const { supabase, user } = await requireUser();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, status, created_at,
       offering:offerings(pickup_date, pickup_start, merchant:merchants(name), pickup_point:pickup_points(name)),
       order_items(qty, offering_item:offering_items(food_item:food_items(name)))`,
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">My orders</h1>
      {!orders?.length && <p className="text-neutral-500">You haven&apos;t ordered anything yet.</p>}
      <ul className="flex flex-col gap-3">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/orders/${o.id}`}
              className="block rounded-lg border border-neutral-200 p-4 hover:border-orange-500 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{o.offering?.merchant?.name}</p>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {o.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm">
                {o.offering && `${formatDate(o.offering.pickup_date)}, ${formatTime(o.offering.pickup_start)}`} ·{" "}
                {o.offering?.pickup_point?.name}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {o.order_items.map((i) => `${i.qty}× ${i.offering_item?.food_item?.name}`).join(", ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
