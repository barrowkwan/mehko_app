import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatCutoff, isPastCutoff } from "@/lib/cutoff";
import { formatDate, formatTime } from "@/lib/format";
import { OrderForm } from "@/components/order-form";
import { placeOrder } from "@/app/orders/actions";

export default async function OfferingPage({ params }: PageProps<"/offerings/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: offering } = await supabase
    .from("offerings")
    .select(
      `id, pickup_date, pickup_start, pickup_end, cutoff_at, status,
       merchant:merchants(name, description),
       pickup_point:pickup_points(name, address),
       offering_items(id, quantity_limit, food_item:food_items(name, description))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!offering) notFound();

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("offering_id", id)
    .eq("customer_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) redirect(`/orders/${existing.id}`);

  const closed = isPastCutoff(offering.cutoff_at);
  const { data: stock } = await supabase.rpc("offering_stock", { p_offering: id });
  const remaining = new Map((stock ?? []).map((s) => [s.offering_item_id, s.remaining]));

  return (
    <main className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{offering.merchant?.name}</h1>
        <p>
          {formatDate(offering.pickup_date)}, {formatTime(offering.pickup_start)}–{formatTime(offering.pickup_end)}
        </p>
        <p className="text-neutral-500">
          Pickup: {offering.pickup_point?.name}
          {offering.pickup_point?.address ? ` · ${offering.pickup_point.address}` : ""}
        </p>
        <p className="text-sm text-orange-700">
          {closed ? "Ordering is closed." : `Order by ${formatCutoff(offering.cutoff_at)}`}
        </p>
      </div>
      {!closed && (
        <OrderForm
          action={placeOrder.bind(null, id)}
          submitLabel="Place order"
          items={offering.offering_items.map((i) => ({
            offeringItemId: i.id,
            name: i.food_item?.name ?? "Item",
            description: i.food_item?.description ?? null,
            remaining: remaining.get(i.id) ?? null,
            qty: 0,
          }))}
        />
      )}
    </main>
  );
}
