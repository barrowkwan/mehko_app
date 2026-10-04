"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Pos = { lat: number | null; lng: number | null; active: boolean; updated_at: string };

// Shows the merchant's live position while they share it on pickup day, plus the pickup point.
export function LiveMap({
  offeringId,
  pickup,
}: {
  offeringId: string;
  pickup: { lat: number; lng: number; name: string };
}) {
  const t = useTranslations("map");
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      map.current = L.map(el.current).setView([pickup.lat, pickup.lng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map.current);
      L.circleMarker([pickup.lat, pickup.lng], { radius: 8, color: "#2563eb", fillOpacity: 0.8 })
        .bindTooltip(pickup.name)
        .addTo(map.current);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [pickup.lat, pickup.lng, pickup.name]);

  // Load current position and subscribe to changes.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("location_shares")
      .select("lat, lng, active, updated_at")
      .eq("offering_id", offeringId)
      .maybeSingle()
      .then(({ data }) => data && setPos(data));

    // The database only returns a position refreshed in the last 2 minutes. Check again now and then, so a marker
    // disappears by itself when the merchant stops sending (closed the page, lost signal) instead of staying for ever.
    const poll = setInterval(() => {
      supabase
        .from("location_shares")
        .select("lat, lng, active, updated_at")
        .eq("offering_id", offeringId)
        .maybeSingle()
        .then(({ data }) => setPos(data ?? null));
    }, 30_000);

    const channel = supabase
      .channel(`location:${offeringId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_shares", filter: `offering_id=eq.${offeringId}` },
        (payload) => setPos(payload.new as Pos),
      )
      .subscribe();
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [offeringId]);

  // Draw/move the merchant marker.
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      if (!map.current) return;
      if (!pos || !pos.active || pos.lat == null || pos.lng == null) {
        marker.current?.remove();
        marker.current = null;
        return;
      }
      if (!marker.current) {
        marker.current = L.circleMarker([pos.lat, pos.lng], { radius: 10, color: "#ea580c", fillOpacity: 0.9 })
          .bindTooltip(t("merchantMarker"))
          .addTo(map.current);
      } else {
        marker.current.setLatLng([pos.lat, pos.lng]);
      }
      map.current.panTo([pos.lat, pos.lng]);
    })();
  }, [pos, t]);

  const live = pos?.active;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-neutral-500">
        {live ? t("sharing") : t("notSharing")}
      </p>
      <div ref={el} className="h-72 w-full rounded-lg border border-neutral-200 dark:border-neutral-800" />
    </div>
  );
}
