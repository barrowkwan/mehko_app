"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { FormState } from "@/app/orders/actions";

export type OrderFormItem = {
  offeringItemId: string;
  name: string;
  description: string | null;
  remaining: number | null; // null = unlimited
  qty: number;
};

export function OrderForm({
  items,
  action,
  submitLabel,
}: {
  items: OrderFormItem[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {items.map((it) => (
          <li key={it.offeringItemId} className="flex items-center gap-3 p-3">
            <div className="mr-auto">
              <p className="font-medium">{it.name}</p>
              {it.description && <p className="text-sm text-neutral-500">{it.description}</p>}
              {it.remaining !== null && <p className="text-xs text-neutral-500">{t("orderForm.left", { count: it.remaining })}</p>}
            </div>
            <input
              type="number"
              name={`qty_${it.offeringItemId}`}
              min={0}
              max={it.remaining ?? undefined}
              defaultValue={it.qty}
              aria-label={t("orderForm.quantityOf", { name: it.name })}
              className="w-20 rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
            />
          </li>
        ))}
      </ul>
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
