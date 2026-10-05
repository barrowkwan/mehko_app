import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
const NO = "m00001-000001";
const CENTRAL = "20000000-0000-0000-0000-000000000002";

beforeEach(async () => {
  db = await createDb();
}, 60_000);

// anonymous = the `anon` role with no signed-in user
const asAnon = async <T>(fn: () => Promise<T>) => {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
};
type Shared = { open: boolean; merchant: { name: string }; slots: Record<string, unknown>[]; foods: { name: string }[] } & Record<string, unknown>;
const shared = async (no = NO) => {
  const r = await asAnon(() => db.query<{ r: Shared | null }>("select get_shared_offering($1) as r", [no]));
  return r.rows[0].r;
};
const setSharing = (userId: string, pub: boolean, address = false, offering = IDS.meiOffering) =>
  asUser(db, userId, () => db.query("select set_offering_sharing($1, $2, $3)", [offering, pub, address]));

describe("get_shared_offering", () => {
  it("returns nothing for anyone until the merchant opts in, and nothing for an unknown number", async () => {
    expect(await shared()).toBeNull();
    expect(await shared("m00001-999999")).toBeNull();
    await setSharing(IDS.meiOwner, true);
    expect(await shared()).not.toBeNull();
    expect(await shared("m00001-999999")).toBeNull();
  });

  it("returns the whitelisted fields only: no coordinates, customers, orders, stock or instructions", async () => {
    await setSharing(IDS.meiOwner, true);
    const item = await itemId(db, IDS.meiOffering, IDS.porkFood);
    await asUser(db, IDS.customer, () => db.query("select place_order($1, $2::jsonb, 'allergic to nuts')", [IDS.meiOffering, JSON.stringify([{ offering_item_id: item, qty: 3 }])]));
    const r = (await shared())!;
    expect(Object.keys(r).sort()).toEqual(["cutoff_at", "foods", "merchant", "offering_no", "open", "slots"]);
    expect(Object.keys(r.merchant).sort()).toEqual(["description", "logo_path", "name", "translations", "website"]);
    expect(Object.keys(r.slots[0]).sort()).toEqual(["address", "id", "open", "pickup_date", "pickup_end", "pickup_start", "place", "timezone"]);
    expect(Object.keys(r.foods[0]).sort()).toEqual(["description", "image_path", "limit", "name", "price_cents", "translations"]);
    const text = JSON.stringify(r);
    for (const secret of ["\"lat\"", "\"lng\"", "-73.97", "allergic", "qr_token", "customer", "c1@example.com"]) expect(text).not.toContain(secret);
    expect(r.merchant.name).toBe("Mei's Dumplings");
    expect(r.foods.map((f) => f.name)).toContain("Pork dumplings");
    expect(r.open).toBe(true);
  });

  it("hides the street address unless the merchant allowed it", async () => {
    await setSharing(IDS.meiOwner, true, false);
    expect((await shared())!.slots[0].address).toBeNull();
    expect((await shared())!.slots[0].place).toBe("Riverside Park");
    await setSharing(IDS.meiOwner, true, true);
    expect((await shared())!.slots[0].address).toBe("100 River Rd");
  });

  it("does not show drafts, and shows a closed offering as closed", async () => {
    await setSharing(IDS.meiOwner, true);
    await db.query("update offerings set status = 'draft' where id = $1", [IDS.meiOffering]);
    expect(await shared()).toBeNull();
    await db.query("update offerings set status = 'closed' where id = $1", [IDS.meiOffering]);
    expect((await shared())!.open).toBe(false);
    await db.query("update offerings set status = 'published' where id = $1", [IDS.meiOffering]);
    await db.query("update offerings set cutoff_at = now() - interval '1 minute' where id = $1", [IDS.meiOffering]);
    expect((await shared())!.open).toBe(false); // past the cutoff: still shown, as closed
  });
});

describe("set_offering_sharing", () => {
  it("only the owner can change it", async () => {
    await expect(setSharing(IDS.luisOwner, true)).rejects.toThrow(/Offering not found/);
    await expect(setSharing(IDS.customer, true)).rejects.toThrow(/Offering not found/);
    expect(await shared()).toBeNull();
  });

  it("turning it off hides the page again, and 'show address' needs sharing on", async () => {
    await setSharing(IDS.meiOwner, true, true);
    await setSharing(IDS.meiOwner, false, true);
    expect(await shared()).toBeNull();
    const row = (await db.query<{ share_public: boolean; share_address: boolean }>("select share_public, share_address from offerings where id = $1", [IDS.meiOffering])).rows[0];
    expect(row).toEqual({ share_public: false, share_address: false });
  });

  it("applies to every pickup slot of the offering, and slots added later inherit it", async () => {
    const slot1 = (await asUser(db, IDS.meiOwner, () => db.query<{ s: string }>("select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00') as s", [IDS.meiOffering, CENTRAL]))).rows[0].s;
    await setSharing(IDS.meiOwner, true, true);
    const flags = async () => (await db.query<{ share_public: boolean; share_address: boolean }>("select share_public, share_address from offerings where offering_no = $1", [NO])).rows;
    expect(await flags()).toEqual([{ share_public: true, share_address: true }, { share_public: true, share_address: true }]);
    expect((await shared())!.slots).toHaveLength(2);
    const slot2 = (await asUser(db, IDS.meiOwner, () => db.query<{ s: string }>("select add_offering_slot($1, $2, current_date + 3, '15:00', '16:00') as s", [slot1, IDS.meiPoint]))).rows[0].s;
    expect((await db.query<{ share_public: boolean }>("select share_public from offerings where id = $1", [slot2])).rows[0].share_public).toBe(true);
  });

  it("does not leak one merchant's offering through another's number", async () => {
    await setSharing(IDS.luisOwner, true, false, IDS.luisOffering);
    expect((await shared("m00002-000001"))!.merchant.name).toBe("Luis Tacos");
    expect(await shared()).toBeNull(); // Mei's offering is still private
  });
});

describe("anonymous access is limited to that function", () => {
  it("cannot read offerings, merchants or orders directly", async () => {
    await setSharing(IDS.meiOwner, true);
    for (const table of ["offerings", "merchants", "orders", "pickup_points", "food_items"]) {
      const rows = await asAnon(() => db.query(`select * from ${table}`).then((r) => r.rows.length).catch(() => 0));
      expect(rows, table).toBe(0);
    }
  });
});
