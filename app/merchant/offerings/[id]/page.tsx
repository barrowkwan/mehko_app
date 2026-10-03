import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { formatCutoff } from "@/lib/cutoff";
import { formatDate, formatTime } from "@/lib/format";
import { LocationToggle } from "@/components/location-toggle";
import { setOfferingStatus } from "../../actions";

export default async function MerchantOfferingPage({ params }: PageProps<"/merchant/offerings/[id]">) {
  const { id } = await params;
  const { supabase, merchant } = await requireMerchant();

  const { data: o } = await supabase
    .from("offerings")
    .select(
      `id, pickup_date, pickup_start, pickup_end, cutoff_at, status,
       pickup_point:pickup_points(name, address, timezone),
       offering_items(id, quantity_limit, food_item:food_items(name))`,
    )
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!o) notFound();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, customer_id, customer:profiles(display_name), order_items(offering_item_id, qty)")
    .eq("offering_id", id)
    .neq("status", "cancelled")
    .order("created_at");

  const totals = new Map<string, number>();
  for (const ord of orders ?? [])
    for (const it of ord.order_items) totals.set(it.offering_item_id, (totals.get(it.offering_item_id) ?? 0) + it.qty);
  const names = new Map(o.offering_items.map((i) => [i.id, i.food_item?.name ?? "Item"]));

  const tz = o.pickup_point?.timezone ?? "UTC";
  const todayAtPoint = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const isPickupDay = todayAtPoint === o.pickup_date;

  return (
    <main className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-xl font-bold">
          {formatDate(o.pickup_date)}, {formatTime(o.pickup_start)}–{formatTime(o.pickup_end)}
        </h1>
        <p className="text-neutral-500">
          {o.pickup_point?.name}
          {o.pickup_point?.address ? ` · ${o.pickup_point.address}` : ""}
        </p>
        <p className="text-sm">Cutoff: {formatCutoff(o.cutoff_at)} · Status: {o.status}</p>
        <div className="mt-2 flex gap-3 text-sm">
          {o.status !== "published" && (
            <form action={setOfferingStatus.bind(null, id, "published")}>
              <button className="text-orange-600 hover:underline">Publish</button>
            </form>
          )}
          {o.status === "published" && (
            <form action={setOfferingStatus.bind(null, id, "closed")}>
              <button className="text-orange-600 hover:underline">Close ordering</button>
            </form>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Prep list</h2>
        <ul className="list-disc pl-5">
          {o.offering_items.map((i) => (
            <li key={i.id}>
              {totals.get(i.id) ?? 0}× {names.get(i.id)}
              {i.quantity_limit ? ` (limit ${i.quantity_limit})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Live location</h2>
        <LocationToggle offeringId={id} enabled={isPickupDay} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Orders ({orders?.length ?? 0})</h2>
        <ul className="flex flex-col gap-2">
          {orders?.map((ord) => (
            <li key={ord.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="font-medium">
                {ord.customer?.display_name ?? "Customer"}
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {ord.status.replace("_", " ")}
                </span>
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {ord.order_items.map((i) => `${i.qty}× ${names.get(i.offering_item_id)}`).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
