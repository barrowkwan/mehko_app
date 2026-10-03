"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/action-form";

// datetime-local has no timezone; convert to an absolute ISO instant in the merchant's browser tz.
export function CutoffInput() {
  const [iso, setIso] = useState("");
  return (
    <Field label="Order cutoff">
      <input
        type="datetime-local"
        required
        className={inputClass}
        onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
      />
      <input type="hidden" name="cutoff_at" value={iso} />
    </Field>
  );
}
