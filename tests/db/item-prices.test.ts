import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
const PORK = IDS.porkFood;
const VEGGIE = "30000000-0000-0000-0000-000000000002";
const CENTRAL = "20000000-0000-0000-0000-000000000002";

beforeEach(async () => {
  db = await createDb();
}, 60_000);

const setPrice = (offering: string, food: string, cents: number | null) =>
  db.query("update offering_items set price_cents = $3 where offering_id = $1 and food_item_id = $2", [offering, food, cents]);
const lines = async (orderId: string) =>
  (await db.query<{ food_item_id: string; qty: number; unit_price_cents: number | null }>(
    `select oi2.food_item_id, oi.qty, oi.unit_price_cents from order_items oi join offering_items oi2 on oi2.id = oi.offering_item_id where oi.order_id = $1 order by oi2.food_item_id`, [orderId])).rows;
const place = async (userId: string, offering: string, items: [string, number][]) => {
  const payload = JSON.stringify(await Promise.all(items.map(async ([food, qty]) => ({ offering_item_id: await itemId(db, offering, food), qty }))));
  return (await asUser(db, userId, () => db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [offering, payload]))).rows[0].place_order;
};
const update = async (userId: string, order: string, offering: string, items: [string, number][]) => {
  const payload = JSON.stringify(await Promise.all(items.map(async ([food, qty]) => ({ offering_item_id: await itemId(db, offering, food), qty }))));
  await asUser(db, userId, () => db.query("select update_order($1, $2::jsonb)", [order, payload]));
};

describe("prices on offering items", () => {
  it("are optional, in whole cents, and not negative", async () => {
    await setPrice(IDS.meiOffering, PORK, 1250);
    await setPrice(IDS.meiOffering, PORK, null);
    await expect(setPrice(IDS.meiOffering, PORK, -1)).rejects.toThrow(/price_cents/);
    await expect(setPrice(IDS.meiOffering, PORK, 10_000_01)).rejects.toThrow(/price_cents/);
  });

  it("belong to the offering: the same food can cost different amounts in different offerings", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    const copy = (await asUser(db, IDS.meiOwner, () => db.query<{ id: string }>("select duplicate_offering($1, current_date + 9) as id", [IDS.meiOffering]))).rows[0].id;
    // the copy starts with the same price, and changing it does not touch the original
    expect((await db.query<{ price_cents: number }>("select price_cents from offering_items where offering_id = $1 and food_item_id = $2", [copy, PORK])).rows[0].price_cents).toBe(1200);
    await setPrice(copy, PORK, 1500);
    expect((await db.query<{ price_cents: number }>("select price_cents from offering_items where offering_id = $1 and food_item_id = $2", [IDS.meiOffering, PORK])).rows[0].price_cents).toBe(1200);
  });

  it("food items themselves carry no price in the app: the old unused column stays empty", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int as n from food_items where price_cents is not null");
    expect(r.rows[0].n).toBe(0);
  });

  it("slots added later and update_offering keep prices in step across the offering", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    const slot = (await asUser(db, IDS.meiOwner, () => db.query<{ s: string }>("select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00') as s", [IDS.meiOffering, CENTRAL]))).rows[0].s;
    expect((await db.query<{ price_cents: number }>("select price_cents from offering_items where offering_id = $1 and food_item_id = $2", [slot, PORK])).rows[0].price_cents).toBe(1200);

    await asUser(db, IDS.meiOwner, () =>
      db.query(
        `select update_offering($1, $2, current_date + 3, '17:00', '19:00', now() + interval '1 day',
                 '[{"food_item_id":"${PORK}","quantity_limit":40,"price_cents":1350},{"food_item_id":"${VEGGIE}","quantity_limit":20,"price_cents":null}]'::jsonb)`,
        [IDS.meiOffering, IDS.meiPoint],
      ),
    );
    const prices = (await db.query<{ food_item_id: string; price_cents: number | null }>("select food_item_id, price_cents from offering_items where offering_id = $1 order by food_item_id", [slot])).rows;
    expect(prices).toEqual([{ food_item_id: PORK, price_cents: 1350 }, { food_item_id: VEGGIE, price_cents: null }]);
  });
});

describe("order line prices", () => {
  it("are remembered when the order is placed", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    await setPrice(IDS.meiOffering, VEGGIE, 900);
    const id = await place(IDS.customer, IDS.meiOffering, [[PORK, 2], [VEGGIE, 1]]);
    expect(await lines(id)).toEqual([
      { food_item_id: PORK, qty: 2, unit_price_cents: 1200 },
      { food_item_id: VEGGIE, qty: 1, unit_price_cents: 900 },
    ]);
  });

  it("do not change when the merchant later changes a price, even if the customer edits the quantity", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    const id = await place(IDS.customer, IDS.meiOffering, [[PORK, 2]]);
    await setPrice(IDS.meiOffering, PORK, 2000); // price goes up after the order
    expect((await lines(id))[0].unit_price_cents).toBe(1200);
    await update(IDS.customer, id, IDS.meiOffering, [[PORK, 3]]); // edit: the line keeps the price it was ordered at
    expect(await lines(id)).toEqual([{ food_item_id: PORK, qty: 3, unit_price_cents: 1200 }]);
  });

  it("a food added by editing the order gets the current price; a removed-then-readded one is repriced", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    await setPrice(IDS.meiOffering, VEGGIE, 900);
    const id = await place(IDS.customer, IDS.meiOffering, [[PORK, 1]]);
    await setPrice(IDS.meiOffering, VEGGIE, 1000);
    await update(IDS.customer, id, IDS.meiOffering, [[PORK, 1], [VEGGIE, 2]]);
    expect(await lines(id)).toEqual([
      { food_item_id: PORK, qty: 1, unit_price_cents: 1200 },
      { food_item_id: VEGGIE, qty: 2, unit_price_cents: 1000 },
    ]);
  });

  it("are null for items without a price, and an order can mix priced and unpriced items", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    const id = await place(IDS.customer, IDS.meiOffering, [[PORK, 1], [VEGGIE, 1]]);
    expect((await lines(id)).map((l) => l.unit_price_cents)).toEqual([1200, null]);
  });

  it("keep their price when the order is moved to another pickup slot", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    const slot = (await asUser(db, IDS.meiOwner, () => db.query<{ s: string }>("select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00') as s", [IDS.meiOffering, CENTRAL]))).rows[0].s;
    const id = await place(IDS.customer, IDS.meiOffering, [[PORK, 2]]);
    await asUser(db, IDS.customer, () => db.query("select change_order_slot($1, $2)", [id, slot]));
    expect(await lines(id)).toEqual([{ food_item_id: PORK, qty: 2, unit_price_cents: 1200 }]);
  });

  it("are visible to the customer and the merchant, and in the public share data", async () => {
    await setPrice(IDS.meiOffering, PORK, 1200);
    const id = await place(IDS.customer, IDS.meiOffering, [[PORK, 1]]);
    for (const user of [IDS.customer, IDS.meiOwner]) {
      const r = await asUser(db, user, () => db.query<{ unit_price_cents: number }>("select unit_price_cents from order_items where order_id = $1", [id]));
      expect(r.rows[0].unit_price_cents).toBe(1200);
    }
    await asUser(db, IDS.meiOwner, () => db.query("select set_offering_sharing($1, true, false)", [IDS.meiOffering]));
    await db.exec("select set_config('request.jwt.claim.sub', '', false); set role anon;");
    const shared = (await db.query<{ r: { foods: { name: string; price_cents: number | null }[] } }>("select get_shared_offering('m00001-000001') as r")).rows[0].r;
    await db.exec("reset role");
    expect(shared.foods.find((f) => f.name === "Pork dumplings")?.price_cents).toBe(1200);
  });
});
