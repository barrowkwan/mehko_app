import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
let porkItem: string;

beforeAll(async () => {
  db = await createDb();
  porkItem = await itemId(db, IDS.meiOffering, IDS.porkFood);
}, 60_000);

const order = (offering: string, items: { offering_item_id: string; qty: number }[]) =>
  db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [offering, JSON.stringify(items)]);

describe("migration + seed", () => {
  it("creates profiles for new auth users via trigger", async () => {
    const r = await db.query<{ display_name: string }>("select display_name from profiles where id = $1", [IDS.customer]);
    expect(r.rows[0].display_name).toBe("Sam Customer");
  });
});

describe("offering schedule", () => {
  it("rejects a cutoff after the pickup start", async () => {
    await expect(
      db.query(
        `insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at)
         values ($1, $2, current_date + 5, '10:00', '12:00', now() + interval '30 days')`,
        [IDS.meiMerchant, IDS.meiPoint],
      ),
    ).rejects.toThrow(/Cutoff must be before the pickup start/);
  });
});

describe("ordering", () => {
  it("lets a customer place, edit and cancel an order before the cutoff", async () => {
    const orderId = await asUser(db, IDS.customer, async () => {
      const r = await order(IDS.meiOffering, [{ offering_item_id: porkItem, qty: 2 }]);
      const id = r.rows[0].place_order;
      await db.query("select update_order($1, $2::jsonb)", [id, JSON.stringify([{ offering_item_id: porkItem, qty: 5 }])]);
      const items = await db.query<{ qty: number }>("select qty from order_items where order_id = $1", [id]);
      expect(items.rows).toEqual([{ qty: 5 }]);
      await db.query("select cancel_order($1)", [id]);
      return id;
    });
    const r = await db.query<{ status: string }>("select status from orders where id = $1", [orderId]);
    expect(r.rows[0].status).toBe("cancelled");
  });

  it("allows re-ordering after cancelling, but not two active orders", async () => {
    await asUser(db, IDS.customer2, async () => {
      await order(IDS.luisOffering, [{ offering_item_id: await itemId(db, IDS.luisOffering, "30000000-0000-0000-0000-000000000003"), qty: 1 }]);
      await expect(
        order(IDS.luisOffering, [{ offering_item_id: await itemId(db, IDS.luisOffering, "30000000-0000-0000-0000-000000000003"), qty: 1 }]),
      ).rejects.toThrow(/already have an order/);
    });
    // customer (c1) cancelled their Mei order in the earlier test and can order again.
    await asUser(db, IDS.customer, async () => {
      const again = await order(IDS.meiOffering, [{ offering_item_id: porkItem, qty: 1 }]);
      expect(again.rows[0].place_order).toBeTruthy();
      await db.query("select cancel_order($1)", [again.rows[0].place_order]);
    });
  });

  it("enforces per-item stock limits", async () => {
    await asUser(db, IDS.customer, async () => {
      await expect(order(IDS.meiOffering, [{ offering_item_id: porkItem, qty: 41 }])).rejects.toThrow(/stock/);
    });
  });

  it("blocks placing, editing and cancelling after the cutoff", async () => {
    let id = "";
    await asUser(db, IDS.customer, async () => {
      id = (await order(IDS.meiOffering, [{ offering_item_id: porkItem, qty: 1 }])).rows[0].place_order;
    });
    await db.exec(`update offerings set cutoff_at = now() - interval '1 minute' where id = '${IDS.meiOffering}'`);
    await asUser(db, IDS.customer2, async () => {
      await expect(order(IDS.meiOffering, [{ offering_item_id: porkItem, qty: 1 }])).rejects.toThrow(/cutoff/i);
    });
    await asUser(db, IDS.customer, async () => {
      await expect(
        db.query("select update_order($1, $2::jsonb)", [id, JSON.stringify([{ offering_item_id: porkItem, qty: 3 }])]),
      ).rejects.toThrow(/cutoff/i);
      await expect(db.query("select cancel_order($1)", [id])).rejects.toThrow(/cutoff/i);
    });
    // restore for later tests
    await db.exec(`update offerings set cutoff_at = now() + interval '1 day' where id = '${IDS.meiOffering}'`);
  });

  it("does not let customers write orders directly", async () => {
    await asUser(db, IDS.customer, async () => {
      await expect(
        db.query("insert into orders (customer_id, offering_id) values ($1, $2)", [IDS.customer, IDS.luisOffering]),
      ).rejects.toThrow(/row-level security|permission denied/);
    });
  });

  it("does not let a customer edit someone else's order", async () => {
    let id = "";
    await asUser(db, IDS.customer2, async () => {
      id = (await order(IDS.meiOffering, [{ offering_item_id: porkItem, qty: 1 }])).rows[0].place_order;
    });
    await asUser(db, IDS.customer, async () => {
      await expect(
        db.query("select update_order($1, $2::jsonb)", [id, JSON.stringify([{ offering_item_id: porkItem, qty: 9 }])]),
      ).rejects.toThrow(/Order not found/);
    });
  });
});

describe("row level security", () => {
  it("shows customers only their own orders", async () => {
    await asUser(db, IDS.customer2, async () => {
      const r = await db.query<{ customer_id: string }>("select customer_id from orders");
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows.every((o) => o.customer_id === IDS.customer2)).toBe(true);
    });
  });

  it("shows merchants only orders on their own offerings", async () => {
    await asUser(db, IDS.luisOwner, async () => {
      const r = await db.query<{ offering_id: string }>("select offering_id from orders");
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows.every((o) => o.offering_id === IDS.luisOffering)).toBe(true);
    });
  });

  it("scopes the order_lines report view to the calling merchant", async () => {
    await asUser(db, IDS.meiOwner, async () => {
      const r = await db.query<{ merchant_id: string }>("select merchant_id from order_lines");
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows.every((l) => l.merchant_id === IDS.meiMerchant)).toBe(true);
    });
  });

  it("lets a merchant read profiles of their customers only", async () => {
    await asUser(db, IDS.luisOwner, async () => {
      const r = await db.query<{ id: string }>("select id from profiles where id in ($1, $2)", [IDS.customer, IDS.customer2]);
      // customer2 ordered from Luis; customer only ordered (and cancelled/ordered) from Mei... customer never ordered from Luis
      expect(r.rows.map((x) => x.id)).toEqual([IDS.customer2]);
    });
  });

  it("prevents a merchant from managing another merchant's pickup points", async () => {
    await asUser(db, IDS.luisOwner, async () => {
      await expect(
        db.query("insert into pickup_points (merchant_id, name, lat, lng) values ($1, 'x', 0, 0)", [IDS.meiMerchant]),
      ).rejects.toThrow(/row-level security/);
    });
  });
});

describe("QR pickup", () => {
  it("confirms once, is idempotent, and rejects other merchants", async () => {
    const { rows } = await db.query<{ qr_token: string; id: string }>(
      "select id, qr_token from orders where customer_id = $1 and offering_id = $2",
      [IDS.customer2, IDS.meiOffering],
    );
    const token = rows[0].qr_token;

    await asUser(db, IDS.luisOwner, async () => {
      await expect(db.query("select * from confirm_pickup($1)", [token])).rejects.toThrow(/different merchant/);
    });
    await asUser(db, IDS.meiOwner, async () => {
      const first = await db.query<{ already_picked_up: boolean; customer_name: string }>(
        "select * from confirm_pickup($1)",
        [token],
      );
      expect(first.rows[0]).toMatchObject({ already_picked_up: false, customer_name: "Pat Second" });
      const again = await db.query<{ already_picked_up: boolean }>("select * from confirm_pickup($1)", [token]);
      expect(again.rows[0].already_picked_up).toBe(true);
      await expect(db.query("select * from confirm_pickup('nope')")).rejects.toThrow(/Unknown QR/);
    });
    const o = await db.query<{ status: string; picked_up_at: string | null }>("select status, picked_up_at from orders where id = $1", [rows[0].id]);
    expect(o.rows[0].status).toBe("picked_up");
    expect(o.rows[0].picked_up_at).not.toBeNull();
  });

  it("rejects cancelled orders", async () => {
    const { rows } = await db.query<{ qr_token: string }>(
      "select qr_token from orders where customer_id = $1 and status = 'cancelled' limit 1",
      [IDS.customer],
    );
    await asUser(db, IDS.meiOwner, async () => {
      await expect(db.query("select * from confirm_pickup($1)", [rows[0].qr_token])).rejects.toThrow(/cancelled/);
    });
  });
});

describe("live location", () => {
  it("only lets the merchant share on the pickup date and only customers with an order see it", async () => {
    // Offering for "today" in the pickup point's timezone, plus an order from customer (c1).
    const today = (await db.query<{ d: string }>("select (now() at time zone 'America/New_York')::date::text as d")).rows[0].d;
    const off = (
      await db.query<{ id: string }>(
        `insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at)
         values ($1, $2, $3::date, '00:00', '23:59', ($3::date + time '00:00') at time zone 'America/New_York') returning id`,
        [IDS.meiMerchant, IDS.meiPoint, today],
      )
    ).rows[0].id;
    const offeringItem = (
      await db.query<{ id: string }>("insert into offering_items (offering_id, food_item_id) values ($1, $2) returning id", [off, IDS.porkFood])
    ).rows[0].id;
    await db.query("insert into orders (customer_id, offering_id) values ($1, $2)", [IDS.customer, off]);
    void offeringItem;

    // Not-pickup-day offering: sharing is rejected.
    await asUser(db, IDS.meiOwner, async () => {
      await expect(
        db.query("insert into location_shares (offering_id, lat, lng, active) values ($1, 1, 1, true)", [IDS.meiOffering]),
      ).rejects.toThrow(/row-level security/);
      await db.query("insert into location_shares (offering_id, lat, lng, active) values ($1, 40.8, -73.97, true)", [off]);
    });
    // Another merchant can't share for it.
    await asUser(db, IDS.luisOwner, async () => {
      await expect(db.query("update location_shares set lat = 0 where offering_id = $1 returning 1", [off]).then((r) => {
        if (r.rows.length === 0) throw new Error("row-level security: no rows updated");
      })).rejects.toThrow(/row-level security/);
    });

    await asUser(db, IDS.customer, async () => {
      const r = await db.query("select * from location_shares where offering_id = $1", [off]);
      expect(r.rows).toHaveLength(1);
    });
    await asUser(db, IDS.customer2, async () => {
      const r = await db.query("select * from location_shares where offering_id = $1", [off]);
      expect(r.rows).toHaveLength(0);
    });

    // Merchant stops sharing: customers no longer see it.
    await asUser(db, IDS.meiOwner, async () => {
      await db.query("update location_shares set active = false where offering_id = $1", [off]);
    });
    await asUser(db, IDS.customer, async () => {
      const r = await db.query("select * from location_shares where offering_id = $1", [off]);
      expect(r.rows).toHaveLength(0);
    });
  });
});
