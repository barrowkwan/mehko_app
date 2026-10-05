"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney, orderTotal } from "@/lib/money";
import { FoodPhoto } from "@/components/food-photo";
import type { FormState } from "@/app/orders/actions";
import { useActionForm } from "@/components/use-action-form";

export type OrderFormItem = {
  offeringItemId: string;
  name: string;
  description: string | null;
  remaining: number | null; // null = unlimited; shown as "N left"
  max?: number | null; // most the customer can set (defaults to remaining; an existing order may exceed it by its own quantity)
  qty: number;
  imageUrl?: string | null;
  priceCents?: number | null; // the price per item (an existing order line keeps the price it was ordered at); null/undefined = no price
};

export function OrderForm({
  items,
  action,
  submitLabel,
  note,
}: {
  items: OrderFormItem[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  note?: string | null; // existing note when editing; the field is always shown
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { state, pending, onSubmit, formRef } = useActionForm(action);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.offeringItemId, String(i.qty)])));
  // running total of what is typed in (nothing is charged here)
  const total = orderTotal(
    items
      .map((i) => ({ qty: Math.max(0, Number.parseInt(qty[i.offeringItemId] ?? "0", 10) || 0), unitPriceCents: i.priceCents ?? null }))
      .filter((l) => l.qty > 0),
  );
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {items.map((it) => (
          <li key={it.offeringItemId} className="flex items-center gap-3 p-3">
            <FoodPhoto url={it.imageUrl} alt={it.name} />
            <div className="mr-auto">
              <p className="font-medium">{it.name}</p>
              {it.description && <p className="whitespace-pre-line text-sm text-neutral-500">{it.description}</p>}
              {it.priceCents !== null && it.priceCents !== undefined && <p className="text-sm font-medium">{t("orderForm.each", { price: formatMoney(it.priceCents, locale) })}</p>}
              {it.remaining !== null && <p className="text-xs text-neutral-500">{t("orderForm.left", { count: it.remaining })}</p>}
            </div>
            <input
              type="number"
              name={`qty_${it.offeringItemId}`}
              min={0}
              max={(it.max ?? it.remaining) ?? undefined}
              value={qty[it.offeringItemId] ?? ""}
              onChange={(e) => setQty((q) => ({ ...q, [it.offeringItemId]: e.target.value }))}
              aria-label={t("orderForm.quantityOf", { name: it.name })}
              className="w-20 rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
            />
          </li>
        ))}
      </ul>
      {total.anyPriced && (
        <div className="rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <p className="text-base font-semibold">
            {total.complete ? t("orderForm.total", { total: formatMoney(total.cents, locale) }) : t("orderForm.totalPartial", { total: formatMoney(total.cents, locale) })}
          </p>
          <p className="text-xs text-neutral-500">{t("orderForm.totalNote")}</p>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("orderForm.note")}</span>
        <textarea
          name="note"
          rows={3}
          maxLength={300}
          defaultValue={note ?? ""}
          placeholder={t("orderForm.notePlaceholder")}
          className="w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        />
        <span className="text-xs text-neutral-500">{t("orderForm.noteHelp")}</span>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-orange-600 px-4 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? t("common.saving") : submitLabel}
      </button>
    </form>
  );
}
