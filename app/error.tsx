"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

// Error screen for any page inside the layout (translated). Reports the error, lets the user retry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-col items-start gap-3 p-4">
      <h1 className="text-xl font-bold">{t("errors.generic")}</h1>
      <button onClick={() => reset()} className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700">
        {t("common.tryAgain")}
      </button>
    </main>
  );
}
