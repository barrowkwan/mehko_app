"use server";

import { redirect } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

// Confirm button on /unsubscribe (opening the link alone changes nothing, so link scanners can't unsubscribe anyone).
export async function unsubscribe(token: string): Promise<void> {
  const userId = verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET ?? "");
  if (!userId) redirect("/unsubscribe?token=invalid");
  const { error } = await createAdminClient().from("profiles").update({ email_notifications: false }).eq("id", userId);
  if (error) throw new Error("Unsubscribe failed");
  redirect("/unsubscribe?done=1");
}
