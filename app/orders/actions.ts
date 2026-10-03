"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

function parseItems(formData: FormData) {
  const items: { offering_item_id: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const qty = Number.parseInt(String(value), 10);
    if (Number.isFinite(qty) && qty > 0) items.push({ offering_item_id: key.slice(4), qty });
  }
  return items;
}

export async function placeOrder(offeringId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const items = parseItems(formData);
  if (items.length === 0) return { error: "Choose at least one item." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", { p_offering: offeringId, p_items: items });
  if (error) return { error: error.message };
  redirect(`/orders/${data}`);
}

export async function updateOrder(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const items = parseItems(formData);
  if (items.length === 0) return { error: "Choose at least one item, or cancel the order instead." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order", { p_order: orderId, p_items: items });
  if (error) return { error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return undefined;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId });
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  redirect("/orders");
}
