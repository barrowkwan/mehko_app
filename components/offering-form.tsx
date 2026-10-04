import { getTranslations } from "next-intl/server";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { CutoffInput } from "@/components/cutoff-input";
import { ExtraSlots } from "@/components/extra-slots";
import { TranslationFields } from "@/components/translation-fields";
import type { FormState } from "@/app/orders/actions";

export type OfferingFormValues = {
  pickupPointId: string;
  pickupDate: string; // YYYY-MM-DD
  pickupStart: string; // HH:MM[:SS]
  pickupEnd: string;
  cutoffAt: string; // ISO instant
  items: Record<string, number | null>; // foodId -> limit (null = unlimited); presence = selected
  instructions?: string | null;
  translations?: unknown;
};

// Used by "New offering" and "Edit offering". When `lockMove` is set (the offering already has orders) the
// pickup point and date are shown read-only; hidden inputs still submit their values.
export async function OfferingForm({
  action,
  submitLabel,
  points,
  foods,
  values,
  lockMove = false,
  allowExtraSlots = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  points: { id: string; name: string }[];
  foods: { id: string; name: string }[];
  values?: OfferingFormValues;
  lockMove?: boolean;
  allowExtraSlots?: boolean; // "New offering" only: more pickup slots (other editing is done per slot on its page)
}) {
  const t = await getTranslations("offerings");
  const hhmm = (v?: string) => v?.slice(0, 5);
  const lockedPointName = points.find((p) => p.id === values?.pickupPointId)?.name ?? "";

  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {lockMove && values ? (
        <>
          <input type="hidden" name="pickup_point_id" value={values.pickupPointId} />
          <input type="hidden" name="pickup_date" value={values.pickupDate} />
          <p className="rounded bg-yellow-100 p-3 text-sm text-yellow-900">{t("lockedHint")}</p>
          <Field label={t("pickupPoint")}>
            <input value={lockedPointName} disabled readOnly className={inputClass} />
          </Field>
          <Field label={t("pickupDate")}>
            <input value={values.pickupDate} disabled readOnly className={inputClass} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("pickupPoint")}>
            <select name="pickup_point_id" required defaultValue={values?.pickupPointId} className={inputClass}>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("pickupDate")}>
            <input type="date" name="pickup_date" required defaultValue={values?.pickupDate} className={inputClass} />
          </Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("pickupFrom")}>
          <input type="time" name="pickup_start" required defaultValue={hhmm(values?.pickupStart)} className={inputClass} />
        </Field>
        <Field label={t("pickupUntil")}>
          <input type="time" name="pickup_end" required defaultValue={hhmm(values?.pickupEnd)} className={inputClass} />
        </Field>
      </div>
      <CutoffInput defaultIso={values?.cutoffAt} />
      {allowExtraSlots && <ExtraSlots points={points} />}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("foodsOnSale")}</legend>
        {foods.map((f) => {
          const selected = values ? f.id in values.items : false;
          const limit = values?.items[f.id];
          return (
            <div key={f.id} className="flex items-center gap-3">
              <label className="mr-auto flex items-center gap-2">
                <input type="checkbox" name={`food_${f.id}`} defaultChecked={selected} /> {f.name}
              </label>
              <input
                type="number"
                min={1}
                name={`limit_${f.id}`}
                defaultValue={limit ?? ""}
                placeholder={t("limit")}
                className="w-24 rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-700"
              />
            </div>
          );
        })}
      </fieldset>
      <Field label={t("instructions")}>
        <textarea name="instructions" rows={3} maxLength={500} defaultValue={values?.instructions ?? ""} className={inputClass} />
      </Field>
      <p className="-mt-2 text-xs text-neutral-500">{t("instructionsHelp")}</p>
      <TranslationFields translations={values?.translations} fields={["instructions"]} />
    </ActionForm>
  );
}
