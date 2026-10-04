import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

// Verifies the Sentry setup end to end. Protected like the cron endpoint (Authorization: Bearer $CRON_SECRET).
//   GET ?mode=message  → sends a test message, returns whether Sentry is enabled
//   GET ?mode=throw    → throws an error inside the request (checks automatic server error capture)
// Lives under /api/cron/ so the auth gate (proxy matcher) leaves it alone.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const enabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
  if (request.nextUrl.searchParams.get("mode") === "throw") {
    throw new Error("Sentry test: deliberate server error from /api/cron/sentry-test");
  }
  const eventId = Sentry.captureMessage("Sentry test message from /api/cron/sentry-test", "info");
  await Sentry.flush(3000);
  return NextResponse.json({ sentryEnabled: enabled, eventId: enabled ? eventId : null });
}
