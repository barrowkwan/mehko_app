// Live local Supabase (SUPABASE_INTEGRATION=1): real concurrent connections place orders at the same moment; the
// per-merchant counter must hand out distinct, gap-free numbers (the in-process test database has one connection only).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

type Client = SupabaseClient<Database>;
const admin: Client = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
const run = Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

async function signUp(name: string) {
  const email = `${name}-${run}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: "test-password-123", email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: "test-password-123" });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

describe.skipIf(!process.env.SUPABASE_INTEGRATION)("order numbers on live Supabase", () => {
  let merchantCode: string;
  let offeringId: string;
  let itemId: string;
  const customers: Awaited<ReturnType<typeof signUp>>[] = [];

  beforeAll(async () => {
    const mer = await signUp("onmerchant");
    const m = must(await mer.client.from("merchants").insert({ owner_id: mer.id, name: `Numbers Kitchen ${run}` }).select("id, code").single());
    merchantCode = m.code;
    const pointId = must(await mer.client.from("pickup_points").insert({ merchant_id: m.id, name: "Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single()).id;
    const foodId = must(await mer.client.from("food_items").insert({ merchant_id: m.id, name: "Buns" }).select("id").single()).id;
    offeringId = must(
      await mer.client
        .from("offerings")
        .insert({ merchant_id: m.id, pickup_point_id: pointId, pickup_date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString() })
        .select("id")
        .single(),
    ).id;
    itemId = must(await mer.client.from("offering_items").insert({ offering_id: offeringId, food_item_id: foodId }).select("id").single()).id;
    for (let i = 0; i < 6; i++) customers.push(await signUp(`oncust${i}`));
  }, 60_000);

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it("six simultaneous orders get six distinct consecutive numbers", async () => {
    const results = await Promise.all(
      customers.map((c) => c.client.rpc("place_order", { p_offering: offeringId, p_items: [{ offering_item_id: itemId, qty: 1 }] })),
    );
    for (const r of results) expect(r.error).toBeNull();
    const rows = must(await admin.from("orders").select("order_no").eq("offering_id", offeringId));
    const numbers = rows.map((r) => r.order_no).sort();
    expect(new Set(numbers).size).toBe(6);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6].map((n) => `${merchantCode}-${String(n).padStart(8, "0")}`));
  });
});
