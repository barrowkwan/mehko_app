import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { Scanner } from "./scanner";

export default async function ScanPage() {
  await requireMerchant();
  const t = await getTranslations("scan");
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-neutral-500">{t("instructions")}</p>
      <Scanner />
    </main>
  );
}
