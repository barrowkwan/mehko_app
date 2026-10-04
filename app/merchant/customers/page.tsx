import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";

export default async function CustomersPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("customers");
  const tc = await getTranslations("common");
  const { data: orders } = await supabase
    .from("orders")
    .select("customer_id, status, customer:profiles(display_name), offering:offerings!inner(merchant_id)")
    .eq("offering.merchant_id", merchant.id);

  const customers = new Map<string, { name: string; orders: number; pickedUp: number }>();
  for (const o of orders ?? []) {
    const c = customers.get(o.customer_id) ?? { name: o.customer?.display_name ?? tc("customer"), orders: 0, pickedUp: 0 };
    c.orders += 1;
    if (o.status === "picked_up") c.pickedUp += 1;
    customers.set(o.customer_id, c);
  }
  const list = [...customers].sort((a, b) => b[1].orders - a[1].orders);

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {!list.length && <p className="text-neutral-500">{t("none")}</p>}
      <ul className="flex flex-col gap-2">
        {list.map(([id, c]) => (
          <li key={id}>
            <Link
              href={`/merchant/customers/${id}`}
              className="flex justify-between rounded-lg border border-neutral-200 p-3 hover:border-orange-500 dark:border-neutral-800"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-neutral-500">{t("line", { orders: c.orders, picked: c.pickedUp })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
