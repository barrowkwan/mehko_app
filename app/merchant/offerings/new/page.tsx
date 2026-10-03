import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { createOffering } from "../../actions";
import { CutoffInput } from "./cutoff-input";

export default async function NewOfferingPage() {
  const { supabase, merchant } = await requireMerchant();
  const [{ data: points }, { data: foods }] = await Promise.all([
    supabase.from("pickup_points").select("id, name").eq("merchant_id", merchant.id).eq("active", true).order("name"),
    supabase.from("food_items").select("id, name").eq("merchant_id", merchant.id).eq("active", true).order("name"),
  ]);

  if (!points?.length || !foods?.length) {
    return (
      <main className="flex flex-col gap-2 p-4">
        <h1 className="text-xl font-bold">New offering</h1>
        <p>
          You need at least one <Link href="/merchant/pickup-points" className="text-orange-600 underline">pickup point</Link>{" "}
          and one <Link href="/merchant/foods" className="text-orange-600 underline">food</Link> first.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-lg p-4">
      <h1 className="mb-4 text-xl font-bold">New offering</h1>
      <ActionForm action={createOffering} submitLabel="Publish offering">
        <Field label="Pickup point">
          <select name="pickup_point_id" required className={inputClass}>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pickup date">
          <input type="date" name="pickup_date" required className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pickup from">
            <input type="time" name="pickup_start" required className={inputClass} />
          </Field>
          <Field label="Pickup until">
            <input type="time" name="pickup_end" required className={inputClass} />
          </Field>
        </div>
        <CutoffInput />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Foods on sale (optional limit per item)</legend>
          {foods.map((f) => (
            <div key={f.id} className="flex items-center gap-3">
              <label className="mr-auto flex items-center gap-2">
                <input type="checkbox" name={`food_${f.id}`} /> {f.name}
              </label>
              <input
                type="number"
                min={1}
                name={`limit_${f.id}`}
                placeholder="limit"
                className="w-24 rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-700"
              />
            </div>
          ))}
        </fieldset>
      </ActionForm>
    </main>
  );
}
