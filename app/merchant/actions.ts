"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMerchant, requireUser } from "@/lib/auth";
import type { FormState } from "@/app/orders/actions";

const text = z.string().trim();
const optionalText = text.transform((v) => (v === "" ? null : v));

function firstError(e: z.ZodError): FormState {
  return { error: e.issues[0]?.message ?? "Invalid input" };
}

// ───────── merchant registration ─────────

export async function createMerchant(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      name: text.min(1, "Name is required"),
      description: optionalText,
      country_code: text.length(2, "Use a 2-letter country code, e.g. US").transform((v) => v.toUpperCase()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("merchants").insert({ ...parsed.data, owner_id: user.id });
  if (error) return { error: error.message };
  redirect("/merchant");
}

// ───────── pickup points ─────────

export async function addPickupPoint(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      name: text.min(1, "Name is required"),
      address: optionalText,
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      timezone: text.min(1, "Timezone is required"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);
  try {
    Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone });
  } catch {
    return { error: "Unknown timezone (use an IANA name such as America/New_York)" };
  }

  const { supabase, merchant } = await requireMerchant();
  const { error } = await supabase.from("pickup_points").insert({ ...parsed.data, merchant_id: merchant.id });
  if (error) return { error: error.message };
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
  const parsed = z
    .object({ name: text.min(1, "Name is required"), description: optionalText })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);

  const { supabase, merchant } = await requireMerchant();
  const { error } = await supabase.from("food_items").insert({ ...parsed.data, merchant_id: merchant.id });
  if (error) return { error: error.message };
  revalidatePath("/merchant/foods");
  return undefined;
}

export async function setFoodActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireMerchant();
  await supabase.from("food_items").update({ active }).eq("id", id);
  revalidatePath("/merchant/foods");
}

// ───────── offerings ─────────

export async function createOffering(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      pickup_point_id: z.uuid("Choose a pickup point"),
      pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pickup date is required"),
      pickup_start: z.string().regex(/^\d{2}:\d{2}/, "Pickup start is required"),
      pickup_end: z.string().regex(/^\d{2}:\d{2}/, "Pickup end is required"),
      cutoff_at: z.iso.datetime({ offset: true, message: "Cutoff date/time is required" }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);

  const items: { food_item_id: string; quantity_limit: number | null }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("food_") || value !== "on") continue;
    const id = key.slice(5);
    const lim = Number.parseInt(String(formData.get(`limit_${id}`) ?? ""), 10);
    items.push({ food_item_id: id, quantity_limit: Number.isFinite(lim) && lim > 0 ? lim : null });
  }
  if (items.length === 0) return { error: "Select at least one food item" };

  const { supabase, merchant } = await requireMerchant();
  const { data: offering, error } = await supabase
    .from("offerings")
    .insert({ ...parsed.data, merchant_id: merchant.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: itemsError } = await supabase
    .from("offering_items")
    .insert(items.map((i) => ({ ...i, offering_id: offering.id })));
  if (itemsError) {
    await supabase.from("offerings").delete().eq("id", offering.id);
    return { error: itemsError.message };
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
  return error ? { error: error.message } : {};
}

// ───────── QR pickup ─────────

export type PickupResult =
  | { ok: true; customerName: string | null; alreadyPickedUp: boolean }
  | { ok: false; error: string };

export async function confirmPickup(token: string): Promise<PickupResult> {
  const { supabase } = await requireMerchant();
  const { data, error } = await supabase.rpc("confirm_pickup", { p_token: token.trim() });
  if (error) return { ok: false, error: error.message };
  const row = data?.[0];
  if (!row) return { ok: false, error: "Unknown QR code" };
  revalidatePath("/merchant", "layout");
  return { ok: true, customerName: row.customer_name, alreadyPickedUp: row.already_picked_up };
}
