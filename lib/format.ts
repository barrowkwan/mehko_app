// Locale-aware formatting. Pass the active locale (from next-intl) explicitly: server components
// otherwise format with the server's locale and timezone (UTC on most hosts).

export function formatDate(d: string, locale: string): string {
  // d is YYYY-MM-DD; build it from parts so no timezone shifts the calendar day.
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(t: string, locale: string): string {
  const [h, m] = t.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// An absolute instant shown in a specific timezone (the pickup point's), with the zone name,
// so "8:00 PM EDT" is unambiguous for customers and merchants in different places.
export function formatInstant(iso: string | Date, locale: string, timeZone: string): string {
  return new Date(iso).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });
}

// Today's calendar date (YYYY-MM-DD) in a given timezone.
export function todayIn(timeZone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

// Yesterday's date in UTC (YYYY-MM-DD): a safe lower bound for "upcoming" pickups in any timezone.
export function yesterdayUtc(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

// An ISO instant as the value a <input type="datetime-local"> expects, in the browser's local time
// ("2026-10-05T14:30"). Only meaningful in the browser (uses its timezone); "" for invalid input.
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
