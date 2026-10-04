import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { localized } from "@/lib/locale";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { createOffering } from "../../actions";
import { CutoffInput } from "./cutoff-input";

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
      <ActionForm action={createOffering} submitLabel={t("publish")}>
        <Field label={t("pickupPoint")}>
          <select name="pickup_point_id" required className={inputClass}>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("pickupDate")}>
          <input type="date" name="pickup_date" required className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("pickupFrom")}>
            <input type="time" name="pickup_start" required className={inputClass} />
          </Field>
          <Field label={t("pickupUntil")}>
            <input type="time" name="pickup_end" required className={inputClass} />
          </Field>
        </div>
        <CutoffInput />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("foodsOnSale")}</legend>
          {foods.map((f) => (
            <div key={f.id} className="flex items-center gap-3">
              <label className="mr-auto flex items-center gap-2">
                <input type="checkbox" name={`food_${f.id}`} /> {localized(f.name, f.translations, locale, "name")}
              </label>
              <input
                type="number"
                min={1}
                name={`limit_${f.id}`}
                placeholder={t("limit")}
                className="w-24 rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-700"
              />
            </div>
          ))}
        </fieldset>
      </ActionForm>
    </main>
  );
}
