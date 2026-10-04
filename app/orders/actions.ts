"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { translateDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; saved?: boolean } | undefined;

function parseItems(formData: FormData) {
  const items: { offering_item_id: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const qty = Number.parseInt(String(value), 10);
    if (Number.isFinite(qty) && qty > 0) items.push({ offering_item_id: key.slice(4), qty });
  }
  return items;
}

// The optional note for the merchant (allergies, requests). Blank = none (place) / clear (update).
async function parseNote(formData: FormData): Promise<{ note: string } | { error: string }> {
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 300) return { error: (await getTranslations("errors"))("noteTooLong") };
  return { note };
}

export async function placeOrder(offeringId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const items = parseItems(formData);
  if (items.length === 0) return { error: (await getTranslations("orderForm"))("chooseOne") };
  const note = await parseNote(formData);
  if ("error" in note) return { error: note.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", { p_offering: offeringId, p_items: items, p_note: note.note });
  if (error) return { error: translateDbError(await getTranslations("errors"), error.message) };
  redirect(`/orders/${data}`);
}

export async function updateOrder(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const items = parseItems(formData);
  if (items.length === 0) return { error: (await getTranslations("orderForm"))("chooseOneOrCancel") };
  const note = await parseNote(formData);
  if ("error" in note) return { error: note.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order", { p_order: orderId, p_items: items, p_note: note.note });
  if (error) return { error: translateDbError(await getTranslations("errors"), error.message) };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return undefined;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId });
  if (error) throw new Error(translateDbError(await getTranslations("errors"), error.message));
  revalidatePath("/orders");
  redirect("/orders");
}
