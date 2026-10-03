import { requireMerchant } from "@/lib/auth";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { addFood, setFoodActive } from "../actions";

export default async function FoodsPage() {
  const { supabase, merchant } = await requireMerchant();
  const { data: foods } = await supabase
    .from("food_items")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("name");

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">Foods</h1>
      <ul className="flex flex-col gap-2">
        {foods?.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mr-auto">
              <p className={`font-medium ${f.active ? "" : "text-neutral-400 line-through"}`}>{f.name}</p>
              {f.description && <p className="text-sm text-neutral-500">{f.description}</p>}
            </div>
            <form action={setFoodActive.bind(null, f.id, !f.active)}>
              <button className="text-sm text-orange-600 hover:underline">{f.active ? "Archive" : "Restore"}</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="max-w-md">
        <h2 className="mb-2 font-semibold">Add a food</h2>
        <ActionForm action={addFood} submitLabel="Add food">
          <Field label="Name">
            <input name="name" required className={inputClass} />
          </Field>
          <Field label="Description">
            <input name="description" className={inputClass} />
          </Field>
        </ActionForm>
      </section>
    </main>
  );
}
