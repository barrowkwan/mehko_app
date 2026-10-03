"use client";

import { useRef } from "react";
import { Field, inputClass } from "@/components/action-form";

// Latitude/longitude inputs with a "use my current location" helper.
export function GeoFill() {
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Latitude">
          <input ref={lat} name="lat" type="number" step="any" required className={inputClass} />
        </Field>
        <Field label="Longitude">
          <input ref={lng} name="lng" type="number" step="any" required className={inputClass} />
        </Field>
      </div>
      <button
        type="button"
        className="self-start text-sm text-orange-600 hover:underline"
        onClick={() =>
          navigator.geolocation.getCurrentPosition((p) => {
            if (lat.current) lat.current.value = String(p.coords.latitude);
            if (lng.current) lng.current.value = String(p.coords.longitude);
          })
        }
      >
        Use my current location
      </button>
    </div>
  );
}
