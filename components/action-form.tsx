"use client";

import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { FormState } from "@/app/orders/actions";

export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-3",
  buttonClassName = "bg-orange-600 hover:bg-orange-700",
  confirmMessage,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  confirmMessage?: string; // asks before submitting (e.g. destructive actions)
}) {
  const t = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && !state.error && <p className="text-sm text-green-700">{t("saved")}</p>}
      <button
        disabled={pending}
        className={`rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50 ${buttonClassName}`}
      >
        {pending ? t("saving") : submitLabel}
      </button>
    </form>
  );
}

export const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
