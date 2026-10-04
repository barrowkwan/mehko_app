import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { foodPhotoUrl } from "@/components/food-photo";
import { ImageInput } from "@/components/image-input";
import { TranslationFields } from "@/components/translation-fields";
import { updateMerchantProfile } from "../actions";

export default async function MerchantProfilePage() {
  const { merchant } = await requireMerchant();
  const t = await getTranslations("setup");
  const tp = await getTranslations("profile");
  return (
    <main className="flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{tp("title")}</h1>
      <p className="text-sm text-neutral-500">{tp("merchantId", { code: merchant.code })}</p>
      <ActionForm action={updateMerchantProfile} submitLabel={tp("submit")}>
        <Field label={t("name")}>
          <input name="name" defaultValue={merchant.name} required className={inputClass} />
        </Field>
        <Field label={t("description")}>
          <textarea name="description" rows={3} defaultValue={merchant.description ?? ""} className={inputClass} />
        </Field>
        <ImageInput
          currentUrl={foodPhotoUrl(merchant.logo_path)}
          alt={tp("logo")}
          labels={{ photo: tp("logo"), help: tp("logoHelp"), remove: tp("removeLogo"), unsupported: tp("logoUnsupported") }}
        />
        <Field label={tp("website")}>
          <input name="website" type="text" inputMode="url" defaultValue={merchant.website ?? ""} placeholder="https://" maxLength={200} className={inputClass} />
        </Field>
        <Field label={tp("contactEmail")}>
          <input name="contact_email" type="email" defaultValue={merchant.contact_email ?? ""} maxLength={200} className={inputClass} />
        </Field>
        <Field label={tp("contactPhone")}>
          <input name="contact_phone" type="tel" defaultValue={merchant.contact_phone ?? ""} maxLength={30} className={inputClass} />
        </Field>
        <p className="-mt-2 text-xs text-neutral-500">{tp("contactHelp")}</p>
        <Field label={t("country")}>
          <select name="country_code" defaultValue="US" className={inputClass}>
            <option value="US">{tp("countryUS")}</option>
          </select>
        </Field>
        <TranslationFields translations={merchant.translations} fields={["name", "description"]} />
      </ActionForm>
    </main>
  );
}
