import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

const CENTRAL = "20000000-0000-0000-0000-000000000002"; // Mei's second pickup point
const LUIS_POINT = "20000000-0000-0000-0000-000000000003";
const PORK = IDS.porkFood;
const VEGGIE = "30000000-0000-0000-0000-000000000002";

let db: PGlite;
let slotB: string;

const addSlot = (userId: string, offering = IDS.meiOffering, point = CENTRAL, daysAhead = 3) =>
  asUser(db, userId, async () => {
    const r = await db.query<{ add_offering_slot: string }>(
      `select add_offering_slot($1, $2, current_date + $3::int, '12:00', '13:00')`,
      [offering, point, daysAhead],
    );
    return r.rows[0].add_offering_slot;
  });

const order = (userId: string, offering: string, qty: number, food = PORK) =>
  asUser(db, userId, async () => {
    const item = await itemId(db, offering, food);
    const r = await db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [offering, JSON.stringify([{ offering_item_id: item, qty }])]);
    return r.rows[0].place_order;
  });

const remaining = (userId: string, offering: string, food = PORK) =>
  asUser(db, userId, async () => {
    const item = await itemId(db, offering, food);
    const r = await db.query<{ remaining: number }>("select remaining from offering_stock($1) where offering_item_id = $2", [offering, item]);
    return r.rows[0]?.remaining;
  });

beforeEach(async () => {
  db = await createDb();
  slotB = await addSlot(IDS.meiOwner);
}, 60_000);

describe("add_offering_slot", () => {
  it("creates a sibling at the new point/date/time that shares the group, cutoff, status and foods with limits", async () => {
    const rows = (await db.query<Record<string, unknown>>(
      `select id, group_id, pickup_point_id, pickup_start::text as pickup_start, cutoff_at, status from offerings where id in ($1, $2) order by pickup_start`,
      [IDS.meiOffering, slotB],
    )).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].group_id).toBeTruthy();
    expect(rows[0].group_id).toBe(rows[1].group_id);
    const a = rows.find((r) => r.id === IDS.meiOffering)!;
    const b = rows.find((r) => r.id === slotB)!;
    expect(b.pickup_point_id).toBe(CENTRAL);
    expect(b.pickup_start).toBe("12:00:00");
    expect(new Date(b.cutoff_at as string).getTime()).toBe(new Date(a.cutoff_at as string).getTime());
    const items = (await db.query<{ food_item_id: string; quantity_limit: number }>("select food_item_id, quantity_limit from offering_items where offering_id = $1 order by quantity_limit", [slotB])).rows;
    expect(items.map((i) => i.quantity_limit)).toEqual([20, 40]);
  });

  it("allows the same pickup point again at another time on the same date", async () => {
    const later = await asUser(db, IDS.meiOwner, async () =>
      (await db.query<{ id: string }>(`select add_offering_slot($1, $2, current_date + 3, '19:30', '20:30') as id`, [IDS.meiOffering, IDS.meiPoint])).rows[0].id);
    const rows = (await db.query<{ n: number }>("select count(*)::int as n from offerings where pickup_point_id = $1 and group_id is not null", [IDS.meiPoint])).rows[0].n;
    expect(rows).toBe(2); // the original slot plus the repeat, both at the same point
    expect(later).not.toBe(IDS.meiOffering);
  });

  it("refuses a slot on a different date than the offering", async () => {
    await expect(addSlot(IDS.meiOwner, IDS.meiOffering, CENTRAL, 4)).rejects.toThrow(/same date/);
    await expect(addSlot(IDS.meiOwner, IDS.meiOffering, CENTRAL, 2)).rejects.toThrow(/same date/);
  });

  it("is refused for someone else's offering, for another merchant's point and for past dates", async () => {
    await expect(addSlot(IDS.luisOwner)).rejects.toThrow(/Offering not found/);
    await expect(addSlot(IDS.meiOwner, IDS.meiOffering, LUIS_POINT)).rejects.toThrow(/Pickup point not found/);
    await expect(addSlot(IDS.meiOwner, IDS.meiOffering, CENTRAL, -2)).rejects.toThrow(/same date/);
  });

  it("refuses a slot that starts before the shared cutoff", async () => {
    // Cutoff on the pickup day at 16:00 (point's timezone); a 12:00 slot would start before it.
    await db.query(
      "update offerings set cutoff_at = ((current_date + 3) + time '16:00') at time zone 'America/New_York' where id = $1",
      [IDS.meiOffering],
    );
    await expect(
      asUser(db, IDS.meiOwner, () => db.query(`select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00')`, [IDS.meiOffering, CENTRAL])),
    ).rejects.toThrow(/Cutoff must be before the pickup start/);
  });
});

describe("shared stock", () => {
  it("counts orders from every slot against one limit", async () => {
    await db.query("update offering_items set quantity_limit = 3 where food_item_id = $1", [PORK]);
    await order(IDS.customer, IDS.meiOffering, 2);
    expect(await remaining(IDS.customer2, slotB)).toBe(1);
    await expect(order(IDS.customer2, slotB, 2)).rejects.toThrow(/Not enough stock/);
    await order(IDS.customer2, slotB, 1);
    expect(await remaining(IDS.customer, IDS.meiOffering)).toBe(0);
  });

  it("a cancelled order frees the stock in every slot", async () => {
    await db.query("update offering_items set quantity_limit = 2 where food_item_id = $1", [PORK]);
    const id = await order(IDS.customer, IDS.meiOffering, 2);
    expect(await remaining(IDS.customer2, slotB)).toBe(0);
    await asUser(db, IDS.customer, () => db.query("select cancel_order($1)", [id]));
    expect(await remaining(IDS.customer2, slotB)).toBe(2);
  });

  it("an offering without slots behaves as before (own limit only)", async () => {
    expect(await remaining(IDS.customer, IDS.luisOffering, "30000000-0000-0000-0000-000000000004")).toBe(30);
  });

  it("a limit cannot be lowered below what the whole group has ordered", async () => {
    await order(IDS.customer, IDS.meiOffering, 5);
    await expect(
      asUser(db, IDS.meiOwner, () => db.query("update offering_items set quantity_limit = 4 where offering_id = $1 and food_item_id = $2", [slotB, PORK])),
    ).rejects.toThrow(/below the quantity already ordered/);
  });
});

describe("update_offering keeps the shared parts in sync", () => {
  const update = (id: string, cutoffHours: number, limit: number | null, veggie = true) =>
    asUser(db, IDS.meiOwner, async () => {
      const cur = (await db.query<{ pickup_point_id: string; pickup_date: string; pickup_start: string; pickup_end: string }>(
        "select pickup_point_id, pickup_date::text, pickup_start::text, pickup_end::text from offerings where id = $1", [id])).rows[0];
      const items = [{ food_item_id: PORK, quantity_limit: limit }, ...(veggie ? [{ food_item_id: VEGGIE, quantity_limit: 20 }] : [])];
      await db.query(
        `select update_offering($1, $2, $3, $4, $5, now() + ($6 || ' hours')::interval, $7::jsonb, $8, null)`,
        [id, cur.pickup_point_id, cur.pickup_date, cur.pickup_start, cur.pickup_end, String(cutoffHours), JSON.stringify(items), "Look for the red tent"],
      );
    });

  it("cutoff, instructions, foods and limits reach the other slot; its schedule does not change", async () => {
    await update(IDS.meiOffering, 24, 15, false);
    const b = (await db.query<{ cutoff_at: string; instructions: string; pickup_start: string; pickup_point_id: string }>(
      "select cutoff_at, instructions, pickup_start::text, pickup_point_id from offerings where id = $1", [slotB])).rows[0];
    const a = (await db.query<{ cutoff_at: string }>("select cutoff_at from offerings where id = $1", [IDS.meiOffering])).rows[0];
    expect(new Date(b.cutoff_at).getTime()).toBe(new Date(a.cutoff_at).getTime());
    expect(b.instructions).toBe("Look for the red tent");
    expect(b.pickup_start).toBe("12:00:00");
    expect(b.pickup_point_id).toBe(CENTRAL);
    const items = (await db.query<{ food_item_id: string; quantity_limit: number }>("select food_item_id, quantity_limit from offering_items where offering_id = $1", [slotB])).rows;
    expect(items).toEqual([{ food_item_id: PORK, quantity_limit: 15 }]);
  });

  it("is all-or-nothing: removing a food that has an order in another slot is refused everywhere", async () => {
    await order(IDS.customer, slotB, 1, VEGGIE);
    await expect(update(IDS.meiOffering, 24, 40, false)).rejects.toThrow(/Item has orders/);
    const n = (await db.query<{ n: number }>("select count(*)::int as n from offering_items where offering_id = $1", [IDS.meiOffering])).rows[0].n;
    expect(n).toBe(2);
  });
});

describe("moving the date moves every upcoming slot", () => {
  it("update_offering applies a new date to all slots of the group", async () => {
    await asUser(db, IDS.meiOwner, () =>
      db.query(
        `select update_offering($1, $2, current_date + 5, '17:00', '19:00', now() + interval '1 day',
                 '[{"food_item_id":"${PORK}","quantity_limit":40}]'::jsonb)`,
        [IDS.meiOffering, IDS.meiPoint],
      ),
    );
    const dates = (await db.query<{ d: string }>("select distinct pickup_date::text as d from offerings where group_id is not null")).rows;
    expect(dates).toHaveLength(1);
  });
});

describe("change_order_slot", () => {
  const move = (userId: string, orderId: string, to: string) =>
    asUser(db, userId, () => db.query("select change_order_slot($1, $2)", [orderId, to]));
  const where = async (orderId: string) =>
    (await db.query<{ offering_id: string; slot_ok: boolean }>(
      `select o.offering_id, bool_and(oi_off.offering_id = o.offering_id) as slot_ok
         from orders o join order_items oi on oi.order_id = o.id join offering_items oi_off on oi_off.id = oi.offering_item_id
        where o.id = $1 group by o.offering_id`, [orderId])).rows[0];

  it("moves the order and its items to the other slot without touching stock", async () => {
    const id = await order(IDS.customer, IDS.meiOffering, 2);
    const before = await remaining(IDS.customer2, IDS.meiOffering);
    await move(IDS.customer, id, slotB);
    expect(await where(id)).toEqual({ offering_id: slotB, slot_ok: true });
    expect(await remaining(IDS.customer2, slotB)).toBe(before);
  });

  it("refuses other people's orders, other offerings, unpublished slots, closed cutoffs and duplicates", async () => {
    const id = await order(IDS.customer, IDS.meiOffering, 1);
    await expect(move(IDS.customer2, id, slotB)).rejects.toThrow(/Order not found/);
    await expect(move(IDS.customer, id, IDS.luisOffering)).rejects.toThrow(/not available/);

    await db.query("update offerings set status = 'draft' where id = $1", [slotB]);
    await expect(move(IDS.customer, id, slotB)).rejects.toThrow(/not available/);
    await db.query("update offerings set status = 'published' where id = $1", [slotB]);

    await order(IDS.customer, slotB, 1); // already has an order in B
    await expect(move(IDS.customer, id, slotB)).rejects.toThrow(/already have an order/);

    await db.query("update offerings set cutoff_at = now() - interval '1 minute' where group_id is not null");
    const id2 = await order(IDS.customer2, IDS.meiOffering, 1).catch(() => null);
    expect(id2).toBeNull(); // cutoff passed: no ordering at all
    await expect(move(IDS.customer, id, slotB)).rejects.toThrow(/cutoff has passed/);
  });

  it("a cancelled or picked-up order cannot be moved", async () => {
    const id = await order(IDS.customer, IDS.meiOffering, 1);
    await asUser(db, IDS.customer, () => db.query("select cancel_order($1)", [id]));
    await expect(move(IDS.customer, id, slotB)).rejects.toThrow(/can no longer be changed/);
  });
});

describe("visibility", () => {
  it("customers can read every published slot of an offering", async () => {
    const n = await asUser(db, IDS.customer2, async () => (await db.query("select id from offerings where group_id is not null")).rows.length);
    expect(n).toBe(2);
  });
});
