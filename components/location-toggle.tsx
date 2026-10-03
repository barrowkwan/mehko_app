"use client";

import { useEffect, useRef, useState } from "react";
import { updateLocation } from "@/app/merchant/actions";

// Optional live location sharing for pickup day. Pushes the position at most every 10s.
export function LocationToggle({ offeringId, enabled }: { offeringId: string; enabled: boolean }) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  function stop() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
    void updateLocation(offeringId, null);
  }

  function start() {
    setError(null);
    if (!navigator.geolocation) return setError("Geolocation isn't supported on this device.");
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - lastSent.current < 10_000) return;
        lastSent.current = Date.now();
        const res = await updateLocation(offeringId, { lat: p.coords.latitude, lng: p.coords.longitude });
        if (res.error) {
          setError(res.error);
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setSharing(false);
        }
      },
      (e) => {
        setError(e.message);
        setSharing(false);
      },
      { enableHighAccuracy: true },
    );
  }

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  if (!enabled) {
    return <p className="text-sm text-neutral-500">Live location can be turned on during the pickup date.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={sharing ? stop : start}
        className={`self-start rounded-lg px-4 py-2 font-medium text-white ${sharing ? "bg-red-600" : "bg-green-600"}`}
      >
        {sharing ? "Stop sharing location" : "Share my location with customers"}
      </button>
      <p className="text-xs text-neutral-500">
        Only customers with an order for this pickup can see it. Keep this page open while sharing.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
