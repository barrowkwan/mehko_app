import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { TranslationFields } from "@/components/translation-fields";
import { addFood, setFoodActive, updateFood } from "../actions";

export default async function FoodsPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("foods");
  const tc = await getTranslations("common");
  const { data: foods } = await supabase
    .from("food_items")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("name");

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <ul className="flex flex-col gap-2">
        {foods?.map((f) => (
          <li key={f.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="mr-auto">
                <p className={`font-medium ${f.active ? "" : "text-neutral-400 line-through"}`}>{f.name}</p>
                {f.description && <p className="text-sm text-neutral-500">{f.description}</p>}
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
                  <TranslationFields translations={f.translations} fields={["name", "description"]} />
                </ActionForm>
              </div>
            </details>
          </li>
        ))}
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
          <TranslationFields fields={["name", "description"]} />
        </ActionForm>
      </section>
    </main>
  );
}
