import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { runNotifications } from "@/lib/notifications/run";

// Sends due email notifications. Protected like the other cron routes (Authorization: Bearer $CRON_SECRET).
// Poked every ~10 minutes by .github/workflows/notifications.yml. Safe to call any time: it is idempotent.
export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runNotifications({ siteUrl: publicOrigin(request) }));
  } catch (e) {
    console.error("Sending notifications failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
