"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FOOD_IMAGE_BUCKET } from "@/lib/images";
import type { FormState } from "@/app/orders/actions";

// Turns the signed-in user's notification emails on or off (RLS: a user can update only their own profile).
export async function setEmailNotifications(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ email_notifications: formData.get("enabled") === "on" }).eq("id", user.id);
  if (error) return { error: (await getTranslations("errors"))("generic") };
  return { saved: true };
}

// Permanently deletes the signed-in user's account (store requirement). Order of checks matters:
//  1. explicit confirmation, 2. database rule (a merchant with upcoming active orders is blocked,
//  enforced by the account_deletion_blocker() RPC under the user's own RLS), 3. delete the auth user
//  with the admin API — the database cascades profile, orders and merchant data (migration 20261005).
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("account");
  const tErrors = await getTranslations("errors");
  const { supabase, user } = await requireUser();

  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") return { error: t("confirmMismatch") };

  const { data: blocker, error: blockerError } = await supabase.rpc("account_deletion_blocker");
  if (blockerError) return { error: tErrors("generic") };
  if (blocker === "merchant_active_orders") return { error: tErrors("merchantHasActiveOrders") };

  const admin = createAdminClient();
  await removeMerchantPhotos(admin, user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Account deletion failed:", error.message);
    return { error: tErrors("generic") };
  }

  // The user no longer exists; clearing the local session cookies is all that's left (server revoke may 4xx).
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore
  }
  redirect("/login?deleted=1");
}

// Deleting the account removes the database rows by cascade, but files in Storage are not touched by that:
// delete the merchant's photo folder first. Best effort: a failure is logged and does not block the deletion.
async function removeMerchantPhotos(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<void> {
  try {
    const { data: merchants } = await admin.from("merchants").select("id").eq("owner_id", userId);
    for (const m of merchants ?? []) {
      const { data: files } = await admin.storage.from(FOOD_IMAGE_BUCKET).list(m.id, { limit: 1000 });
      if (files?.length) await admin.storage.from(FOOD_IMAGE_BUCKET).remove(files.map((f) => `${m.id}/${f.name}`));
    }
  } catch (e) {
    console.error("Removing merchant photos failed:", e instanceof Error ? e.message : e);
  }
}
