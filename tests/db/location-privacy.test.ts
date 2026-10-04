import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createDb();
  const item = await itemId(db, IDS.meiOffering, IDS.porkFood);
  await asUser(db, IDS.customer, () =>
    db.query("select place_order($1, $2::jsonb)", [IDS.meiOffering, JSON.stringify([{ offering_item_id: item, qty: 1 }])]),
  );
  await db.query("insert into location_shares (offering_id, lat, lng, active, updated_at) values ($1, 40.8, -73.97, true, now())", [IDS.meiOffering]);
}, 60_000);

const seenBy = (userId: string) =>
  asUser(db, userId, async () => (await db.query("select lat, lng from location_shares where offering_id = $1", [IDS.meiOffering])).rows.length);
const age = (interval: string) => db.query(`update location_shares set updated_at = now() - interval '${interval}'`);

describe("customers only see a fresh live location", () => {
  it("shows a position written seconds ago to the customer with an order, not to anyone else", async () => {
    expect(await seenBy(IDS.customer)).toBe(1);
    expect(await seenBy(IDS.customer2)).toBe(0);
  });

  it("stops showing it after 2 minutes without an update, even though it is still marked active", async () => {
    await age("90 seconds");
    expect(await seenBy(IDS.customer)).toBe(1);
    await age("3 minutes");
    expect(await seenBy(IDS.customer)).toBe(0);
  });

  it("the merchant still sees their own row, and a stopped share is hidden at once", async () => {
    await age("3 minutes");
    expect(await seenBy(IDS.meiOwner)).toBe(1);
    await db.query("update location_shares set updated_at = now(), active = false");
    expect(await seenBy(IDS.customer)).toBe(0);
  });
});

describe("clear_stale_locations", () => {
  it("wipes coordinates older than 12 hours and keeps recent ones", async () => {
    await age("1 hour");
    expect((await db.query<{ n: number }>("select clear_stale_locations() as n")).rows[0].n).toBe(0);
    await age("13 hours");
    expect((await db.query<{ n: number }>("select clear_stale_locations() as n")).rows[0].n).toBe(1);
    const row = (await db.query<{ lat: number | null; lng: number | null; active: boolean }>("select lat, lng, active from location_shares")).rows[0];
    expect(row).toEqual({ lat: null, lng: null, active: false });
  });

  it("cannot be run by signed-in users", async () => {
    await expect(asUser(db, IDS.meiOwner, () => db.query("select clear_stale_locations()"))).rejects.toThrow(/permission denied/);
  });
});
