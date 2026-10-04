import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { localized } from "@/lib/locale";
import { OfferingForm } from "@/components/offering-form";
import { createOffering } from "../../actions";

export default async function NewOfferingPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("offerings");
  const locale = await getLocale();
  const [{ data: points }, { data: foods }] = await Promise.all([
    supabase.from("pickup_points").select("id, name").eq("merchant_id", merchant.id).eq("active", true).order("name"),
    supabase.from("food_items").select("id, name, translations").eq("merchant_id", merchant.id).eq("active", true).order("name"),
  ]);

  if (!points?.length || !foods?.length) {
    return (
      <main className="flex flex-col gap-2 p-4">
        <h1 className="text-xl font-bold">{t("newTitle")}</h1>
        <p>
          {t.rich("needFirst", {
            points: (chunks) => (
              <Link href="/merchant/pickup-points" className="text-orange-600 underline">
                {chunks}
              </Link>
            ),
            foods: (chunks) => (
              <Link href="/merchant/foods" className="text-orange-600 underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-lg p-4">
      <h1 className="mb-4 text-xl font-bold">{t("newTitle")}</h1>
      <OfferingForm
        action={createOffering}
        submitLabel={t("publish")}
        points={points}
        foods={foods.map((f) => ({ id: f.id, name: localized(f.name, f.translations, locale, "name") }))}
      />
    </main>
  );
}
