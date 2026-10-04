"use client";

import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/action-form";

// One pickup slot's fields (point, date, from, until). `prefix` namespaces the input names ("slot_0_" → slot_0_point …).
export function SlotFields({ points, prefix, onRemove }: { points: { id: string; name: string }[]; prefix: string; onRemove?: () => void }) {
  const t = useTranslations("offerings");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <Field label={t("pickupPoint")}>
        <select name={`${prefix}point`} required className={inputClass}>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("pickupDate")}>
        <input type="date" name={`${prefix}date`} required className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("pickupFrom")}>
          <input type="time" name={`${prefix}start`} required className={inputClass} />
        </Field>
        <Field label={t("pickupUntil")}>
          <input type="time" name={`${prefix}end`} required className={inputClass} />
        </Field>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="self-start text-sm text-red-600 hover:underline">
          {t("removeSlot")}
        </button>
      )}
    </div>
  );
}
