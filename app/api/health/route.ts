import { NextResponse } from "next/server";
import { checkSupabase } from "@/lib/health";

// For uptime monitors (docs/monitoring.md). 200 = the site is up AND the database answers;
// 503 = the site is up but Supabase is unreachable or misconfigured (e.g. a paused free-tier project).
// Public (see lib/public-paths.ts) and deliberately free of details.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await checkSupabase({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return NextResponse.json(
    { status: db.ok ? "ok" : "degraded", app: "up", database: db.ok ? "ok" : "down", checkedAt: new Date().toISOString() },
    { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
