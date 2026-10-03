import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { addPickupPoint, setPickupPointActive } from "../actions";
import { GeoFill } from "./geo-fill";

export default async function PickupPointsPage() {
  const { supabase, merchant } = await requireMerchant();
  const { data: points } = await supabase
    .from("pickup_points")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">Pickup points</h1>
      <ul className="flex flex-col gap-2">
        {points?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mr-auto">
              <p className={`font-medium ${p.active ? "" : "text-neutral-400 line-through"}`}>{p.name}</p>
              <p className="text-sm text-neutral-500">
                {p.address} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · {p.timezone}
              </p>
            </div>
            <form action={setPickupPointActive.bind(null, p.id, !p.active)}>
              <button className="text-sm text-orange-600 hover:underline">{p.active ? "Disable" : "Enable"}</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="max-w-md">
        <h2 className="mb-2 font-semibold">Add a pickup point</h2>
        <ActionForm action={addPickupPoint} submitLabel="Add pickup point">
          <Field label="Name">
            <input name="name" required className={inputClass} />
          </Field>
          <Field label="Address">
            <input name="address" className={inputClass} />
          </Field>
          <GeoFill />
          <Field label="Timezone (IANA)">
            <input name="timezone" defaultValue={tz} required className={inputClass} />
          </Field>
        </ActionForm>
      </section>
    </main>
  );
}
