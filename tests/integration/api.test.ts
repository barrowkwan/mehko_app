// Runs against a live local Supabase (`supabase start`). Skipped unless SUPABASE_INTEGRATION=1.
// Users are created through the admin API with passwords (OAuth can't be driven from a test) and
// removed afterwards; everything else goes through the same PostgREST/RPC/Realtime paths as the app.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// Public local-development demo keys printed by `supabase start`.
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

async function signUp(name: string): Promise<{ id: string; client: Client }> {
  const email = `${name}-${run}@test.local`;
  const password = "test-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const ymd = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

describe.skipIf(!process.env.SUPABASE_INTEGRATION)("live Supabase", () => {
  let mer: { id: string; client: Client };
  let cust: { id: string; client: Client };
  let other: { id: string; client: Client };
  let merchantId: string;
  let pointId: string;
  let foodId: string;
  let offeringId: string;
  let offeringItemId: string;
  let orderId: string;

  beforeAll(async () => {
    [mer, cust, other] = await Promise.all([signUp("merchant"), signUp("customer"), signUp("other")]);

    merchantId = must(
      await mer.client.from("merchants").insert({ owner_id: mer.id, name: `Test Kitchen ${run}` }).select("id").single(),
    ).id;
    pointId = must(
      await mer.client
        .from("pickup_points")
        .insert({ merchant_id: merchantId, name: "Park", lat: 40.8, lng: -73.97, timezone: "UTC" })
        .select("id")
        .single(),
    ).id;
    foodId = must(
      await mer.client.from("food_items").insert({ merchant_id: merchantId, name: "Dumplings" }).select("id").single(),
    ).id;
    offeringId = must(
      await mer.client
        .from("offerings")
        .insert({
          merchant_id: merchantId,
          pickup_point_id: pointId,
          pickup_date: ymd(3),
          pickup_start: "17:00",
          pickup_end: "19:00",
          cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        })
        .select("id")
        .single(),
    ).id;
    offeringItemId = must(
      await mer.client
        .from("offering_items")
        .insert({ offering_id: offeringId, food_item_id: foodId, quantity_limit: 10 })
        .select("id")
        .single(),
    ).id;
  }, 60_000);

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it("signed-in customers can browse the published offering with its merchant and pickup point", async () => {
    const r = must(
      await cust.client
        .from("offerings")
        .select("id, merchant:merchants(name), pickup_point:pickup_points(name), offering_items(food_item:food_items(name))")
        .eq("id", offeringId)
        .single(),
    );
    expect(r.merchant?.name).toContain("Test Kitchen");
    expect(r.pickup_point?.name).toBe("Park");
    expect(r.offering_items[0].food_item?.name).toBe("Dumplings");
  });

  it("anonymous users cannot read merchants", async () => {
    const anon = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { data } = await anon.from("merchants").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("customer places and edits an order; stock reflects it", async () => {
    orderId = must(await cust.client.rpc("place_order", { p_offering: offeringId, p_items: [{ offering_item_id: offeringItemId, qty: 4 }] }));
    expect(orderId).toBeTruthy();
    must(await cust.client.rpc("update_order", { p_order: orderId, p_items: [{ offering_item_id: offeringItemId, qty: 6 }] }));
    const stock = must(await other.client.rpc("offering_stock", { p_offering: offeringId }));
    expect(stock).toEqual([{ offering_item_id: offeringItemId, remaining: 4 }]);
    const { error } = await other.client.rpc("place_order", { p_offering: offeringId, p_items: [{ offering_item_id: offeringItemId, qty: 5 }] });
    expect(error?.message).toMatch(/stock/);
  });

  it("isolates orders: other customer sees none, merchant sees theirs, nobody can write directly", async () => {
    expect(must(await other.client.from("orders").select("id"))).toHaveLength(0);
    expect(must(await mer.client.from("orders").select("id")).map((o) => o.id)).toContain(orderId);
    const { error } = await cust.client.from("orders").update({ status: "picked_up" }).eq("id", orderId);
    // RLS has no update policy: no rows are affected and status is unchanged.
    expect(error).toBeNull();
    const o = must(await cust.client.from("orders").select("status").eq("id", orderId).single());
    expect(o.status).toBe("placed");
  });

  it("merchant confirms pickup via QR token; other users cannot", async () => {
    const { qr_token } = must(await cust.client.from("orders").select("qr_token").eq("id", orderId).single());
    const bad = await other.client.rpc("confirm_pickup", { p_token: qr_token });
    expect(bad.error?.message).toMatch(/different merchant/);
    const ok = must(await mer.client.rpc("confirm_pickup", { p_token: qr_token }));
    expect(ok[0]).toMatchObject({ already_picked_up: false, customer_name: "customer" });
    const again = must(await mer.client.rpc("confirm_pickup", { p_token: qr_token }));
    expect(again[0].already_picked_up).toBe(true);
  });

  it("order_lines report is merchant-scoped", async () => {
    const lines = must(await mer.client.from("order_lines").select("food_name, qty, merchant_id"));
    expect(lines).toEqual([{ food_name: "Dumplings", qty: 6, merchant_id: merchantId }]);
    expect(must(await cust.client.from("order_lines").select("*").eq("merchant_id", merchantId))).toHaveLength(1); // their own order's line
    expect(must(await other.client.from("order_lines").select("*"))).toHaveLength(0);
  });

  it("streams live location over Realtime only to customers with an order, only on pickup day", async () => {
    // Pickup point is UTC, so "today" is today's UTC date; cutoff = start of that day.
    const today = ymd(0);
    const live = must(
      await mer.client
        .from("offerings")
        .insert({
          merchant_id: merchantId,
          pickup_point_id: pointId,
          pickup_date: today,
          pickup_start: "00:00",
          pickup_end: "23:59",
          cutoff_at: `${today}T00:00:00Z`,
        })
        .select("id")
        .single(),
    ).id;
    const item = must(
      await mer.client.from("offering_items").insert({ offering_id: live, food_item_id: foodId }).select("id").single(),
    ).id;
    // Cutoff is already past, so seed the order with the service role (bypasses RLS).
    must(await admin.from("orders").insert({ customer_id: cust.id, offering_id: live }).select("id").single());
    void item;

    // Not-pickup-day offering is rejected by RLS.
    const early = await mer.client.from("location_shares").upsert({ offering_id: offeringId, lat: 1, lng: 1, active: true });
    expect(early.error?.message).toMatch(/row-level security/);

    const received: { lat: number | null }[] = [];
    const channel = cust.client
      .channel(`loc-${run}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "location_shares", filter: `offering_id=eq.${live}` }, (p) =>
        received.push(p.new as { lat: number | null }),
      );
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
    });

    const otherReceived: unknown[] = [];
    const otherChannel = other.client
      .channel(`loc-other-${run}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "location_shares", filter: `offering_id=eq.${live}` }, (p) => otherReceived.push(p.new));
    await new Promise<void>((resolve) => otherChannel.subscribe((s) => s === "SUBSCRIBED" && resolve()));

    // Realtime wires up its change stream lazily after the first subscription, so an immediate first
    // update can be missed on a cold stack. The app sends updates continuously; mimic that here.
    for (let i = 0; i < 10 && !received.some((p) => p.lat === 40.81); i++) {
      must(await mer.client.from("location_shares").upsert({ offering_id: live, lat: 40.81, lng: -73.96, active: true }));
      await new Promise((r) => setTimeout(r, 1000));
    }

    expect(received.some((p) => p.lat === 40.81)).toBe(true);
    expect(otherReceived).toHaveLength(0);
    expect(must(await cust.client.from("location_shares").select("lat").eq("offering_id", live))).toHaveLength(1);
    expect(must(await other.client.from("location_shares").select("lat").eq("offering_id", live))).toHaveLength(0);

    await cust.client.removeChannel(channel);
    await other.client.removeChannel(otherChannel);
  }, 30_000);
  it("account deletion: blocked while customers have upcoming orders, then cascades via the real auth admin API", async () => {
    const m = await signUp("delmerchant");
    const c = await signUp("delcustomer");
    const mid = must(await m.client.from("merchants").insert({ owner_id: m.id, name: `Doomed ${run}` }).select("id").single()).id;
    const pid = must(
      await m.client.from("pickup_points").insert({ merchant_id: mid, name: "P", lat: 1, lng: 1, timezone: "UTC" }).select("id").single(),
    ).id;
    const fid = must(await m.client.from("food_items").insert({ merchant_id: mid, name: "F" }).select("id").single()).id;
    const oid = must(
      await m.client
        .from("offerings")
        .insert({
          merchant_id: mid,
          pickup_point_id: pid,
          pickup_date: ymd(3),
          pickup_start: "17:00",
          pickup_end: "19:00",
          cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        })
        .select("id")
        .single(),
    ).id;
    const oiid = must(await m.client.from("offering_items").insert({ offering_id: oid, food_item_id: fid }).select("id").single()).id;
    const orderId = must(await c.client.rpc("place_order", { p_offering: oid, p_items: [{ offering_item_id: oiid, qty: 1 }] }));

    // Blocked for the merchant while the customer's order is active; the customer is not blocked.
    expect(must(await m.client.rpc("account_deletion_blocker"))).toBe("merchant_active_orders");
    expect(must(await c.client.rpc("account_deletion_blocker"))).toBeNull();
    // Anonymous callers cannot use it.
    const anon = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    expect((await anon.rpc("account_deletion_blocker")).error).not.toBeNull();

    // Customer cancels -> merchant can delete.
    must(await c.client.rpc("cancel_order", { p_order: orderId }));
    expect(must(await m.client.rpc("account_deletion_blocker"))).toBeNull();

    // Real deletion through the auth service: the database cascade must succeed under its role.
    const del = await admin.auth.admin.deleteUser(m.id);
    expect(del.error).toBeNull();
    const rows = async (table: "merchants" | "offerings" | "pickup_points" | "food_items" | "orders" | "profiles", col: string, val: string) =>
      must(await admin.from(table).select("*", { count: "exact", head: false }).eq(col, val)).length;
    expect(await rows("merchants", "id", mid)).toBe(0);
    expect(await rows("offerings", "id", oid)).toBe(0);
    expect(await rows("pickup_points", "id", pid)).toBe(0);
    expect(await rows("food_items", "id", fid)).toBe(0);
    expect(await rows("orders", "id", orderId)).toBe(0);
    expect(await rows("profiles", "id", m.id)).toBe(0);
    // The customer account is untouched until they delete it too.
    expect(await rows("profiles", "id", c.id)).toBe(1);
    expect((await admin.auth.admin.deleteUser(c.id)).error).toBeNull();
    expect(await rows("profiles", "id", c.id)).toBe(0);
  }, 30_000);
  it("offering edit/duplicate/delete rules hold through the real API (RLS + triggers)", async () => {
    const m = await signUp("editmerchant");
    const c = await signUp("editcustomer");
    const mid = must(await m.client.from("merchants").insert({ owner_id: m.id, name: `Editor ${run}` }).select("id").single()).id;
    const pid = must(await m.client.from("pickup_points").insert({ merchant_id: mid, name: "P", lat: 1, lng: 1, timezone: "UTC" }).select("id").single()).id;
    const f1 = must(await m.client.from("food_items").insert({ merchant_id: mid, name: "A" }).select("id").single()).id;
    const f2 = must(await m.client.from("food_items").insert({ merchant_id: mid, name: "B" }).select("id").single()).id;
    const date = ymd(5);
    const oid = must(
      await m.client
        .from("offerings")
        .insert({ merchant_id: mid, pickup_point_id: pid, pickup_date: date, pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: "published" })
        .select("id")
        .single(),
    ).id;
    const oi1 = must(await m.client.from("offering_items").insert({ offering_id: oid, food_item_id: f1, quantity_limit: 10 }).select("id").single()).id;
    await m.client.from("offering_items").insert({ offering_id: oid, food_item_id: f2 }).select("id").single();
    const cutoff = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const upd = (over: Partial<{ date: string; end: string; items: { food_item_id: string; quantity_limit: number | null }[] }>) =>
      m.client.rpc("update_offering", {
        p_offering: oid, p_pickup_point: pid, p_date: over.date ?? date, p_start: "17:00", p_end: over.end ?? "19:00", p_cutoff: cutoff,
        p_items: over.items ?? [{ food_item_id: f1, quantity_limit: 10 }, { food_item_id: f2, quantity_limit: null }],
      });

    // No orders yet: everything is editable, including moving the date.
    expect((await upd({ date: ymd(6) })).error).toBeNull();
    expect((await upd({ date })).error).toBeNull();

    // A customer orders 4 of item A.
    const orderId = must(await c.client.rpc("place_order", { p_offering: oid, p_items: [{ offering_item_id: oi1, qty: 4 }] }));

    // Delete is refused, and the order survives.
    const del = await m.client.from("offerings").delete().eq("id", oid);
    expect(del.error?.message).toMatch(/Offering has orders/);
    expect(must(await c.client.from("orders").select("id").eq("id", orderId))).toHaveLength(1);

    // The date is locked; times can still change; a limit below the ordered amount and removing the item are refused.
    expect((await upd({ date: ymd(6) })).error?.message).toMatch(/Cannot move an offering that has orders/);
    expect((await upd({ end: "20:00" })).error).toBeNull();
    expect((await upd({ items: [{ food_item_id: f1, quantity_limit: 3 }, { food_item_id: f2, quantity_limit: null }] })).error?.message).toMatch(/below the quantity already ordered/);
    expect((await upd({ items: [{ food_item_id: f2, quantity_limit: null }] })).error?.message).toMatch(/Item has orders/);
    // ...and a rejected change left the data as it was.
    const after = must(await m.client.from("offering_items").select("food_item_id, quantity_limit").eq("offering_id", oid));
    expect(after).toHaveLength(2);

    // Non-owners get "not found" for both RPCs.
    const other = await signUp("editother");
    expect((await other.client.rpc("update_offering", { p_offering: oid, p_pickup_point: pid, p_date: date, p_start: "17:00", p_end: "19:00", p_cutoff: cutoff, p_items: [{ food_item_id: f1, quantity_limit: 1 }] })).error?.message).toMatch(/Offering not found/);
    expect((await other.client.rpc("duplicate_offering", { p_offering: oid, p_new_date: ymd(12) })).error?.message).toMatch(/Offering not found/);

    // Duplicate: a draft the customer cannot see, with the same items/limits and no orders.
    const copyId = must(await m.client.rpc("duplicate_offering", { p_offering: oid, p_new_date: ymd(12) }));
    const copy = must(await m.client.from("offerings").select("status, pickup_point_id, pickup_date, offering_items(food_item_id, quantity_limit)").eq("id", copyId).single());
    expect(copy).toMatchObject({ status: "draft", pickup_point_id: pid, pickup_date: ymd(12) });
    expect(copy.offering_items).toHaveLength(2);
    expect(must(await c.client.from("offerings").select("id").eq("id", copyId))).toHaveLength(0);
    expect((await m.client.rpc("duplicate_offering", { p_offering: oid, p_new_date: ymd(-3) })).error?.message).toMatch(/in the past/);

    // After the customer cancels, the original can be deleted (the cancelled order goes with it); the draft copy too.
    must(await c.client.rpc("cancel_order", { p_order: orderId }));
    expect((await m.client.from("offerings").delete().eq("id", oid)).error).toBeNull();
    expect((await m.client.from("offerings").delete().eq("id", copyId)).error).toBeNull();
    expect(must(await admin.from("orders").select("id").eq("id", orderId))).toHaveLength(0);
  }, 40_000);
});
