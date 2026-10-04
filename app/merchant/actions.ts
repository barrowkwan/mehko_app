"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireMerchant, requireUser } from "@/lib/auth";
import { translateDbError } from "@/lib/db-errors";
import { parseTranslations } from "@/lib/locale";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { FOOD_IMAGE_BUCKET, foodImagePath, stripJpegMetadata, validateImageUpload } from "@/lib/images";
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

// Fixes a point's timezone (e.g. points created before the form used the browser's timezone).
export async function updatePickupPointTimezone(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("pickupPoints");
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!timezone) return { error: t("timezoneRequired") };
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return { error: t("timezoneUnknown") };
  }
  const { supabase } = await requireMerchant();
  const { error } = await supabase.from("pickup_points").update({ timezone }).eq("id", id);
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/pickup-points");
  return { saved: true };
}

export async function setPickupPointActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireMerchant();
  await supabase.from("pickup_points").update({ active }).eq("id", id);
  revalidatePath("/merchant/pickup-points");
}

// ───────── foods ─────────

// ───────── food photos (docs/plans/feat-2-food-photos.md) ─────────

type Db = SupabaseClient<Database>;

const uploadedFile = (formData: FormData): File | null => {
  const f = formData.get("image");
  return f instanceof File && f.size > 0 ? f : null;
};

// Validates, strips all metadata (EXIF/GPS, XMP, IPTC) from, and uploads a food photo with the merchant's own session
// (storage RLS: only their own folder). Returns the stored path or a translated error message.
async function storeFoodImage(supabase: Db, merchantId: string, foodId: string, file: File): Promise<{ path: string } | { error: string }> {
  const te = await getTranslations("errors");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const invalid = validateImageUpload({ size: file.size, type: file.type }, bytes);
  if (invalid) return { error: te(invalid) };
  let clean: Uint8Array;
  try {
    clean = stripJpegMetadata(bytes);
  } catch {
    return { error: te("imageInvalid") };
  }
  const path = foodImagePath(merchantId, foodId, crypto.randomUUID().replace(/-/g, "").slice(0, 10));
  const { error } = await supabase.storage
    .from(FOOD_IMAGE_BUCKET)
    .upload(path, clean, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("Food photo upload failed:", error.message);
    return { error: te("imageUploadFailed") };
  }
  return { path };
}

async function removeFoodImage(supabase: Db, path: string | null | undefined): Promise<void> {
  if (path) await supabase.storage.from(FOOD_IMAGE_BUCKET).remove([path]); // best effort; the old file is just orphaned if this fails
}

export async function addFood(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("foods");
  const parsed = z
    .object({ name: text.min(1, t("nameRequired")), description: optionalText })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await firstError(parsed.error);

  const { supabase, merchant } = await requireMerchant();
  const translations = parseTranslations(formData, ["name", "description"]);
  const { data: food, error } = await supabase
    .from("food_items")
    .insert({ ...parsed.data, translations, merchant_id: merchant.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error.message) };

  const file = uploadedFile(formData);
  if (file) {
    const stored = await storeFoodImage(supabase, merchant.id, food.id, file);
    if ("error" in stored) {
      revalidatePath("/merchant/foods"); // the food itself was saved
      return { error: stored.error };
    }
    await supabase.from("food_items").update({ image_path: stored.path }).eq("id", food.id);
  }
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
  const { data: current } = await supabase.from("food_items").select("image_path").eq("id", id).eq("merchant_id", merchant.id).maybeSingle();

  let imagePath: string | null | undefined; // undefined = unchanged
  const file = uploadedFile(formData);
  if (file) {
    const stored = await storeFoodImage(supabase, merchant.id, id, file);
    if ("error" in stored) return { error: stored.error };
    imagePath = stored.path;
  } else if (formData.get("remove_image") === "on") {
    imagePath = null;
  }

  const { error } = await supabase
    .from("food_items")
    .update({ ...parsed.data, translations, ...(imagePath !== undefined ? { image_path: imagePath } : {}) })
    .eq("id", id)
    .eq("merchant_id", merchant.id);
  if (error) {
    if (imagePath) await removeFoodImage(supabase, imagePath); // don't leave the new file behind
    return { error: await dbError(error.message) };
  }
  if (imagePath !== undefined) await removeFoodImage(supabase, current?.image_path);
  revalidatePath("/merchant/foods");
  return { error: undefined, saved: true };
}

export async function setFoodActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireMerchant();
  await supabase.from("food_items").update({ active }).eq("id", id);
  revalidatePath("/merchant/foods");
}

// ───────── offerings ─────────

// Shared by createOffering and updateOffering so the two can never validate differently.
type OfferingInput = {
  schedule: { pickup_point_id: string; pickup_date: string; pickup_start: string; pickup_end: string; cutoff_at: string };
  instructions: string | null; // null = none
  translations: ReturnType<typeof parseTranslations>;
  items: { food_item_id: string; quantity_limit: number | null }[];
};

async function parseOfferingForm(formData: FormData): Promise<{ ok: true; value: OfferingInput } | { ok: false; error: FormState }> {
  const t = await getTranslations("offerings");
  const parsed = z
    .object({
      pickup_point_id: z.uuid(t("choosePoint")),
      pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("dateRequired")),
      pickup_start: z.string().regex(/^\d{2}:\d{2}/, t("startRequired")),
      pickup_end: z.string().regex(/^\d{2}:\d{2}/, t("endRequired")),
      cutoff_at: z.iso.datetime({ offset: true, message: t("cutoffRequired") }),
      instructions: text.max(500, t("instructionsTooLong")).default("").transform((v) => (v === "" ? null : v)),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: await firstError(parsed.error) };
  const { instructions, ...schedule } = parsed.data;

  const items: OfferingInput["items"] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("food_") || value !== "on") continue;
    const id = key.slice(5);
    const lim = Number.parseInt(String(formData.get(`limit_${id}`) ?? ""), 10);
    items.push({ food_item_id: id, quantity_limit: Number.isFinite(lim) && lim > 0 ? lim : null });
  }
  if (items.length === 0) return { ok: false, error: { error: t("selectFood") } };
  return { ok: true, value: { schedule, instructions, translations: parseTranslations(formData, ["instructions"]), items } };
}

type SlotInput = { pickup_point_id: string; pickup_date: string; pickup_start: string; pickup_end: string };

// Extra slots arrive as slot_<n>_point/date/start/end (the "More pickup slots" fields); `only` limits parsing to one prefix.
async function parseSlots(formData: FormData, date: string, only?: string): Promise<{ ok: true; slots: SlotInput[] } | { ok: false; error: FormState }> {
  const t = await getTranslations("offerings");
  const prefixes = new Set<string>();
  for (const key of formData.keys()) {
    const m = /^(slot_\d+_)point$/.exec(key);
    if (m && (!only || m[1] === only)) prefixes.add(m[1]);
  }
  const slots: SlotInput[] = [];
  for (const p of prefixes) {
    const parsed = z
      .object({
        pickup_point_id: z.uuid(t("choosePoint")),
        pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("dateRequired")),
        pickup_start: z.string().regex(/^\d{2}:\d{2}/, t("startRequired")),
        pickup_end: z.string().regex(/^\d{2}:\d{2}/, t("endRequired")),
      })
      .safeParse({
        pickup_point_id: formData.get(`${p}point`),
        pickup_date: date, // all slots share the offering's date
        pickup_start: formData.get(`${p}start`),
        pickup_end: formData.get(`${p}end`),
      });
    if (!parsed.success) return { ok: false, error: await firstError(parsed.error) };
    if (parsed.data.pickup_end <= parsed.data.pickup_start) return { ok: false, error: { error: t("endAfterStart") } };
    slots.push(parsed.data);
  }
  return { ok: true, slots };
}

export async function createOffering(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = await parseOfferingForm(formData);
  if (!input.ok) return input.error;
  const extra = await parseSlots(formData, input.value.schedule.pickup_date);
  if (!extra.ok) return extra.error;

  const pointIds = [input.value.schedule.pickup_point_id, ...extra.slots.map((s) => s.pickup_point_id)];
  if (new Set(pointIds).size !== pointIds.length) return { error: (await getTranslations("errors"))("slotPointDuplicate") };

  const { supabase, merchant } = await requireMerchant();
  const { data: offering, error } = await supabase
    .from("offerings")
    .insert({ ...input.value.schedule, instructions: input.value.instructions, translations: input.value.translations, merchant_id: merchant.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error.message) };

  const { error: itemsError } = await supabase
    .from("offering_items")
    .insert(input.value.items.map((i) => ({ ...i, offering_id: offering.id })));
  if (itemsError) {
    await supabase.from("offerings").delete().eq("id", offering.id);
    return { error: await dbError(itemsError.message) };
  }

  // Extra slots copy the offering (cutoff, foods, limits) into siblings; if any fails, nothing is left half-created.
  const created = [offering.id];
  for (const s of extra.slots) {
    const { data: slotId, error: slotError } = await supabase.rpc("add_offering_slot", {
      p_offering: offering.id,
      p_pickup_point: s.pickup_point_id,
      p_date: s.pickup_date,
      p_start: s.pickup_start,
      p_end: s.pickup_end,
    });
    if (slotError) {
      await supabase.from("offerings").delete().in("id", created);
      return { error: await dbError(slotError.message) };
    }
    created.push(slotId);
  }
  revalidatePath("/merchant/offerings");
  redirect(`/merchant/offerings/${offering.id}`);
}

// One atomic database call (update_offering): a rejected change leaves the offering untouched.
export async function updateOffering(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const input = await parseOfferingForm(formData);
  if (!input.ok) return input.error;
  const { schedule, items, instructions, translations } = input.value;

  const { supabase } = await requireMerchant();
  const { error } = await supabase.rpc("update_offering", {
    p_offering: id,
    p_pickup_point: schedule.pickup_point_id,
    p_date: schedule.pickup_date,
    p_start: schedule.pickup_start,
    p_end: schedule.pickup_end,
    p_cutoff: schedule.cutoff_at,
    p_items: items,
    p_instructions: instructions ?? "", // the field is always submitted: blank clears
    p_translations: translations,
  });
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/offerings");
  revalidatePath(`/merchant/offerings/${id}`);
  redirect(`/merchant/offerings/${id}`);
}

// Adds another pickup slot (point/date/time) to an offering; it shares the cutoff, foods and limits.
export async function addOfferingSlot(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireMerchant();
  const { data: offering } = await supabase.from("offerings").select("pickup_date").eq("id", id).maybeSingle();
  if (!offering) return { error: (await getTranslations("errors"))("offeringNotFound") };
  const parsed = await parseSlots(formData, offering.pickup_date, "slot_0_");
  if (!parsed.ok) return parsed.error;
  const [s] = parsed.slots;
  if (!s) return { error: (await getTranslations("errors"))("generic") };
  const { error } = await supabase.rpc("add_offering_slot", {
    p_offering: id,
    p_pickup_point: s.pickup_point_id,
    p_date: s.pickup_date,
    p_start: s.pickup_start,
    p_end: s.pickup_end,
  });
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/offerings");
  revalidatePath(`/merchant/offerings/${id}`);
  return { saved: true };
}

// A draft copy on a new date (same pickup point, times, foods); the merchant reviews and publishes it.
export async function duplicateOffering(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("offeringDetail");
  const date = String(formData.get("new_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: t("duplicateDate") };

  const { supabase } = await requireMerchant();
  const { data, error } = await supabase.rpc("duplicate_offering", { p_offering: id, p_new_date: date });
  if (error) return { error: await dbError(error.message) };
  revalidatePath("/merchant/offerings");
  redirect(`/merchant/offerings/${data}`);
}

// The database refuses to delete an offering that has placed/picked-up orders (customers' orders are never lost).
export async function deleteOffering(id: string): Promise<FormState> {
  const { supabase } = await requireMerchant();
  const { data, error } = await supabase.from("offerings").delete().eq("id", id).select("id");
  if (error) return { error: await dbError(error.message) };
  if (!data?.length) return { error: (await getTranslations("errors"))("offeringNotFound") };
  revalidatePath("/merchant/offerings");
  redirect("/merchant/offerings");
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
