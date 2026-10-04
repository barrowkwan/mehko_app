"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FoodPhoto } from "@/components/food-photo";
import type { FormState } from "@/app/orders/actions";

export type OrderFormItem = {
  offeringItemId: string;
  name: string;
  description: string | null;
  remaining: number | null; // null = unlimited; shown as "N left"
  max?: number | null; // most the customer can set (defaults to remaining; an existing order may exceed it by its own quantity)
  qty: number;
  imageUrl?: string | null;
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
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {items.map((it) => (
          <li key={it.offeringItemId} className="flex items-center gap-3 p-3">
            <FoodPhoto url={it.imageUrl} alt={it.name} />
            <div className="mr-auto">
              <p className="font-medium">{it.name}</p>
              {it.description && <p className="text-sm text-neutral-500">{it.description}</p>}
              {it.remaining !== null && <p className="text-xs text-neutral-500">{t("orderForm.left", { count: it.remaining })}</p>}
            </div>
            <input
              type="number"
              name={`qty_${it.offeringItemId}`}
              min={0}
              max={(it.max ?? it.remaining) ?? undefined}
              defaultValue={it.qty}
              aria-label={t("orderForm.quantityOf", { name: it.name })}
              className="w-20 rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
            />
          </li>
        ))}
      </ul>
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
