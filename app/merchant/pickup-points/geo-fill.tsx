"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/action-form";

// Leaflet touches `window`, so the picker must not render on the server.
const MapPicker = dynamic(() => import("./map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />,
});

const valid = (lat: string, lng: string) => {
  const a = Number(lat);
  const b = Number(lng);
  return lat.trim() !== "" && lng.trim() !== "" && Math.abs(a) <= 90 && Math.abs(b) <= 180;
};

// Latitude/longitude with a click-to-place map, typed numbers and a "use my current location" helper.
// The number inputs stay the source of truth (they are what the form submits), so everything still works
// if the map cannot load.
export function GeoFill() {
  const t = useTranslations("pickupPoints");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [geoError, setGeoError] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const set = (la: number, ln: number) => {
    setLat(la.toFixed(6));
    setLng(ln.toFixed(6));
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-neutral-500">{t("mapHint")}</p>
      <MapPicker value={valid(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : null} onPick={set} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("latitude")}>
          <input name="lat" type="number" step="any" min={-90} max={90} required value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("longitude")}>
          <input name="lng" type="number" step="any" min={-180} max={180} required value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <button
        type="button"
        className="self-start text-sm text-orange-600 hover:underline"
        onClick={() => {
          setGeoError(false);
          navigator.geolocation.getCurrentPosition(
            (p) => mounted.current && set(p.coords.latitude, p.coords.longitude),
            () => mounted.current && setGeoError(true),
          );
        }}
      >
        {t("useMyLocation")}
      </button>
      {geoError && <p className="text-sm text-red-600">{t("locationFailed")}</p>}
    </div>
  );
}
