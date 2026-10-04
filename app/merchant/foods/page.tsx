import { getLocale, getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { LOCALE_LABELS, localized, translatedLocales } from "@/lib/locale";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { FoodPhoto, foodPhotoUrl } from "@/components/food-photo";
import { ImageInput } from "@/components/image-input";
import { TranslationFields } from "@/components/translation-fields";
import { addFood, setFoodActive, updateFood } from "../actions";

export default async function FoodsPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("foods");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const { data: foods } = await supabase
    .from("food_items")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("name");

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <ul className="flex flex-col gap-2">
        {foods?.map((f) => {
          const shown = localized(f.name, f.translations, locale, "name");
          const shownDescription = f.description ? localized(f.description, f.translations, locale, "description") : null;
          const languages = translatedLocales(f.translations).map((l) => LOCALE_LABELS[l]);
          return (
          <li key={f.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <FoodPhoto url={foodPhotoUrl(f.image_path)} alt={shown} />
              <div className="mr-auto">
                <p className={`font-medium ${f.active ? "" : "text-neutral-400 line-through"}`}>{shown}</p>
                {shown !== f.name && <p className="text-xs text-neutral-500">{t("original", { name: f.name })}</p>}
                {shownDescription && <p className="text-sm text-neutral-500">{shownDescription}</p>}
                {languages.length > 0 && <p className="text-xs text-neutral-500">{t("translatedIn", { languages: languages.join(" · ") })}</p>}
              </div>
              <form action={setFoodActive.bind(null, f.id, !f.active)}>
                <button className="text-sm text-orange-600 hover:underline">{f.active ? tc("archive") : tc("restore")}</button>
              </form>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-orange-600">{tc("edit")}</summary>
              <div className="mt-2 max-w-md">
                <ActionForm action={updateFood.bind(null, f.id)} submitLabel={tc("save")}>
                  <Field label={t("name")}>
                    <input name="name" defaultValue={f.name} required className={inputClass} />
                  </Field>
                  <Field label={t("description")}>
                    <input name="description" defaultValue={f.description ?? ""} className={inputClass} />
                  </Field>
                  <ImageInput currentUrl={foodPhotoUrl(f.image_path)} alt={shown} />
                  <TranslationFields translations={f.translations} fields={["name", "description"]} />
                </ActionForm>
              </div>
            </details>
          </li>
          );
        })}
      </ul>
      <section className="max-w-md">
        <h2 className="mb-2 font-semibold">{t("addTitle")}</h2>
        <ActionForm action={addFood} submitLabel={t("submit")}>
          <Field label={t("name")}>
            <input name="name" required className={inputClass} />
          </Field>
          <Field label={t("description")}>
            <input name="description" className={inputClass} />
          </Field>
          <ImageInput alt="" />
          <TranslationFields fields={["name", "description"]} />
        </ActionForm>
      </section>
    </main>
  );
}
