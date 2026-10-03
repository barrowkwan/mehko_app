"use client";

import { useEffect, useRef, useState } from "react";
import { confirmPickup, type PickupResult } from "../actions";

export function Scanner() {
  const [result, setResult] = useState<PickupResult | null>(null);
  const [manual, setManual] = useState("");
  const busy = useRef(false);

  async function handle(token: string) {
    if (busy.current) return;
    busy.current = true;
    setResult(await confirmPickup(token));
    // Short cool-down so the same QR in frame isn't submitted repeatedly.
    setTimeout(() => (busy.current = false), 2500);
  }

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode("qr-reader");
      try {
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text) => void handle(text), () => {});
      } catch {
        // Camera unavailable/denied: the manual entry below still works.
      }
    })();
    return () => {
      cancelled = true;
      scanner
        ?.stop()
        .then(() => scanner?.clear())
        .catch(() => {});
    };
  }, []);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div id="qr-reader" className="overflow-hidden rounded-lg" />
      {result && (
        <div
          className={`rounded-lg p-3 text-sm ${result.ok ? (result.alreadyPickedUp ? "bg-yellow-100 text-yellow-900" : "bg-green-100 text-green-900") : "bg-red-100 text-red-900"}`}
          role="status"
        >
          {result.ok
            ? result.alreadyPickedUp
              ? `Already picked up (${result.customerName ?? "customer"}).`
              : `Pickup confirmed for ${result.customerName ?? "customer"}.`
            : result.error}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) void handle(manual);
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or enter code manually"
          className="flex-1 rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        />
        <button className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white">Confirm</button>
      </form>
    </div>
  );
}
