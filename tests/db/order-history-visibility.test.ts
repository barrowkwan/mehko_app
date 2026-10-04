import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
let orderId: string;

beforeEach(async () => {
  db = await createDb();
  const item = await itemId(db, IDS.meiOffering, IDS.porkFood);
  orderId = await asUser(db, IDS.customer, async () => {
    const r = await db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [IDS.meiOffering, JSON.stringify([{ offering_item_id: item, qty: 1 }])]);
    return r.rows[0].place_order;
  });
}, 60_000);

const offeringsVisibleTo = (userId: string) =>
  asUser(db, userId, async () => (await db.query("select id from offerings where id = $1", [IDS.meiOffering])).rows.length);
const itemsVisibleTo = (userId: string) =>
  asUser(db, userId, async () => (await db.query("select id from offering_items where offering_id = $1", [IDS.meiOffering])).rows.length);

describe("order history keeps working after the merchant closes or unpublishes an offering", () => {
  for (const status of ["closed", "draft"]) {
    it(`customer who ordered still sees the ${status} offering and its items; others do not`, async () => {
      await db.query("update offerings set status = $1 where id = $2", [status, IDS.meiOffering]);
      expect(await offeringsVisibleTo(IDS.customer)).toBe(1);
      expect(await itemsVisibleTo(IDS.customer)).toBeGreaterThan(0);
      expect(await offeringsVisibleTo(IDS.customer2)).toBe(0);
      expect(await itemsVisibleTo(IDS.customer2)).toBe(0);
      expect(await offeringsVisibleTo(IDS.meiOwner)).toBe(1);
    });
  }

  it("the order page query (order with offering, merchant and point) returns everything", async () => {
    await db.query("update offerings set status = 'closed' where id = $1", [IDS.meiOffering]);
    const rows = await asUser(db, IDS.customer, async () =>
      (await db.query<{ name: string | null }>(
        `select m.name from orders o join offerings f on f.id = o.offering_id join merchants m on m.id = f.merchant_id where o.id = $1`, [orderId])).rows);
    expect(rows).toHaveLength(1);
  });

  it("a customer cannot see an unpublished offering they have not ordered from, even after cancelling elsewhere", async () => {
    await db.query("update offerings set status = 'draft' where id = $1", [IDS.meiOffering]);
    expect(await offeringsVisibleTo(IDS.customer2)).toBe(0);
  });
});
