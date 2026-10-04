import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { isPastCutoff } from "@/lib/cutoff";
import { formatDate, formatInstant, formatTime, todayIn } from "@/lib/format";
import { localized } from "@/lib/locale";
import { foodPhotoUrl } from "@/components/food-photo";
import { OrderForm } from "@/components/order-form";
import { LiveMapLoader } from "@/components/live-map-loader";
import { cancelOrder, updateOrder } from "@/app/orders/actions";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("order");
  const tStatus = await getTranslations("orders.status");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, status, qr_token, offering_id, note,
       offering:offerings(pickup_date, pickup_start, pickup_end, cutoff_at, instructions, translations,
         merchant:merchants(name, translations),
         pickup_point:pickup_points(name, address, lat, lng, timezone),
         offering_items(id, quantity_limit, food_item:food_items(name, description, translations, image_path))),
       order_items(offering_item_id, qty)`,
    )
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!order || !order.offering) notFound();

  const off = order.offering;
  const tz = off.pickup_point?.timezone ?? "UTC";
  const editable = order.status === "placed" && !isPastCutoff(off.cutoff_at);
  const mine = new Map(order.order_items.map((i) => [i.offering_item_id, i.qty]));
  const foodName = (f: { name: string; translations: unknown } | null) =>
    f ? localized(f.name, f.translations, locale, "name") : tc("item");

  const { data: stock } = await supabase.rpc("offering_stock", { p_offering: order.offering_id });
  const remaining = new Map((stock ?? []).map((s) => [s.offering_item_id, s.remaining]));

  const qr = order.status === "cancelled" ? null : await QRCode.toDataURL(order.qr_token, { margin: 1, width: 280 });
  // "Pickup day" is the calendar date at the pickup point, not at the server.
  const showMap = order.status === "placed" && off.pickup_date === todayIn(tz);

  return (
    <main className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-xl font-bold">
          {off.merchant && localized(off.merchant.name, off.merchant.translations, locale, "name")}
        </h1>
        <p>
          {formatDate(off.pickup_date, locale)}, {formatTime(off.pickup_start, locale)}–{formatTime(off.pickup_end, locale)}
        </p>
        <p className="text-neutral-500">
          {off.pickup_point?.name}
          {off.pickup_point?.address ? ` · ${off.pickup_point.address}` : ""}
        </p>
        <p className="mt-1 text-sm">
          {t("statusLabel")} <strong>{tStatus(order.status as "placed" | "cancelled" | "picked_up")}</strong>
        </p>
      </div>

      {qr && order.status === "placed" && (
        <section className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500">{t("showQr")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t("qrAlt")} width={280} height={280} className="rounded bg-white" />
        </section>
      )}
      {order.status === "picked_up" && <p className="text-green-700">{t("pickedUp")}</p>}

      {off.instructions && order.status !== "cancelled" && (
        <section className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950">
          <h2 className="font-semibold">{t("instructionsTitle")}</h2>
          <p className="whitespace-pre-line">{localized(off.instructions, off.translations, locale, "instructions")}</p>
        </section>
      )}

      {showMap && off.pickup_point && (
        <section>
          <h2 className="mb-2 font-semibold">{t("merchantLocation")}</h2>
          <LiveMapLoader
            offeringId={order.offering_id}
            pickup={{ lat: off.pickup_point.lat, lng: off.pickup_point.lng, name: off.pickup_point.name }}
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">{t("yourItems")}</h2>
        {editable ? (
          <>
            <p className="mb-2 text-sm text-orange-700">
              {t("canChangeUntil", { time: formatInstant(off.cutoff_at, locale, tz) })}
            </p>
            <OrderForm
              action={updateOrder.bind(null, id)}
              submitLabel={t("saveChanges")}
              note={order.note}
              items={off.offering_items.map((i) => ({
                offeringItemId: i.id,
                name: foodName(i.food_item),
                description: i.food_item?.description
                  ? localized(i.food_item.description, i.food_item.translations, locale, "description")
                  : null,
                remaining: remaining.has(i.id) ? (remaining.get(i.id) ?? 0) + (mine.get(i.id) ?? 0) : null,
                qty: mine.get(i.id) ?? 0,
                imageUrl: foodPhotoUrl(i.food_item?.image_path),
              }))}
            />
            <form action={cancelOrder.bind(null, id)} className="mt-3">
              <button className="text-sm text-red-600 hover:underline">{t("cancelOrder")}</button>
            </form>
          </>
        ) : (
          <>
            <ul className="list-disc pl-5">
              {off.offering_items
                .filter((i) => mine.has(i.id))
                .map((i) => (
                  <li key={i.id}>
                    {mine.get(i.id)}× {foodName(i.food_item)}
                  </li>
                ))}
            </ul>
            {order.note && (
              <p className="mt-2 text-sm">
                <span className="font-medium">{t("noteTitle")}: </span>
                <span className="whitespace-pre-line">{order.note}</span>
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
