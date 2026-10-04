import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { isPastCutoff } from "@/lib/cutoff";
import { formatDate, formatInstant, formatTime } from "@/lib/format";
import { localized } from "@/lib/locale";
import { foodPhotoUrl } from "@/components/food-photo";
import { OrderForm } from "@/components/order-form";
import { placeOrder } from "@/app/orders/actions";

export default async function OfferingPage({ params }: PageProps<"/offerings/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("offering");
  const locale = await getLocale();

  const { data: offering } = await supabase
    .from("offerings")
    .select(
      `id, pickup_date, pickup_start, pickup_end, cutoff_at, status,
       merchant:merchants(name, description, translations),
       pickup_point:pickup_points(name, address, timezone),
       offering_items(id, quantity_limit, food_item:food_items(name, description, translations, image_path))`,
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
  const place = offering.pickup_point;
  const tz = place?.timezone ?? "UTC";

  return (
    <main className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">
          {offering.merchant && localized(offering.merchant.name, offering.merchant.translations, locale, "name")}
        </h1>
        {offering.merchant?.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {localized(offering.merchant.description, offering.merchant.translations, locale, "description")}
          </p>
        )}
        <p>
          {formatDate(offering.pickup_date, locale)}, {formatTime(offering.pickup_start, locale)}–{formatTime(offering.pickup_end, locale)}
        </p>
        <p className="text-neutral-500">
          {t("pickup", { place: `${place?.name ?? ""}${place?.address ? ` · ${place.address}` : ""}` })}
        </p>
        <p className="text-sm text-orange-700">
          {closed ? t("closed") : t("orderBy", { time: formatInstant(offering.cutoff_at, locale, tz) })}
        </p>
      </div>
      {!closed && (
        <OrderForm
          action={placeOrder.bind(null, id)}
          submitLabel={t("placeOrder")}
          items={offering.offering_items.map((i) => ({
            offeringItemId: i.id,
            name: i.food_item ? localized(i.food_item.name, i.food_item.translations, locale, "name") : "",
            description: i.food_item?.description
              ? localized(i.food_item.description, i.food_item.translations, locale, "description")
              : null,
            remaining: remaining.get(i.id) ?? null,
            qty: 0,
            imageUrl: foodPhotoUrl(i.food_item?.image_path),
          }))}
        />
      )}
    </main>
  );
}
