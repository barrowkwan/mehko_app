import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export default async function CustomerHistoryPage({ params }: PageProps<"/merchant/customers/[id]">) {
  const { id } = await params;
  const { supabase, merchant } = await requireMerchant();
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("orders.status");
  const locale = await getLocale();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, status, created_at, customer:profiles(display_name),
       offering:offerings!inner(merchant_id, pickup_date, pickup_point:pickup_points(name)),
       order_items(qty, offering_item:offering_items(food_item:food_items(name)))`,
    )
    .eq("customer_id", id)
    .eq("offering.merchant_id", merchant.id)
    .order("created_at", { ascending: false });
  if (!orders?.length) notFound();

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{orders[0].customer?.display_name ?? tc("customer")}</h1>
      <ul className="flex flex-col gap-2">
        {orders.map((o) => (
          <li key={o.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="font-medium">
              {o.offering && formatDate(o.offering.pickup_date, locale)} · {o.offering?.pickup_point?.name}
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                {tStatus(o.status as "placed" | "cancelled" | "picked_up")}
              </span>
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {o.order_items.map((i) => `${i.qty}× ${i.offering_item?.food_item?.name ?? ""}`).join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
