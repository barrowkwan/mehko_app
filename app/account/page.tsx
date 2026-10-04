import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { deleteAccount } from "./actions";

export default async function AccountPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("account");
  const { data: blocker } = await supabase.rpc("account_deletion_blocker");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = profile?.display_name || user.email || "";

  return (
    <main className="flex max-w-lg flex-col gap-6 p-4">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("signedInAs", { name })}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-red-300 p-4 dark:border-red-900">
        <h2 className="font-semibold text-red-700 dark:text-red-400">{t("dangerTitle")}</h2>
        <p className="text-sm">{t("dangerIntro")}</p>
        <ul className="list-disc pl-5 text-sm">
          <li>{t("deletesProfile")}</li>
          <li>{t("deletesOrders")}</li>
          <li>{t("deletesMerchant")}</li>
        </ul>
        {blocker ? (
          <p className="rounded bg-yellow-100 p-3 text-sm text-yellow-900">{t("blocked")}</p>
        ) : (
          <ActionForm action={deleteAccount} submitLabel={t("submit")} buttonClassName="bg-red-600 hover:bg-red-700">
            <Field label={t("confirmLabel")}>
              <input name="confirm" autoComplete="off" required className={inputClass} />
            </Field>
          </ActionForm>
        )}
      </section>
    </main>
  );
}
