import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { addPickupPoint, setPickupPointActive, updatePickupPointTimezone } from "../actions";
import { GeoFill } from "./geo-fill";
import { TimezoneField } from "./timezone-field";

export default async function PickupPointsPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("pickupPoints");
  const tc = await getTranslations("common");
  const { data: points } = await supabase
    .from("pickup_points")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at");

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <ul className="flex flex-col gap-2">
        {points?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mr-auto">
              <p className={`font-medium ${p.active ? "" : "text-neutral-400 line-through"}`}>{p.name}</p>
              <p className="text-sm text-neutral-500">
                {p.address} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · {p.timezone}
              </p>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-orange-600">{t("changeTimezone")}</summary>
              <ActionForm action={updatePickupPointTimezone.bind(null, p.id)} submitLabel={t("saveTimezone")} className="mt-2 flex flex-col gap-2">
                <TimezoneField defaultValue={p.timezone} />
              </ActionForm>
            </details>
            <form action={setPickupPointActive.bind(null, p.id, !p.active)}>
              <button className="text-sm text-orange-600 hover:underline">{p.active ? tc("disable") : tc("enable")}</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="max-w-md">
        <h2 className="mb-2 font-semibold">{t("addTitle")}</h2>
        <ActionForm action={addPickupPoint} submitLabel={t("submit")}>
          <Field label={t("name")}>
            <input name="name" required className={inputClass} />
          </Field>
          <Field label={t("address")}>
            <input name="address" className={inputClass} />
          </Field>
          <GeoFill />
          <TimezoneField />
        </ActionForm>
      </section>
    </main>
  );
}
