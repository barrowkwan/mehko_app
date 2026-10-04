import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

const NY = "America/New_York";
let db: PGlite;
let porkItem: string;

beforeEach(async () => {
  db = await createDb();
  porkItem = await itemId(db, IDS.meiOffering, IDS.porkFood);
}, 60_000);

const rows = async (where = "true") =>
  (await db.query<{ type: string; entity_id: string; user_id: string; status: string; attempts: number }>(`select type, entity_id, user_id, status, attempts from notification_outbox where ${where} order by type, created_at`)).rows;
const count = async (where = "true") => Number((await db.query<{ n: string }>(`select count(*)::int as n from notification_outbox where ${where}`)).rows[0].n);
const asService = async <T>(fn: () => Promise<T>) => {
  await db.exec("set role service_role");
  try { return await fn(); } finally { await db.exec("reset role"); }
};
const enqueue = () => asService(() => db.query("select enqueue_due_notifications()"));

// An offering whose pickup starts `startInHours` from now (in New York time) and whose cutoff was `cutoffAgoHours` ago.
// Triggers are bypassed for the setup only (it moves an offering that may have orders).
async function arrangeOffering(opts: { startInHours: number; cutoffAgoHours: number }) {
  await db.exec("set session_replication_role = replica");
  await db.query(
    `update offerings set
       pickup_date = ((now() + $1 * interval '1 hour') at time zone '${NY}')::date,
       pickup_start = ((now() + $1 * interval '1 hour') at time zone '${NY}')::time,
       pickup_end = case when ((now() + $1 * interval '1 hour') at time zone '${NY}')::time < time '23:00'
                         then (((now() + $1 * interval '1 hour') at time zone '${NY}')::time + interval '30 minutes')
                         else time '23:59:59' end,
       cutoff_at = now() - $2 * interval '1 hour'
     where id = $3`,
    [opts.startInHours, opts.cutoffAgoHours, IDS.meiOffering],
  );
  await db.exec("set session_replication_role = origin");
}
const insertOrder = async (customer: string, createdHoursAgo = 24, status = "placed") =>
  (await db.query<{ id: string }>(`insert into orders (customer_id, offering_id, status, created_at) values ($1, $2, $3, now() - $4 * interval '1 hour') returning id`, [customer, IDS.meiOffering, status, createdHoursAgo])).rows[0].id;

describe("schema", () => {
  it("adds a per-user email switch, on by default", async () => {
    const r = await db.query<{ email_notifications: boolean }>("select email_notifications from profiles where id = $1", [IDS.customer]);
    expect(r.rows[0].email_notifications).toBe(true);
  });
});

describe("order_confirmed", () => {
  it("is queued for the customer when an order is placed, once per order", async () => {
    const id = await asUser(db, IDS.customer, async () => (await db.query<{ p: string }>("select place_order($1, $2::jsonb) as p", [IDS.meiOffering, JSON.stringify([{ offering_item_id: porkItem, qty: 1 }])])).rows[0].p);
    expect(await rows()).toEqual([{ type: "order_confirmed", entity_id: id, user_id: IDS.customer, status: "pending", attempts: 0 }]);
    // editing the order later does not queue another confirmation
    await asUser(db, IDS.customer, () => db.query("select update_order($1, $2::jsonb)", [id, JSON.stringify([{ offering_item_id: porkItem, qty: 2 }])]));
    expect(await count("type = 'order_confirmed'")).toBe(1);
  });
});

describe("pickup_reminder (enqueue_due_notifications)", () => {
  it("queues orders whose pickup starts within 3 hours, once", async () => {
    await arrangeOffering({ startInHours: 2, cutoffAgoHours: 5 });
    const id = await insertOrder(IDS.customer);
    await enqueue();
    await enqueue(); // idempotent
    expect(await rows("type = 'pickup_reminder'")).toEqual([{ type: "pickup_reminder", entity_id: id, user_id: IDS.customer, status: "pending", attempts: 0 }]);
  });

  it("ignores pickups further away, already started, cancelled orders, and orders placed inside the reminder window", async () => {
    await arrangeOffering({ startInHours: 6, cutoffAgoHours: 7 });
    await insertOrder(IDS.customer);
    await enqueue();
    expect(await count("type = 'pickup_reminder'")).toBe(0);

    await arrangeOffering({ startInHours: -1, cutoffAgoHours: 3 }); // already started
    await enqueue();
    expect(await count("type = 'pickup_reminder'")).toBe(0);

    await arrangeOffering({ startInHours: 2, cutoffAgoHours: 5 });
    await db.exec("delete from orders");
    await insertOrder(IDS.customer, 24, "cancelled");
    await insertOrder(IDS.customer2, 1); // ordered 1 h ago, i.e. inside the 3 h window: the confirmation is enough
    await enqueue();
    expect(await count("type = 'pickup_reminder'")).toBe(0);
  });
});

describe("merchant_cutoff_summary (enqueue_due_notifications)", () => {
  it("queues one summary for the merchant's owner after the cutoff when there are active orders", async () => {
    await arrangeOffering({ startInHours: 20, cutoffAgoHours: 1 });
    await insertOrder(IDS.customer);
    await insertOrder(IDS.customer2);
    await enqueue();
    await enqueue();
    expect(await rows("type = 'merchant_cutoff_summary'")).toEqual([{ type: "merchant_cutoff_summary", entity_id: IDS.meiOffering, user_id: IDS.meiOwner, status: "pending", attempts: 0 }]);
  });

  it("waits for the cutoff, needs an active order, and does not backfill old offerings", async () => {
    await insertOrder(IDS.customer); // cutoff is still in the future
    await enqueue();
    expect(await count("type = 'merchant_cutoff_summary'")).toBe(0);

    await arrangeOffering({ startInHours: 20, cutoffAgoHours: 1 });
    await db.exec("delete from orders");
    await insertOrder(IDS.customer, 24, "cancelled");
    await enqueue();
    expect(await count("type = 'merchant_cutoff_summary'")).toBe(0); // only cancelled orders

    await db.exec("delete from orders");
    await insertOrder(IDS.customer);
    await arrangeOffering({ startInHours: 20, cutoffAgoHours: 24 * 5 }); // cutoff 5 days ago
    await enqueue();
    expect(await count("type = 'merchant_cutoff_summary'")).toBe(0);
  });
});

describe("claim_notifications", () => {
  const seed = async () => {
    await arrangeOffering({ startInHours: 20, cutoffAgoHours: 1 });
    await insertOrder(IDS.customer);
    await insertOrder(IDS.customer2);
    await enqueue(); // 2 order_confirmed (triggers) + 1 merchant summary
  };

  it("hands out due rows once, marks them sending and counts the attempt", async () => {
    await seed();
    const first = await asService(async () => (await db.query<{ id: string; status: string; attempts: number }>("select * from claim_notifications(2)")).rows);
    expect(first).toHaveLength(2);
    expect(first.every((r) => r.status === "sending" && r.attempts === 1)).toBe(true);
    const second = await asService(async () => (await db.query("select * from claim_notifications(10)")).rows);
    expect(second).toHaveLength(1); // the remaining one
    expect(await asService(async () => (await db.query("select * from claim_notifications(10)")).rows)).toHaveLength(0);
  });

  it("skips rows that are not due yet and rows already sent", async () => {
    await seed();
    await db.exec("update notification_outbox set due_at = now() + interval '1 hour' where type = 'merchant_cutoff_summary'");
    await db.exec("update notification_outbox set status = 'sent' where type = 'order_confirmed' and user_id = '" + IDS.customer2 + "'");
    const got = await asService(async () => (await db.query<{ type: string; user_id: string }>("select type, user_id from claim_notifications(10)")).rows);
    expect(got).toEqual([{ type: "order_confirmed", user_id: IDS.customer }]);
  });

  it("re-offers a row stuck in 'sending' for more than 10 minutes (crashed sender)", async () => {
    await seed();
    await asService(() => db.query("select * from claim_notifications(10)"));
    expect(await asService(async () => (await db.query("select * from claim_notifications(10)")).rows)).toHaveLength(0);
    await db.exec("update notification_outbox set claimed_at = now() - interval '11 minutes' where type = 'merchant_cutoff_summary'");
    const again = await asService(async () => (await db.query<{ type: string; attempts: number }>("select type, attempts from claim_notifications(10)")).rows);
    expect(again).toEqual([{ type: "merchant_cutoff_summary", attempts: 2 }]);
  });
});

describe("access control", () => {
  it("is closed to signed-in users and anonymous callers (no table access, no function access)", async () => {
    await arrangeOffering({ startInHours: 20, cutoffAgoHours: 1 });
    await insertOrder(IDS.customer);
    await enqueue();
    for (const user of [IDS.customer, IDS.meiOwner]) {
      await asUser(db, user, async () => {
        // no table privileges at all for signed-in users (and RLS has no policies as a second lock)
        await expect(db.query("select * from notification_outbox")).rejects.toThrow(/permission denied/);
        await expect(db.query("insert into notification_outbox (user_id, type, entity_id) values ($1, 'order_confirmed', gen_random_uuid())", [user])).rejects.toThrow(/permission denied/);
        await expect(db.query("update notification_outbox set status = 'sent'")).rejects.toThrow(/permission denied/);
        await expect(db.query("select enqueue_due_notifications()")).rejects.toThrow(/permission denied/);
        await expect(db.query("select * from claim_notifications(5)")).rejects.toThrow(/permission denied/);
      });
    }
    await db.exec("set role anon");
    await expect(db.query("select * from notification_outbox")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("lets users switch their own email notifications off, but not someone else's", async () => {
    await asUser(db, IDS.customer, async () => {
      await db.query("update profiles set email_notifications = false where id = $1", [IDS.customer]);
      const other = await db.query("update profiles set email_notifications = false where id = $1 returning id", [IDS.customer2]);
      expect(other.rows).toHaveLength(0);
    });
    expect((await db.query<{ email_notifications: boolean }>("select email_notifications from profiles where id = $1", [IDS.customer])).rows[0].email_notifications).toBe(false);
    expect((await db.query<{ email_notifications: boolean }>("select email_notifications from profiles where id = $1", [IDS.customer2])).rows[0].email_notifications).toBe(true);
  });

  it("is removed when an account is deleted", async () => {
    await insertOrder(IDS.customer);
    expect(await count("user_id = '" + IDS.customer + "'")).toBeGreaterThan(0);
    await db.query("delete from auth.users where id = $1", [IDS.customer]);
    expect(await count("user_id = '" + IDS.customer + "'")).toBe(0);
  });
});
