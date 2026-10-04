import { getTranslations } from "next-intl/server";
import { requireMerchant } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { placesFromEnv } from "@/lib/places";
import { addPickupPoint, setPickupPointActive, updatePickupPoint } from "../actions";
import { PlaceSearch } from "./place-search";

export default async function PickupPointsPage() {
  const { supabase, merchant } = await requireMerchant();
  const t = await getTranslations("pickupPoints");
  const tc = await getTranslations("common");
  const { data: points } = await supabase
    .from("pickup_points")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at");
  const searchEnabled = placesFromEnv() !== null; // no provider key → the search box is hidden, the map still works

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <ul className="flex flex-col gap-2">
        {points?.map((p) => (
          <li key={p.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="mr-auto">
                <p className={`font-medium ${p.active ? "" : "text-neutral-400 line-through"}`}>{p.name}</p>
                {p.address && <p className="text-sm text-neutral-500">{p.address}</p>}
              </div>
              <form action={setPickupPointActive.bind(null, p.id, !p.active)}>
                <button className="text-sm text-orange-600 hover:underline">{p.active ? tc("disable") : tc("enable")}</button>
              </form>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-orange-600">{t("editButton")}</summary>
              <div className="mt-2 max-w-md">
                <ActionForm action={updatePickupPoint.bind(null, p.id)} submitLabel={t("updateSubmit")}>
                  <PlaceSearch
                    searchEnabled={searchEnabled}
                    initial={{ name: p.name, address: p.address, lat: p.lat, lng: p.lng, timezone: p.timezone }}
                  />
                </ActionForm>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section className="max-w-md">
        <h2 className="mb-2 font-semibold">{t("addTitle")}</h2>
        <ActionForm action={addPickupPoint} submitLabel={t("submit")}>
          <PlaceSearch searchEnabled={searchEnabled} />
        </ActionForm>
      </section>
    </main>
  );
}
