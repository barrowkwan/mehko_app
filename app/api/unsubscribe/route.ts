import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

// One-click unsubscribe (RFC 8058): mail clients POST here from the List-Unsubscribe header. Only POST changes
// anything (link scanners "click" GET links), and the signed token only allows switching one user's emails off.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const userId = verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET ?? "");
  if (!userId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { error } = await createAdminClient().from("profiles").update({ email_notifications: false }).eq("id", userId);
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// A human who follows the link in the email lands on the confirmation page.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, request.url), 303);
}
