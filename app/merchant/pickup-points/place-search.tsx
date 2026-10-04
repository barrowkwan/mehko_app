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

type Place = { name: string; address: string; lat: number; lng: number; timezone: string | null; category: string | null };
type Initial = { name: string; address: string | null; lat: number; lng: number; timezone: string };

const valid = (lat: string, lng: string) => {
  const a = Number(lat);
  const b = Number(lng);
  return lat.trim() !== "" && lng.trim() !== "" && Math.abs(a) <= 90 && Math.abs(b) <= 180;
};

// The fields of a pickup point for "Add" and "Edit". The merchant finds the place by searching (business, address
// or ZIP) or by clicking the map; latitude, longitude and timezone are filled in for them and only shown under
// "Technical details". The plain inputs are what the form submits, so manual entry works when search is off.
export function PlaceSearch({ searchEnabled, initial }: { searchEnabled: boolean; initial?: Initial }) {
  const t = useTranslations("pickupPoints");
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(initial ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial ? String(initial.lng) : "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "");
  const [q, setQ] = useState("");
  const [near, setNear] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "none" | "unavailable" | "busy">("idle");
  const [results, setResults] = useState<Place[]>([]);
  const [geoError, setGeoError] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setPosition = (la: number, ln: number) => {
    setLat(la.toFixed(6));
    setLng(ln.toFixed(6));
    setTimezone(""); // the server works it out from the position
  };

  async function search() {
    if (!q.trim() && !near.trim()) return;
    setStatus("searching");
    setResults([]);
    try {
      const res = await fetch(`/api/places/search?${new URLSearchParams({ q, near })}`);
      if (!mounted.current) return;
      if (res.status === 429) return setStatus("busy");
      if (!res.ok) return setStatus("unavailable");
      const body = (await res.json()) as { places: Place[] };
      setResults(body.places);
      setStatus(body.places.length ? "idle" : "none");
    } catch {
      if (mounted.current) setStatus("unavailable");
    }
  }

  function pick(p: Place) {
    // A business name makes a good pickup point name; a bare address does not, so keep what is typed in that case.
    setName(p.category ? p.name : name || p.name);
    setAddress(p.address);
    setLat(p.lat.toFixed(6));
    setLng(p.lng.toFixed(6));
    setTimezone(p.timezone ?? "");
    setResults([]);
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-3">
      {searchEnabled && (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">{t("searchTitle")}</legend>
          <div
            className="flex flex-col gap-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // Enter searches; it must not submit the whole form
                void search();
              }
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={100}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className={inputClass}
            />
            <input value={near} onChange={(e) => setNear(e.target.value)} maxLength={100} placeholder={t("nearLabel")} aria-label={t("nearLabel")} className={inputClass} />
            <button type="button" onClick={() => void search()} disabled={status === "searching"} className="self-start rounded-lg bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900">
              {status === "searching" ? t("searching") : t("searchButton")}
            </button>
          </div>
          {status === "none" && <p className="text-sm text-neutral-500">{t("noResults")}</p>}
          {status === "unavailable" && <p className="text-sm text-red-600">{t("searchUnavailable")}</p>}
          {status === "busy" && <p className="text-sm text-red-600">{t("searchBusy")}</p>}
          {results.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-200 rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800" aria-label={t("results")}>
              {results.map((p, i) => (
                <li key={`${p.lat},${p.lng},${i}`}>
                  <button type="button" onClick={() => pick(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-orange-50 dark:hover:bg-neutral-900">
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-neutral-500">{p.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-neutral-500">
            <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">
              {t("poweredBy")}
            </a>
          </p>
        </fieldset>
      )}

      <Field label={t("name")}>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
      </Field>
      <Field label={t("address")}>
        <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </Field>

      <p className="text-sm text-neutral-500">{t("mapHint")}</p>
      <MapPicker value={valid(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : null} onPick={setPosition} />
      <button
        type="button"
        className="self-start text-sm text-orange-600 hover:underline"
        onClick={() => {
          setGeoError(false);
          navigator.geolocation.getCurrentPosition(
            (p) => mounted.current && setPosition(p.coords.latitude, p.coords.longitude),
            () => mounted.current && setGeoError(true),
          );
        }}
      >
        {t("useMyLocation")}
      </button>
      {geoError && <p className="text-sm text-red-600">{t("locationFailed")}</p>}

      <details className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-medium">{t("technicalDetails")}</summary>
        <p className="mt-2 text-xs text-neutral-500">{t("technicalHelp")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label={t("latitude")}>
            <input name="lat" type="number" step="any" min={-90} max={90} value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("longitude")}>
            <input name="lng" type="number" step="any" min={-180} max={180} value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="mt-2">
          <Field label={t("timezone")}>
            <input name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder={t("timezoneAuto")} className={inputClass} />
          </Field>
        </div>
      </details>
    </div>
  );
}
