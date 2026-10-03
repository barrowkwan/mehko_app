"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it must not render on the server.
export const LiveMapLoader = dynamic(() => import("./live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />,
});
