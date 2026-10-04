"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/action-form";

// The timezone defaults to the merchant's browser. (Computing it in the server page gave the SERVER's timezone,
// UTC on Render, so every point got "UTC" and customers saw UTC times.)
export function TimezoneField({ defaultValue = "" }: { defaultValue?: string }) {
  const t = useTranslations("pickupPoints");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!defaultValue && input.current && !input.current.value) input.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [defaultValue]);
  return (
    <Field label={t("timezone")}>
      <input ref={input} name="timezone" defaultValue={defaultValue} required className={inputClass} />
    </Field>
  );
}
