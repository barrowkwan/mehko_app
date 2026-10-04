import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHolidayLookup, fetchWeather } from "@/lib/context-fetch";

// Snapshots weather + holiday info for offerings so reports can group by them.
// Invoke daily (Vercel Cron, Supabase pg_cron + pg_net, or any scheduler) with
// `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  // Privacy hygiene: wipe stored live-location coordinates that have not been refreshed for 12 hours.
  const { error: clearError } = await supabase.rpc("clear_stale_locations");
  if (clearError) console.error("Clearing stale locations failed:", clearError.message);
  const day = 86_400_000;
  const iso = (offset: number) => new Date(Date.now() + offset * day).toISOString().slice(0, 10);

  // Refresh a rolling window (forecasts change; archive data settles) and backfill anything missing.
  const { data: offerings, error } = await supabase
    .from("offerings")
    .select("id, pickup_date, pickup_point:pickup_points(lat, lng), merchant:merchants(country_code), context:offering_context(offering_id)")
    .lte("pickup_date", iso(14))
    .order("pickup_date", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const holidayOn = createHolidayLookup();
  let updated = 0;
  for (const o of offerings ?? []) {
    const inWindow = o.pickup_date >= iso(-7);
    if (!inWindow && o.context) continue; // already settled
    if (!o.pickup_point || !o.merchant) continue;

    const [weather, holidayName] = await Promise.all([
      fetchWeather(o.pickup_point.lat, o.pickup_point.lng, o.pickup_date),
      holidayOn(o.pickup_date, o.merchant.country_code),
    ]);
    const { error: upsertError } = await supabase.from("offering_context").upsert({
      offering_id: o.id,
      weather_bucket: weather?.bucket ?? null,
      weather_summary: weather?.summary ?? null,
      temp_max_c: weather?.tempMaxC ?? null,
      precip_mm: weather?.precipMm ?? null,
      is_holiday: holidayName !== null,
      holiday_name: holidayName,
      fetched_at: new Date().toISOString(),
    });
    if (!upsertError) updated += 1;
  }
  return NextResponse.json({ updated });
}
