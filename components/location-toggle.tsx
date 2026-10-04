"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { updateLocation } from "@/app/merchant/actions";

const SEND_EVERY_MS = 10_000; // at most this often when the position changes
const HEARTBEAT_MS = 45_000; // re-send the last position when standing still, so customers' 2-minute freshness check holds
const MAX_SHARING_MS = 4 * 60 * 60_000; // sharing switches itself off after 4 hours

// Optional live location sharing for pickup day. Privacy rules: sharing only runs while this page is open; leaving
// the page, closing the tab or pressing Stop switches it off; it also switches itself off after 4 hours, and the
// database stops showing customers a position that has not been refreshed for 2 minutes.
export function LocationToggle({ offeringId, enabled }: { offeringId: string; enabled: boolean }) {
  const t = useTranslations("location");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sharingRef = useRef(false);
  const watchId = useRef<number | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  // Stops the browser from reading the location and the timers. Does not talk to the server.
  function halt() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (heartbeat.current) clearInterval(heartbeat.current);
    if (cap.current) clearTimeout(cap.current);
    heartbeat.current = null;
    cap.current = null;
    lastPos.current = null;
    sharingRef.current = false;
    setSharing(false);
  }

  // For when the page is going away: a normal request could be cancelled, `keepalive` lets it finish.
  function stopInBackground() {
    void fetch("/api/location/stop", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offeringId }),
    });
  }

  function stop() {
    halt();
    void updateLocation(offeringId, null);
  }

  async function send(pos: { lat: number; lng: number }) {
    lastSent.current = Date.now();
    const res = await updateLocation(offeringId, pos);
    if (res.error && sharingRef.current) {
      setError(res.error);
      halt();
    }
  }

  function start() {
    setError(null);
    if (!navigator.geolocation) return setError(t("notSupported"));
    sharingRef.current = true;
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (Date.now() - lastSent.current >= SEND_EVERY_MS) void send(lastPos.current);
      },
      (e) => {
        // 1 = permission denied, 2 = position unavailable, 3 = timed out
        setError(e.code === 1 ? t("denied") : e.code === 2 ? t("unavailable") : e.code === 3 ? t("timeout") : e.message);
        stop();
      },
      { enableHighAccuracy: true },
    );
    heartbeat.current = setInterval(() => {
      if (lastPos.current && Date.now() - lastSent.current >= HEARTBEAT_MS - 1000) void send(lastPos.current);
    }, HEARTBEAT_MS);
    cap.current = setTimeout(() => {
      setError(t("autoStopped"));
      stop();
    }, MAX_SHARING_MS);
  }

  // Leaving this page (link, back button, closing the tab) switches sharing off.
  useEffect(() => {
    const onPageHide = () => {
      if (!sharingRef.current) return;
      halt();
      stopInBackground();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      if (sharingRef.current) {
        halt();
        stopInBackground();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) {
    return <p className="text-sm text-neutral-500">{t("onlyPickupDay")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {sharing && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <span aria-hidden className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
          {t("banner")}
        </div>
      )}
      <button
        onClick={sharing ? stop : start}
        className={`self-start rounded-lg px-4 py-2 font-medium text-white ${sharing ? "bg-red-600" : "bg-green-600"}`}
      >
        {sharing ? t("stop") : t("share")}
      </button>
      <p className="text-xs text-neutral-500">{t("hint")}</p>
      <p className="text-xs text-neutral-500">{t("privacyNote")}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
