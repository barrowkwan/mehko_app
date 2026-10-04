"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatInstant } from "@/lib/format";

type Key = "home.orderBy" | "offering.orderBy" | "order.canChangeUntil" | "offeringDetail.cutoffLine";

const subscribe = () => () => {};

// A message containing a moment in time ("Order by {time}"), shown in the VIEWER's own timezone (their browser),
// so a customer in California isn't shown a UTC time. The server cannot know the viewer's timezone, so it renders
// the pickup point's timezone and the browser swaps in its own right after loading.
export function LocalInstantText({
  messageKey,
  iso,
  fallbackTimeZone,
  values,
}: {
  messageKey: Key; // the message must use {time}
  iso: string;
  fallbackTimeZone: string;
  values?: Record<string, string>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const timeZone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => fallbackTimeZone,
  );
  return <>{t(messageKey, { ...values, time: formatInstant(iso, locale, timeZone) })}</>;
}
