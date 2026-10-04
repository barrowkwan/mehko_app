"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/action-form";
import { isoToLocalInput } from "@/lib/format";

// datetime-local has no timezone; the merchant's local time is converted to an absolute ISO instant
// (the form posts `cutoff_at` as ISO). When editing, `defaultIso` pre-fills the field in the browser's timezone
// after mount (the server doesn't know the visitor's timezone, so rendering it there would mismatch).
export function CutoffInput({ defaultIso }: { defaultIso?: string }) {
  const t = useTranslations("offerings");
  const input = useRef<HTMLInputElement>(null);
  const [iso, setIso] = useState(defaultIso ?? "");

  // The browser's timezone is only known on the client: write the pre-filled value to the DOM input after mount.
  useEffect(() => {
    if (defaultIso && input.current) input.current.value = isoToLocalInput(defaultIso);
  }, [defaultIso]);

  return (
    <Field label={t("cutoff")}>
      <input
        type="datetime-local"
        ref={input}
        required
        className={inputClass}
        onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
      />
      <input type="hidden" name="cutoff_at" value={iso} />
    </Field>
  );
}
