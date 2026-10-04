import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
let porkItem: string;

beforeEach(async () => {
  db = await createDb();
  porkItem = await itemId(db, IDS.meiOffering, IDS.porkFood);
}, 60_000);

const placeOrder = (offering: string, item: string, qty = 1) =>
  db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [offering, JSON.stringify([{ offering_item_id: item, qty }])]);

const blocker = (userId: string) =>
  asUser(db, userId, async () => (await db.query<{ b: string | null }>("select account_deletion_blocker() as b")).rows[0].b);

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: string }>(`select count(*)::int as n from ${sql}`, params)).rows[0].n);

describe("account_deletion_blocker()", () => {
  it("is null for users who own nothing", async () => {
    expect(await blocker(IDS.customer)).toBeNull();
    expect(await blocker(IDS.luisOwner)).toBeNull(); // merchant with no orders
  });

  it("blocks a merchant who has an upcoming active order from another customer", async () => {
    await asUser(db, IDS.customer, () => placeOrder(IDS.meiOffering, porkItem));
    expect(await blocker(IDS.meiOwner)).toBe("merchant_active_orders");
    expect(await blocker(IDS.customer)).toBeNull(); // the customer themself is not blocked
  });

  it("unblocks once the order is cancelled or picked up", async () => {
    const id = await asUser(db, IDS.customer, async () => (await placeOrder(IDS.meiOffering, porkItem)).rows[0].place_order);
    await asUser(db, IDS.customer, () => db.query("select cancel_order($1)", [id]));
    expect(await blocker(IDS.meiOwner)).toBeNull();

    const id2 = await asUser(db, IDS.customer2, async () => (await placeOrder(IDS.meiOffering, porkItem)).rows[0].place_order);
    expect(await blocker(IDS.meiOwner)).toBe("merchant_active_orders");
    await db.query("update orders set status = 'picked_up' where id = $1", [id2]);
    expect(await blocker(IDS.meiOwner)).toBeNull();
  });

  it("ignores orders on past offerings", async () => {
    await asUser(db, IDS.customer, () => placeOrder(IDS.meiOffering, porkItem));
    // Simulate time passing: moving an offering that has orders is (rightly) forbidden, so bypass triggers for this setup only.
    await db.exec("set session_replication_role = replica");
    await db.exec(`update offerings set pickup_date = current_date - 10, cutoff_at = now() - interval '11 days' where id = '${IDS.meiOffering}'`);
    await db.exec("set session_replication_role = origin");
    expect(await blocker(IDS.meiOwner)).toBeNull();
  });

  it("is not callable anonymously", async () => {
    await db.exec("set role anon");
    await expect(db.query("select account_deletion_blocker()")).rejects.toThrow(/permission denied/i);
    await db.exec("reset role");
  });
});

describe("deleting an account (auth.users row) cascades cleanly", () => {
  it("removes a merchant with its offerings and other customers' orders, but not those customers", async () => {
    await asUser(db, IDS.customer, () => placeOrder(IDS.meiOffering, porkItem));
    await db.exec(`update orders set status = 'picked_up'`); // allowed deletion case: nothing active
    expect(await count("orders")).toBe(1);

    await db.query("delete from auth.users where id = $1", [IDS.meiOwner]);

    expect(await count("merchants where id = $1", [IDS.meiMerchant])).toBe(0);
    expect(await count("offerings where merchant_id = $1", [IDS.meiMerchant])).toBe(0);
    expect(await count("pickup_points where merchant_id = $1", [IDS.meiMerchant])).toBe(0);
    expect(await count("food_items where merchant_id = $1", [IDS.meiMerchant])).toBe(0);
    expect(await count("orders")).toBe(0);
    expect(await count("order_items")).toBe(0);
    expect(await count("profiles where id = $1", [IDS.meiOwner])).toBe(0);
    // other people and merchants are untouched
    expect(await count("profiles where id in ($1, $2)", [IDS.customer, IDS.luisOwner])).toBe(2);
    expect(await count("merchants where id = '10000000-0000-0000-0000-000000000002'")).toBe(1);
  });

  it("removes a customer's orders and profile but keeps the merchant's offering", async () => {
    await asUser(db, IDS.customer, () => placeOrder(IDS.meiOffering, porkItem, 3));
    await db.query("delete from auth.users where id = $1", [IDS.customer]);
    expect(await count("orders where customer_id = $1", [IDS.customer])).toBe(0);
    expect(await count("order_items")).toBe(0);
    expect(await count("profiles where id = $1", [IDS.customer])).toBe(0);
    expect(await count("offerings where id = $1", [IDS.meiOffering])).toBe(1);
  });

  it("also removes live-location rows and weather snapshots of the merchant's offerings", async () => {
    await db.exec(`insert into location_shares (offering_id, lat, lng, active) values ('${IDS.meiOffering}', 1, 1, true)`);
    await db.exec(`insert into offering_context (offering_id, weather_bucket) values ('${IDS.meiOffering}', 'clear')`);
    await db.query("delete from auth.users where id = $1", [IDS.meiOwner]);
    expect(await count("location_shares")).toBe(0);
    expect(await count("offering_context")).toBe(0);
  });
});
