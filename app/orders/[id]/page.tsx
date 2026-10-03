import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatCutoff, isPastCutoff } from "@/lib/cutoff";
import { formatDate, formatTime } from "@/lib/format";
import { OrderForm } from "@/components/order-form";
import { LiveMapLoader } from "@/components/live-map-loader";
import { cancelOrder, updateOrder } from "@/app/orders/actions";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, status, qr_token, offering_id,
       offering:offerings(pickup_date, pickup_start, pickup_end, cutoff_at,
         merchant:merchants(name),
         pickup_point:pickup_points(name, address, lat, lng),
         offering_items(id, quantity_limit, food_item:food_items(name, description))),
       order_items(offering_item_id, qty)`,
    )
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!order || !order.offering) notFound();

  const off = order.offering;
  const editable = order.status === "placed" && !isPastCutoff(off.cutoff_at);
  const mine = new Map(order.order_items.map((i) => [i.offering_item_id, i.qty]));

  const { data: stock } = await supabase.rpc("offering_stock", { p_offering: order.offering_id });
  const remaining = new Map((stock ?? []).map((s) => [s.offering_item_id, s.remaining]));

  const qr = order.status === "cancelled" ? null : await QRCode.toDataURL(order.qr_token, { margin: 1, width: 280 });
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the viewer's timezone
  const showMap = order.status === "placed" && off.pickup_date === today;

  return (
    <main className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-xl font-bold">{off.merchant?.name}</h1>
        <p>
          {formatDate(off.pickup_date)}, {formatTime(off.pickup_start)}–{formatTime(off.pickup_end)}
        </p>
        <p className="text-neutral-500">
          {off.pickup_point?.name}
          {off.pickup_point?.address ? ` · ${off.pickup_point.address}` : ""}
        </p>
        <p className="mt-1 text-sm">
          Status: <strong>{order.status.replace("_", " ")}</strong>
        </p>
      </div>

      {qr && order.status === "placed" && (
        <section className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500">Show this code to the merchant at pickup</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Order QR code" width={280} height={280} className="rounded bg-white" />
        </section>
      )}
      {order.status === "picked_up" && <p className="text-green-700">Picked up. Enjoy your meal!</p>}

      {showMap && off.pickup_point && (
        <section>
          <h2 className="mb-2 font-semibold">Merchant location</h2>
          <LiveMapLoader
            offeringId={order.offering_id}
            pickup={{ lat: off.pickup_point.lat, lng: off.pickup_point.lng, name: off.pickup_point.name }}
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Your items</h2>
        {editable ? (
          <>
            <p className="mb-2 text-sm text-orange-700">You can change this order until {formatCutoff(off.cutoff_at)}.</p>
            <OrderForm
              action={updateOrder.bind(null, id)}
              submitLabel="Save changes"
              items={off.offering_items.map((i) => ({
                offeringItemId: i.id,
                name: i.food_item?.name ?? "Item",
                description: i.food_item?.description ?? null,
                remaining: remaining.has(i.id) ? (remaining.get(i.id) ?? 0) + (mine.get(i.id) ?? 0) : null,
                qty: mine.get(i.id) ?? 0,
              }))}
            />
            <form action={cancelOrder.bind(null, id)} className="mt-3">
              <button className="text-sm text-red-600 hover:underline">Cancel order</button>
            </form>
          </>
        ) : (
          <ul className="list-disc pl-5">
            {off.offering_items
              .filter((i) => mine.has(i.id))
              .map((i) => (
                <li key={i.id}>
                  {mine.get(i.id)}× {i.food_item?.name}
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}
