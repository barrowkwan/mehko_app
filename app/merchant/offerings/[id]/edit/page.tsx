import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { todayIn } from "@/lib/format";
import { localized } from "@/lib/locale";
import { OfferingForm } from "@/components/offering-form";
import { updateOffering } from "../../../actions";

export default async function EditOfferingPage({ params }: PageProps<"/merchant/offerings/[id]/edit">) {
  const { id } = await params;
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("offerings");
  const td = await getTranslations("offeringDetail");
  const locale = await getLocale();

  const { data: offering } = await supabase
    .from("offerings")
    .select("id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, instructions, translations, pickup_point:pickup_points(timezone), offering_items(food_item_id, quantity_limit, price_cents)")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!offering) notFound();

  const [{ data: points }, { data: foods }, { count: activeOrders }] = await Promise.all([
    supabase.from("pickup_points").select("id, name, active").eq("merchant_id", merchant.id).order("name"),
    supabase.from("food_items").select("id, name, translations, active").eq("merchant_id", merchant.id).order("name"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("offering_id", id).neq("status", "cancelled"),
  ]);

  const attached = new Set(offering.offering_items.map((i) => i.food_item_id));
  const past = todayIn(offering.pickup_point?.timezone ?? "UTC") > offering.pickup_date;

  return (
    <main className="max-w-lg p-4">
      <h1 className="mb-1 text-xl font-bold">{t("editTitle")}</h1>
      <Link href={`/merchant/offerings/${id}`} className="mb-4 inline-block text-sm text-orange-600 hover:underline">
        ← {td("back")}
      </Link>
      {past ? (
        <p className="rounded bg-yellow-100 p-3 text-sm text-yellow-900">{t("pastHint")}</p>
      ) : (
        <OfferingForm
          action={updateOffering.bind(null, id)}
          submitLabel={t("save")}
          lockMove={(activeOrders ?? 0) > 0}
          // Archived foods/points stay selectable only while the offering already uses them.
          points={(points ?? []).filter((p) => p.active || p.id === offering.pickup_point_id)}
          foods={(foods ?? [])
            .filter((f) => f.active || attached.has(f.id))
            .map((f) => ({ id: f.id, name: localized(f.name, f.translations, locale, "name") }))}
          values={{
            pickupPointId: offering.pickup_point_id,
            pickupDate: offering.pickup_date,
            pickupStart: offering.pickup_start,
            pickupEnd: offering.pickup_end,
            cutoffAt: offering.cutoff_at,
            items: Object.fromEntries(offering.offering_items.map((i) => [i.food_item_id, { limit: i.quantity_limit, priceCents: i.price_cents }])),
            instructions: offering.instructions,
            translations: offering.translations,
          }}
        />
      )}
    </main>
  );
}
