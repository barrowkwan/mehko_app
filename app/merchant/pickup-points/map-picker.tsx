"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";

type Pos = { lat: number; lng: number };

// Click the map (or drag the pin) to choose a pickup spot. `value` is the current choice (from the number
// inputs); the map follows it when it changes from outside (typing, "use my location").
export function MapPicker({ value, onPick }: { value: Pos | null; onPick: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const L_ = useRef<typeof import("leaflet") | null>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  const place = (pos: Pos, recenter: boolean) => {
    const L = L_.current;
    if (!L || !map.current) return;
    if (!marker.current) {
      marker.current = L.marker([pos.lat, pos.lng], { draggable: true }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        onPickRef.current(p.lat, p.lng);
      });
    } else {
      marker.current.setLatLng([pos.lat, pos.lng]);
    }
    if (recenter) map.current.setView([pos.lat, pos.lng], Math.max(map.current.getZoom(), 16));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      L_.current = L as unknown as typeof import("leaflet");
      const start = latest.current;
      map.current = L.map(el.current).setView(start ? [start.lat, start.lng] : [20, 0], start ? 16 : 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map.current);
      map.current.on("click", (e) => {
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      if (start) place(start, false);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (value) place(value, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  return <div ref={el} className="h-64 w-full rounded-lg" />;
}
