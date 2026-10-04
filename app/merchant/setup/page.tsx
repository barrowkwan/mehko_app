import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getMyMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { createMerchant } from "../actions";

export default async function SetupPage() {
  const { merchant } = await getMyMerchant();
  if (merchant) redirect("/merchant");
  const t = await getTranslations("setup");
  return (
    <main className="flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-neutral-500">{t("intro")}</p>
      <ActionForm action={createMerchant} submitLabel={t("submit")}>
        <Field label={t("name")}>
          <input name="name" required className={inputClass} />
        </Field>
        <Field label={t("description")}>
          <textarea name="description" rows={3} className={inputClass} />
        </Field>
        <Field label={t("country")}>
          <input name="country_code" defaultValue="US" maxLength={2} required className={inputClass} />
        </Field>
      </ActionForm>
    </main>
  );
}
