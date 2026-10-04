"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatInstant, formatTime } from "@/lib/format";

type Slot = { point: string; date: string; start: string; end: string };
type Summary = { slots: Slot[]; foods: { name: string; limit: number | null }[]; cutoffIso: string; instructions: string };

// "Review before publishing": placed inside the new-offering form. The first submit is intercepted and shows a
// plain summary (what, when, where, cutoff); "Publish offering" there submits for real. The browser has already
// validated the required fields by the time the submit event fires.
export function OfferingReview({ points, foods }: { points: Record<string, string>; foods: Record<string, string> }) {
  const t = useTranslations("offerings.review");
  const locale = useLocale();
  const anchor = useRef<HTMLSpanElement>(null);
  const form = useRef<HTMLFormElement | null>(null);
  const confirmed = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const f = anchor.current?.closest("form") ?? null;
    form.current = f;
    if (!f) return;
    const onSubmit = (e: Event) => {
      if (confirmed.current) {
        confirmed.current = false;
        return; // the confirmed submit goes through
      }
      e.preventDefault();
      e.stopPropagation(); // keeps React's form action from running for the preview click
      const d = new FormData(f);
      const slots: Slot[] = [
        { point: points[String(d.get("pickup_point_id"))] ?? "", date: String(d.get("pickup_date")), start: String(d.get("pickup_start")), end: String(d.get("pickup_end")) },
      ];
      for (const key of d.keys()) {
        const m = /^(slot_\d+_)point$/.exec(key);
        if (m) slots.push({ point: points[String(d.get(key))] ?? "", date: String(d.get(`${m[1]}date`)), start: String(d.get(`${m[1]}start`)), end: String(d.get(`${m[1]}end`)) });
      }
      slots.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      const chosen: Summary["foods"] = [];
      for (const [key, value] of d.entries()) {
        if (!key.startsWith("food_") || value !== "on") continue;
        const id = key.slice(5);
        const lim = Number.parseInt(String(d.get(`limit_${id}`) ?? ""), 10);
        chosen.push({ name: foods[id] ?? "", limit: Number.isFinite(lim) && lim > 0 ? lim : null });
      }
      setSummary({ slots, foods: chosen, cutoffIso: String(d.get("cutoff_at") ?? ""), instructions: String(d.get("instructions") ?? "").trim() });
    };
    f.addEventListener("submit", onSubmit);
    return () => f.removeEventListener("submit", onSubmit);
  }, [points, foods]);

  useEffect(() => {
    if (!summary) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSummary(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summary]);

  const publish = () => {
    confirmed.current = true;
    setSummary(null);
    form.current?.requestSubmit();
  };

  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <>
      <span ref={anchor} hidden />
      {summary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-5 text-neutral-900 shadow-xl sm:rounded-xl dark:bg-neutral-900 dark:text-neutral-100">
            <h2 id="review-title" className="text-lg font-bold">{t("title")}</h2>
            <p className="mb-4 text-sm text-neutral-500">{t("intro")}</p>

            <dl className="flex flex-col gap-4 text-sm">
              <div>
                <dt className="font-semibold">{t("foods")}</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {summary.foods.map((f) => (
                      <li key={f.name}>
                        {f.name} — {f.limit ? t("limitN", { count: f.limit }) : t("unlimited")}
                      </li>
                    ))}
                  </ul>
                  {summary.slots.length > 1 && summary.foods.some((f) => f.limit) && <p className="mt-1 text-xs text-neutral-500">{t("sharedLimits")}</p>}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">{t("pickup", { count: summary.slots.length })}</dt>
                <dd>
                  <ul className="flex flex-col gap-1">
                    {summary.slots.map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">{formatDate(s.date, locale)}</span>, {formatTime(s.start, locale)}–{formatTime(s.end, locale)}
                        <span className="block text-neutral-500">{s.point}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">{t("cutoff")}</dt>
                <dd>{summary.cutoffIso ? formatInstant(summary.cutoffIso, locale, browserTz) : "—"}</dd>
              </div>
              {summary.instructions && (
                <div>
                  <dt className="font-semibold">{t("instructions")}</dt>
                  <dd className="whitespace-pre-line">{summary.instructions}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSummary(null)} className="rounded-lg border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700">
                {t("back")}
              </button>
              <button type="button" onClick={publish} className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700">
                {t("publish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
