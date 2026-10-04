import { LocalInstantText } from "@/components/local-instant";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { formatDate, formatTime, todayIn } from "@/lib/format";
import { localized } from "@/lib/locale";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { LocationToggle } from "@/components/location-toggle";
import { SlotFields } from "@/components/slot-fields";
import { addOfferingSlot, deleteOffering, duplicateOffering, setOfferingStatus } from "../../actions";

export default async function MerchantOfferingPage({ params }: PageProps<"/merchant/offerings/[id]">) {
  const { id } = await params;
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("offeringDetail");
  const tStatus = await getTranslations("offerings.status");
  const tOrders = await getTranslations("orders.status");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  const { data: o } = await supabase
    .from("offerings")
    .select(
      `id, group_id, merchant_id, pickup_date, pickup_start, pickup_end, cutoff_at, status,
       pickup_point:pickup_points(name, address, timezone),
       offering_items(id, quantity_limit, food_item:food_items(name, translations))`,
    )
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!o) notFound();

  const [{ data: slots }, { data: points }] = await Promise.all([
    o.group_id
      ? supabase
          .from("offerings")
          .select("id, pickup_date, pickup_start, pickup_end, status, pickup_point:pickup_points(name)")
          .eq("group_id", o.group_id)
          .order("pickup_date")
          .order("pickup_start")
      : Promise.resolve({ data: null }),
    supabase.from("pickup_points").select("id, name").eq("merchant_id", merchant.id).eq("active", true).order("name"),
  ]);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, customer_id, note, customer:profiles(display_name), order_items(offering_item_id, qty)")
    .eq("offering_id", id)
    .neq("status", "cancelled")
    .order("created_at");

  const totals = new Map<string, number>();
  for (const ord of orders ?? [])
    for (const it of ord.order_items) totals.set(it.offering_item_id, (totals.get(it.offering_item_id) ?? 0) + it.qty);
  const notes = (orders ?? []).filter((ord) => ord.note);
  const names = new Map(
    o.offering_items.map((i) => [i.id, i.food_item ? localized(i.food_item.name, i.food_item.translations, locale, "name") : tc("item")]),
  );

  const tz = o.pickup_point?.timezone ?? "UTC";
  const today = todayIn(tz);
  const isPickupDay = today === o.pickup_date;
  const past = today > o.pickup_date;
  const canDelete = (orders?.length ?? 0) === 0; // cancelled orders are not listed; they go with the offering
  const status = o.status as "draft" | "published" | "closed";

  return (
    <main className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-xl font-bold">
          {formatDate(o.pickup_date, locale)}, {formatTime(o.pickup_start, locale)}–{formatTime(o.pickup_end, locale)}
        </h1>
        <p className="text-neutral-500">
          {o.pickup_point?.name}
          {o.pickup_point?.address ? ` · ${o.pickup_point.address}` : ""}
        </p>
        <p className="text-sm"><LocalInstantText messageKey="offeringDetail.cutoffLine" iso={o.cutoff_at} fallbackTimeZone={tz} values={{ status: tStatus(status) }} /></p>
        <div className="mt-2 flex gap-3 text-sm">
          {status !== "published" && (
            <form action={setOfferingStatus.bind(null, id, "published")}>
              <button className="text-orange-600 hover:underline">{t("publish")}</button>
            </form>
          )}
          {status === "published" && (
            <form action={setOfferingStatus.bind(null, id, "closed")}>
              <button className="text-orange-600 hover:underline">{t("closeOrdering")}</button>
            </form>
          )}
          {!past && (
            <Link href={`/merchant/offerings/${id}/edit`} className="text-orange-600 hover:underline">
              {t("edit")}
            </Link>
          )}
        </div>
      </div>

      <section className="flex max-w-md flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <h2 className="font-semibold">{t("slotsTitle")}</h2>
        {slots && slots.length > 1 && (
          <>
            <p className="text-xs text-neutral-500">{t("slotsHelp")}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {slots.map((s) => (
                <li key={s.id}>
                  {s.id === id ? (
                    <span className="font-medium">
                      {formatDate(s.pickup_date, locale)}, {formatTime(s.pickup_start, locale)}–{formatTime(s.pickup_end, locale)} · {s.pickup_point?.name} {t("thisSlot")}
                    </span>
                  ) : (
                    <Link href={`/merchant/offerings/${s.id}`} className="text-orange-600 hover:underline">
                      {formatDate(s.pickup_date, locale)}, {formatTime(s.pickup_start, locale)}–{formatTime(s.pickup_end, locale)} · {s.pickup_point?.name}
                    </Link>
                  )}{" "}
                  <span className="text-neutral-500">({tStatus(s.status as "draft" | "published" | "closed")})</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {!past && points && points.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-orange-600">{t("addSlotTitle")}</summary>
            <ActionForm action={addOfferingSlot.bind(null, id)} submitLabel={t("addSlotSubmit")} className="mt-2 flex flex-col gap-3">
              <SlotFields points={points} prefix="slot_0_" />
            </ActionForm>
          </details>
        )}
      </section>

      <section className="flex max-w-md flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-orange-600">{t("duplicateTitle")}</summary>
          <p className="my-2 text-xs text-neutral-500">{t("duplicateHelp")}</p>
          <ActionForm action={duplicateOffering.bind(null, id)} submitLabel={t("duplicateSubmit")}>
            <Field label={t("duplicateDate")}>
              <input type="date" name="new_date" required min={today} className={inputClass} />
            </Field>
          </ActionForm>
        </details>
        {canDelete ? (
          <ActionForm
            action={deleteOffering.bind(null, id)}
            submitLabel={t("delete")}
            buttonClassName="bg-red-600 hover:bg-red-700"
            confirmMessage={t("deleteConfirm")}
          >
            <></>
          </ActionForm>
        ) : (
          <p className="text-xs text-neutral-500">{t("deleteBlocked")}</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t("prepList")}</h2>
        <ul className="list-disc pl-5">
          {o.offering_items.map((i) => (
            <li key={i.id}>
              {totals.get(i.id) ?? 0}× {names.get(i.id)}
              {i.quantity_limit ? ` ${t("limit", { count: i.quantity_limit })}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {notes.length > 0 && (
        <section className="rounded-lg border border-yellow-400 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950">
          <h2 className="mb-2 font-semibold">{t("customerNotes", { count: notes.length })}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {notes.map((ord) => (
              <li key={ord.id}>
                <span className="font-medium">{ord.customer?.display_name ?? tc("customer")}:</span>{" "}
                <span className="whitespace-pre-line">{ord.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">{t("liveLocation")}</h2>
        <LocationToggle offeringId={id} enabled={isPickupDay} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t("orders", { count: orders?.length ?? 0 })}</h2>
        <ul className="flex flex-col gap-2">
          {orders?.map((ord) => (
            <li key={ord.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="font-medium">
                {ord.customer?.display_name ?? tc("customer")}
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {tOrders(ord.status as "placed" | "cancelled" | "picked_up")}
                </span>
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {ord.order_items.map((i) => `${i.qty}× ${names.get(i.offering_item_id)}`).join(", ")}
              </p>
              {ord.note && (
                <p className="mt-1 text-sm">
                  <span className="font-medium">{t("noteLabel")}</span> <span className="whitespace-pre-line">{ord.note}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
