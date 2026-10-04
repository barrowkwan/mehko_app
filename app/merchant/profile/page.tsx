import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { TranslationFields } from "@/components/translation-fields";
import { updateMerchantProfile } from "../actions";

export default async function MerchantProfilePage() {
  const { merchant } = await requireMerchant();
  const t = await getTranslations("setup");
  const tp = await getTranslations("profile");
  return (
    <main className="flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{tp("title")}</h1>
      <ActionForm action={updateMerchantProfile} submitLabel={tp("submit")}>
        <Field label={t("name")}>
          <input name="name" defaultValue={merchant.name} required className={inputClass} />
        </Field>
        <Field label={t("description")}>
          <textarea name="description" rows={3} defaultValue={merchant.description ?? ""} className={inputClass} />
        </Field>
        <Field label={t("country")}>
          <input name="country_code" defaultValue={merchant.country_code} maxLength={2} required className={inputClass} />
        </Field>
        <TranslationFields translations={merchant.translations} fields={["name", "description"]} />
      </ActionForm>
    </main>
  );
}
