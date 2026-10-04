import { NextResponse, type NextRequest } from "next/server";
import { placesFromEnv } from "@/lib/places";
import { createSearcher } from "@/lib/places/search";
import { createClient } from "@/lib/supabase/server";

// Place search for merchants adding a pickup point. Behind the normal sign-in (not a public path); only merchants may
// use it. The provider key stays on the server.
export const dynamic = "force-dynamic";

const searcher = createSearcher(placesFromEnv());

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: merchant } = await supabase.from("merchants").select("id, country_code").eq("owner_id", data.user.id).limit(1).maybeSingle();
  if (!merchant) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const result = await searcher.search({
    userId: data.user.id,
    country: merchant.country_code,
    q: params.get("q") ?? "",
    near: params.get("near") ?? "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ places: result.places });
}
