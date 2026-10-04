"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireMerchant, requireUser } from "@/lib/auth";
import { translateDbError } from "@/lib/db-errors";
import { parseTranslations } from "@/lib/locale";
import type { FormState } from "@/app/orders/actions";

const text = z.string().trim();
const optionalText = text.transform((v) => (v === "" ? null : v));

// Zod messages are already translated by the schemas; the fallback covers anything unexpected.
async function firstError(e: z.ZodError): Promise<FormState> {
  return { error: e.issues[0]?.message ?? (await getTranslations("errors"))("generic") };
}

async function dbError(message: string): Promise<string> {
  return translateDbError(await getTranslations("errors"), message);
}

// ───────── merchant registration & profile ─────────

export async function createMerchant(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("setup");
  const parsed = z
    .object({
      name: text.min(1, t("nameRequired")),
      description: optionalText,
      country_code: text.length(2, t("countryInvalid")).transform((v) => v.toUpperCase()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("merchants").insert({ ...parsed.data, owner_id: user.id });
  if (error) return { error: await dbError(error.message) };
  redirect("/merchant");
}

export async function updateMerchantProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("setup");
  const parsed = z
    .object({
      name: text.min(1, t("nameRequired")),
      description: optionalText,
      country_code: text.length(2, t("countryInvalid")).transform((v) => v.toUpperCase()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);

  const { supabase, merchant } = await requireMerchant();
  const translations = parseTranslations(formData, ["name", "description"]);
  const { error } = await supabase.from("merchants").update({ ...parsed.data, translations }).eq("id", merchant.id);
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant", "layout");
  return { error: undefined, saved: true };
}

// ───────── pickup points ─────────

export async function addPickupPoint(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("pickupPoints");
  const parsed = z
    .object({
      name: text.min(1, t("nameRequired")),
      address: optionalText,
      lat: z.coerce.number(t("latInvalid")).min(-90, t("latInvalid")).max(90, t("latInvalid")),
      lng: z.coerce.number(t("lngInvalid")).min(-180, t("lngInvalid")).max(180, t("lngInvalid")),
      timezone: text.min(1, t("timezoneRequired")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);
  try {
    Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone });
  } catch {
    return { error: t("timezoneUnknown") };
  }

  const { supabase, merchant } = await requireMerchant();
  const { error } = await supabase.from("pickup_points").insert({ ...parsed.data, merchant_id: merchant.id });
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/pickup-points");
  return undefined;
}

export async function setPickupPointActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireMerchant();
  await supabase.from("pickup_points").update({ active }).eq("id", id);
  revalidatePath("/merchant/pickup-points");
}

// ───────── foods ─────────

export async function addFood(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("foods");
  const parsed = z
    .object({ name: text.min(1, t("nameRequired")), description: optionalText })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);

  const { supabase, merchant } = await requireMerchant();
  const translations = parseTranslations(formData, ["name", "description"]);
  const { error } = await supabase.from("food_items").insert({ ...parsed.data, translations, merchant_id: merchant.id });
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/foods");
  return undefined;
}

export async function updateFood(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("foods");
  const parsed = z
    .object({ name: text.min(1, t("nameRequired")), description: optionalText })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);

  const { supabase, merchant } = await requireMerchant();
  const translations = parseTranslations(formData, ["name", "description"]);
  const { error } = await supabase
    .from("food_items")
    .update({ ...parsed.data, translations })
    .eq("id", id)
    .eq("merchant_id", merchant.id);
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/foods");
  return { error: undefined, saved: true };
}

export async function setFoodActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireMerchant();
  await supabase.from("food_items").update({ active }).eq("id", id);
  revalidatePath("/merchant/foods");
}

// ───────── offerings ─────────

export async function createOffering(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("offerings");
  const parsed = z
    .object({
      pickup_point_id: z.uuid(t("choosePoint")),
      pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("dateRequired")),
      pickup_start: z.string().regex(/^\d{2}:\d{2}/, t("startRequired")),
      pickup_end: z.string().regex(/^\d{2}:\d{2}/, t("endRequired")),
      cutoff_at: z.iso.datetime({ offset: true, message: t("cutoffRequired") }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);

  const items: { food_item_id: string; quantity_limit: number | null }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("food_") || value !== "on") continue;
    const id = key.slice(5);
    const lim = Number.parseInt(String(formData.get(`limit_${id}`) ?? ""), 10);
    items.push({ food_item_id: id, quantity_limit: Number.isFinite(lim) && lim > 0 ? lim : null });
  }
  if (items.length === 0) return { error: t("selectFood") };

  const { supabase, merchant } = await requireMerchant();
  const { data: offering, error } = await supabase
    .from("offerings")
    .insert({ ...parsed.data, merchant_id: merchant.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error.message) };

  const { error: itemsError } = await supabase
    .from("offering_items")
    .insert(items.map((i) => ({ ...i, offering_id: offering.id })));
  if (itemsError) {
    await supabase.from("offerings").delete().eq("id", offering.id);
    return { error: await dbError(itemsError.message) };
  }
  revalidatePath("/merchant/offerings");
  redirect(`/merchant/offerings/${offering.id}`);
}

export async function setOfferingStatus(id: string, status: "draft" | "published" | "closed"): Promise<void> {
  const { supabase } = await requireMerchant();
  await supabase.from("offerings").update({ status }).eq("id", id);
  revalidatePath(`/merchant/offerings/${id}`);
  revalidatePath("/merchant/offerings");
}

// ───────── live location ─────────
// Called repeatedly from the browser while the merchant is sharing. RLS (can_share_location)
// restricts writes to the pickup date in the pickup point's timezone.

export async function updateLocation(
  offeringId: string,
  coords: { lat: number; lng: number } | null,
): Promise<{ error?: string }> {
  const { supabase } = await requireMerchant();
  const now = new Date().toISOString();
  // Stopping uses a plain update: an upsert would re-run the insert policy, which only allows
  // writes on the pickup date, and sharing must always be stoppable.
  const { error } = coords
    ? await supabase
        .from("location_shares")
        .upsert({ offering_id: offeringId, lat: coords.lat, lng: coords.lng, active: true, updated_at: now })
    : await supabase.from("location_shares").update({ active: false, updated_at: now }).eq("offering_id", offeringId);
  return error ? { error: await dbError(error.message) } : {};
}

// ───────── QR pickup ─────────

export type PickupResult =
  | { ok: true; customerName: string | null; alreadyPickedUp: boolean }
  | { ok: false; error: string };

export async function confirmPickup(token: string): Promise<PickupResult> {
  const { supabase } = await requireMerchant();
  const { data, error } = await supabase.rpc("confirm_pickup", { p_token: token.trim() });
  if (error) return { ok: false, error: await dbError(error.message) };
  const row = data?.[0];
  if (!row) return { ok: false, error: (await getTranslations("errors"))("unknownQr") };
  revalidatePath("/merchant", "layout");
  return { ok: true, customerName: row.customer_name, alreadyPickedUp: row.already_picked_up };
}
