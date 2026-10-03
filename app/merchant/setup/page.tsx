import { redirect } from "next/navigation";
import { getMyMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { createMerchant } from "../actions";

export default async function SetupPage() {
  const { merchant } = await getMyMerchant();
  if (merchant) redirect("/merchant");
  return (
    <main className="flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Become a merchant</h1>
      <p className="text-sm text-neutral-500">Create your merchant profile to start listing food for pickup.</p>
      <ActionForm action={createMerchant} submitLabel="Create merchant">
        <Field label="Business name">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea name="description" rows={3} className={inputClass} />
        </Field>
        <Field label="Country code (for public holidays)">
          <input name="country_code" defaultValue="US" maxLength={2} required className={inputClass} />
        </Field>
      </ActionForm>
    </main>
  );
}
