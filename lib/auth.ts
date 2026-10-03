import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

// The signed-in user's merchant record, or null if they haven't registered as a merchant.
export async function getMyMerchant() {
  const { supabase, user } = await requireUser();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  return { supabase, user, merchant };
}

export async function requireMerchant() {
  const ctx = await getMyMerchant();
  if (!ctx.merchant) redirect("/merchant/setup");
  return { ...ctx, merchant: ctx.merchant };
}

// Only allow same-site relative redirects.
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
