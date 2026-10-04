import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

const POINT_2 = "20000000-0000-0000-0000-000000000002"; // Mei's second pickup point
const VEGGIE = "30000000-0000-0000-0000-000000000002";

let db: PGlite;
let porkItem: string;
let veggieItem: string;

beforeEach(async () => {
  db = await createDb();
  porkItem = await itemId(db, IDS.meiOffering, IDS.porkFood);
  veggieItem = await itemId(db, IDS.meiOffering, VEGGIE);
}, 60_000);

const order = (userId: string, item: string, qty = 1) =>
  asUser(db, userId, async () => (await db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [IDS.meiOffering, JSON.stringify([{ offering_item_id: item, qty }])])).rows[0].place_order);

const asMei = <T>(fn: () => Promise<T>) => asUser(db, IDS.meiOwner, fn);
const exec = (sql: string, params: unknown[] = []) => db.query(sql, params);
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const count = async (sql: string, params: unknown[] = []) => Number((await one<{ n: string }>(`select count(*)::int as n from ${sql}`, params)).n);

describe("deleting an offering", () => {
  it("is rejected while it has active or picked-up orders (customers' orders must not vanish)", async () => {
    const id = await order(IDS.customer, porkItem);
    await asMei(async () => {
      await expect(exec("delete from offerings where id = $1", [IDS.meiOffering])).rejects.toThrow(/Offering has orders/);
    });
    expect(await count("orders where id = $1", [id])).toBe(1);
    await db.query("update orders set status = 'picked_up' where id = $1", [id]);
    await asMei(async () => {
      await expect(exec("delete from offerings where id = $1", [IDS.meiOffering])).rejects.toThrow(/Offering has orders/);
    });
  });

  it("works when there are no orders, or only cancelled ones (which go with it)", async () => {
    const id = await order(IDS.customer, porkItem);
    await asUser(db, IDS.customer, () => exec("select cancel_order($1)", [id]));
    await asMei(() => exec("delete from offerings where id = $1", [IDS.meiOffering]));
    expect(await count("offerings where id = $1", [IDS.meiOffering])).toBe(0);
    expect(await count("orders")).toBe(0);
    expect(await count("order_items")).toBe(0);
  });

  it("still lets account deletion remove a merchant that has orders (it clears orders first)", async () => {
    await order(IDS.customer, porkItem);
    await exec("delete from auth.users where id = $1", [IDS.meiOwner]);
    expect(await count("offerings where merchant_id = $1", [IDS.meiMerchant])).toBe(0);
    expect(await count("orders")).toBe(0);
  });
});

describe("editing an offering's schedule", () => {
  it("allows moving it while nobody has ordered", async () => {
    await asMei(() => exec("update offerings set pickup_point_id = $2, pickup_date = pickup_date + 1 where id = $1", [IDS.meiOffering, POINT_2]));
    expect((await one<{ pickup_point_id: string }>("select pickup_point_id from offerings where id = $1", [IDS.meiOffering])).pickup_point_id).toBe(POINT_2);
  });

  it("locks pickup point and date once there is an active order, but allows times and cutoff", async () => {
    await order(IDS.customer, porkItem);
    await asMei(async () => {
      await expect(exec("update offerings set pickup_date = pickup_date + 1 where id = $1", [IDS.meiOffering])).rejects.toThrow(/Cannot move an offering that has orders/);
      await expect(exec("update offerings set pickup_point_id = $2 where id = $1", [IDS.meiOffering, POINT_2])).rejects.toThrow(/Cannot move an offering that has orders/);
      await exec("update offerings set pickup_end = '21:00', cutoff_at = cutoff_at - interval '1 hour' where id = $1", [IDS.meiOffering]);
    });
    expect((await one<{ e: string }>("select pickup_end::text as e from offerings where id = $1", [IDS.meiOffering])).e).toMatch(/^21:00/);
  });

  it("unlocks again after the order is cancelled", async () => {
    const id = await order(IDS.customer, porkItem);
    await asUser(db, IDS.customer, () => exec("select cancel_order($1)", [id]));
    await asMei(() => exec("update offerings set pickup_date = pickup_date + 2 where id = $1", [IDS.meiOffering]));
  });

  it("makes past offerings read-only for the schedule, while status can still change", async () => {
    await exec(`update offerings set pickup_date = current_date - 5, cutoff_at = now() - interval '6 days' where id = '${IDS.meiOffering}'`);
    await asMei(async () => {
      await expect(exec("update offerings set pickup_start = '09:00' where id = $1", [IDS.meiOffering])).rejects.toThrow(/Past offerings cannot be edited/);
      await exec("update offerings set status = 'closed' where id = $1", [IDS.meiOffering]);
    });
  });

  it("keeps the cutoff-before-pickup rule on edits", async () => {
    await asMei(async () => {
      await expect(exec("update offerings set cutoff_at = now() + interval '90 days' where id = $1", [IDS.meiOffering])).rejects.toThrow(/Cutoff must be before the pickup start/);
    });
  });
});

describe("editing offering items", () => {
  it("blocks removing an item that has an active order, and cleans up when only cancelled orders have it", async () => {
    const id = await order(IDS.customer, porkItem, 2);
    await asMei(async () => {
      await expect(exec("delete from offering_items where id = $1", [porkItem])).rejects.toThrow(/Item has orders/);
    });
    await asUser(db, IDS.customer, () => exec("select cancel_order($1)", [id]));
    await asMei(() => exec("delete from offering_items where id = $1", [porkItem]));
    expect(await count("offering_items where id = $1", [porkItem])).toBe(0);
    expect(await count("order_items where offering_item_id = $1", [porkItem])).toBe(0);
  });

  it("blocks lowering a limit below what is already ordered, allows raising or removing it", async () => {
    await order(IDS.customer, porkItem, 5);
    await order(IDS.customer2, porkItem, 3);
    await asMei(async () => {
      await expect(exec("update offering_items set quantity_limit = 7 where id = $1", [porkItem])).rejects.toThrow(/below the quantity already ordered/);
      await exec("update offering_items set quantity_limit = 8 where id = $1", [porkItem]); // exactly the ordered amount
      await exec("update offering_items set quantity_limit = 100 where id = $1", [porkItem]);
      await exec("update offering_items set quantity_limit = null where id = $1", [porkItem]);
    });
  });

  it("does not allow re-pointing an item to another food or offering", async () => {
    await asMei(async () => {
      await expect(exec("update offering_items set food_item_id = $2 where id = $1", [porkItem, "30000000-0000-0000-0000-000000000002"])).rejects.toThrow(/cannot be changed/i);
    });
  });
});

describe("update_offering()", () => {
  const call = (offering: string, p: { point?: string; date?: string; start?: string; end?: string; cutoff?: string; items: { food_item_id: string; quantity_limit: number | null }[] }) =>
    exec("select update_offering($1, $2, $3::date, $4::time, $5::time, $6::timestamptz, $7::jsonb)", [
      offering,
      p.point ?? IDS.meiPoint,
      p.date,
      p.start ?? "16:00",
      p.end ?? "20:00",
      p.cutoff,
      JSON.stringify(p.items),
    ]);

  const current = () => one<{ d: string; c: string }>("select pickup_date::text as d, cutoff_at::text as c from offerings where id = $1", [IDS.meiOffering]);

  it("changes schedule and replaces items in one go (add, change limit, remove)", async () => {
    const cur = await current();
    await asMei(() =>
      call(IDS.meiOffering, { date: cur.d, cutoff: cur.c, start: "16:30", end: "19:30", items: [{ food_item_id: IDS.porkFood, quantity_limit: 25 }] }),
    );
    expect((await one<{ l: number }>("select quantity_limit as l from offering_items where id = $1", [porkItem])).l).toBe(25);
    expect(await count("offering_items where offering_id = $1", [IDS.meiOffering])).toBe(1); // veggie removed
    expect(await count("offering_items where id = $1", [veggieItem])).toBe(0);
    expect((await one<{ s: string }>("select pickup_start::text as s from offerings where id = $1", [IDS.meiOffering])).s).toMatch(/^16:30/);
  });

  it("is all-or-nothing: a rejected change leaves everything as it was", async () => {
    await order(IDS.customer, veggieItem, 2);
    const cur = await current();
    await asMei(async () => {
      await expect(
        call(IDS.meiOffering, { date: cur.d, cutoff: cur.c, start: "11:00", items: [{ food_item_id: IDS.porkFood, quantity_limit: 10 }] }), // drops the ordered veggie item
      ).rejects.toThrow(/Item has orders/);
    });
    expect((await one<{ s: string }>("select pickup_start::text as s from offerings where id = $1", [IDS.meiOffering])).s).toMatch(/^17:00/);
    expect(await count("offering_items where offering_id = $1", [IDS.meiOffering])).toBe(2);
    expect((await one<{ l: number }>("select quantity_limit as l from offering_items where id = $1", [porkItem])).l).toBe(40);
  });

  it("rejects an empty item list, items from another merchant's menu, and non-owners", async () => {
    const cur = await current();
    await asMei(async () => {
      await expect(call(IDS.meiOffering, { date: cur.d, cutoff: cur.c, items: [] })).rejects.toThrow(/at least one item/i);
      await expect(
        call(IDS.meiOffering, { date: cur.d, cutoff: cur.c, items: [{ food_item_id: "30000000-0000-0000-0000-000000000003", quantity_limit: null }] }),
      ).rejects.toThrow(/row-level security|violates/i);
    });
    await asUser(db, IDS.luisOwner, async () => {
      await expect(call(IDS.meiOffering, { date: cur.d, cutoff: cur.c, items: [{ food_item_id: IDS.porkFood, quantity_limit: 1 }] })).rejects.toThrow(/Offering not found/);
    });
  });
});

describe("duplicate_offering()", () => {
  const dup = (id: string, date: string) => asMei(async () => (await db.query<{ duplicate_offering: string }>("select duplicate_offering($1, $2::date)", [id, date])).rows[0].duplicate_offering);

  it("creates a draft copy with the same pickup point, times and items/limits", async () => {
    const newId = await dup(IDS.meiOffering, new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10));
    const o = await one<{ status: string; pickup_point_id: string; pickup_start: string; pickup_end: string; merchant_id: string }>(
      "select status, pickup_point_id, pickup_start::text, pickup_end::text, merchant_id from offerings where id = $1",
      [newId],
    );
    expect(o).toMatchObject({ status: "draft", pickup_point_id: IDS.meiPoint, merchant_id: IDS.meiMerchant });
    expect(o.pickup_start).toMatch(/^17:00/);
    const items = (await db.query<{ f: string; l: number | null }>("select food_item_id as f, quantity_limit as l from offering_items where offering_id = $1 order by quantity_limit", [newId])).rows;
    expect(items).toEqual([{ f: VEGGIE, l: 20 }, { f: IDS.porkFood, l: 40 }]);
    expect(await count("orders where offering_id = $1", [newId])).toBe(0); // orders are never copied
  });

  it("keeps the wall-clock lead before pickup across a daylight-saving change", async () => {
    // US daylight-saving time ends Sun 2036-11-02. Original: Fri 2036-10-24 17:00 New York, cutoff Thu 12:00 (29 h earlier).
    await exec(
      `update offerings set pickup_date = '2036-10-24', pickup_start = '17:00', pickup_end = '19:00',
              cutoff_at = ('2036-10-23 12:00')::timestamp at time zone 'America/New_York' where id = '${IDS.meiOffering}'`,
    );
    // Copy to Sun 2036-11-02 17:00: the cutoff must still be "the previous day at 12:00 local" (Sat 2036-11-01 12:00 EDT),
    // even though the real elapsed time is 1 hour longer because the clocks change in between.
    const newId = await dup(IDS.meiOffering, "2036-11-02");
    const c = await one<{ local: string; utc: string }>(
      "select (cutoff_at at time zone 'America/New_York')::text as local, (cutoff_at at time zone 'UTC')::text as utc from offerings where id = $1",
      [newId],
    );
    expect(c.local).toBe("2036-11-01 12:00:00");
    expect(c.utc).toBe("2036-11-01 16:00:00");
  });

  it("skips archived foods and rejects past dates and non-owners", async () => {
    await exec(`update food_items set active = false where id = '${VEGGIE}'`);
    const newId = await dup(IDS.meiOffering, new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10));
    expect(await count("offering_items where offering_id = $1", [newId])).toBe(1);
    await asMei(async () => {
      await expect(exec("select duplicate_offering($1, current_date - 3)", [IDS.meiOffering])).rejects.toThrow(/in the past/);
    });
    await asUser(db, IDS.luisOwner, async () => {
      await expect(exec("select duplicate_offering($1, current_date + 3)", [IDS.meiOffering])).rejects.toThrow(/Offering not found/);
    });
  });

  it("is not visible to customers until published", async () => {
    const newId = await dup(IDS.meiOffering, new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10));
    await asUser(db, IDS.customer, async () => {
      expect(await count("offerings where id = $1", [newId])).toBe(0);
    });
  });
});
