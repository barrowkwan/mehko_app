"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SlotFields } from "@/components/slot-fields";

// "More pickup slots" on the new-offering form: any number of extra point/date/time combinations that share the
// offering's cutoff, foods and limits. Inputs are named slot_<n>_point/date/start/end.
export function ExtraSlots({ points }: { points: { id: string; name: string }[] }) {
  const t = useTranslations("offerings");
  const next = useRef(0);
  const [slots, setSlots] = useState<number[]>([]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("extraSlotsTitle")}</legend>
      <p className="text-xs text-neutral-500">{t("extraSlotsHelp")}</p>
      {slots.map((n) => (
        <SlotFields key={n} points={points} prefix={`slot_${n}_`} onRemove={() => setSlots((s) => s.filter((x) => x !== n))} />
      ))}
      <button type="button" className="self-start text-sm text-orange-600 hover:underline" onClick={() => setSlots((s) => [...s, next.current++])}>
        {t("addSlot")}
      </button>
    </fieldset>
  );
}
