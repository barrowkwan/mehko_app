"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/orders/actions";

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

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
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
