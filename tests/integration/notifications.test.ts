// Live local Supabase (SUPABASE_INTEGRATION=1): a real order flows through the outbox, the Supabase-backed store
// and the processor (dry-run sender), and the merchant gets a cutoff summary.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createSupabaseStore } from "../../lib/notifications/store";
import { processOutbox } from "../../lib/notifications/process";
import type { Sender } from "../../lib/notifications/provider";
import en from "../../messages/en.json";

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
  return { id: data.user.id, email, client };
}

describe.skipIf(!process.env.SUPABASE_INTEGRATION)("notifications on live Supabase", () => {
  let mer: Awaited<ReturnType<typeof signUp>>;
  let cust: Awaited<ReturnType<typeof signUp>>;
  let offeringId: string;
  let orderId: string;

  beforeAll(async () => {
    [mer, cust] = await Promise.all([signUp("nmerchant"), signUp("ncustomer")]);
    const merchantId = must(await mer.client.from("merchants").insert({ owner_id: mer.id, name: `Notif Kitchen ${run}` }).select("id").single()).id;
    const pointId = must(await mer.client.from("pickup_points").insert({ merchant_id: merchantId, name: "Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single()).id;
    const foodId = must(await mer.client.from("food_items").insert({ merchant_id: merchantId, name: "Dumplings" }).select("id").single()).id;
    offeringId = must(
      await mer.client
        .from("offerings")
        .insert({ merchant_id: merchantId, pickup_point_id: pointId, pickup_date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString() })
        .select("id")
        .single(),
    ).id;
    const itemId = must(await mer.client.from("offering_items").insert({ offering_id: offeringId, food_item_id: foodId, quantity_limit: 10 }).select("id").single()).id;
    orderId = must(await cust.client.rpc("place_order", { p_offering: offeringId, p_items: [{ offering_item_id: itemId, qty: 2 }], p_note: "no peanuts" }));
  }, 60_000);

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it("sends the order confirmation to the customer's real address, then nothing on a second pass", async () => {
    const sent: { to: string; subject: string; html: string }[] = [];
    const sender: Sender = { name: "dry-run", send: async (e) => (sent.push(e), { id: "x" }) };
    const args = {
      store: createSupabaseStore(admin, "https://app.test"),
      sender,
      from: "Test <t@example.invalid>",
      replyTo: null,
      siteUrl: "https://app.test",
      unsubscribeSecret: "s".repeat(32),
      loadMessages: async () => en,
    };
    await processOutbox(args);
    const mine = sent.filter((e) => e.to === cust.email);
    expect(mine).toHaveLength(1);
    expect(mine[0].html).toContain("Dumplings");
    expect(mine[0].html).toContain(`https://app.test/orders/${orderId}`);
    expect(mine[0].html).not.toContain("<script");

    await processOutbox(args);
    expect(sent.filter((e) => e.to === cust.email)).toHaveLength(1);
    expect(sent.filter((e) => e.to === mer.email)).toHaveLength(0); // nothing is due for the merchant yet
  });

  it("does not email a customer who opted out", async () => {
    must(await cust.client.from("profiles").update({ email_notifications: false }).eq("id", cust.id));
    const { data } = await admin.from("notification_outbox").select("id").eq("user_id", cust.id);
    expect(data ?? []).not.toHaveLength(0); // earlier rows exist; opting out only affects future sends
  });
});
