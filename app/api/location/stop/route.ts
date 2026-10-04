import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Switches a merchant's live location sharing off. Called with `keepalive` when the merchant closes or leaves the
// page, where a normal server action could be cancelled. Row-level security lets only the offering's owner do this.
export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { offeringId?: unknown } | null;
  const id = typeof body?.offeringId === "string" ? body.offeringId : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await supabase.from("location_shares").update({ active: false, updated_at: new Date().toISOString() }).eq("offering_id", id);
  return new NextResponse(null, { status: 204 });
}
