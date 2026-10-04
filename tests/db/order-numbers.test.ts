import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createDb();
}, 60_000);

const order = async (userId: string, offering: string, food: string) => {
  const item = await itemId(db, offering, food);
  const r = await asUser(db, userId, () =>
    db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [offering, JSON.stringify([{ offering_item_id: item, qty: 1 }])]),
  );
  return r.rows[0].place_order;
};
const numberOf = async (id: string) => (await db.query<{ order_no: string }>("select order_no from orders where id = $1", [id])).rows[0].order_no;
const TACOS = "30000000-0000-0000-0000-000000000004"; // Luis's Elote

describe("merchant codes", () => {
  it("every merchant has a code like m00001, handed out in order", async () => {
    const r = await db.query<{ name: string; code: string }>("select name, code from merchants order by code");
    expect(r.rows.map((x) => x.code)).toEqual(["m00001", "m00002"]);
  });

  it("a new merchant gets the next code", async () => {
    await db.query("insert into merchants (owner_id, name) values ($1, 'Third')", [IDS.customer]);
    const r = await db.query<{ code: string }>("select code from merchants where name = 'Third'");
    expect(r.rows[0].code).toBe("m00003");
  });

  it("the code cannot be changed, but the rest of the profile can", async () => {
    await expect(asUser(db, IDS.meiOwner, () => db.query("update merchants set code = 'm99999' where id = $1", [IDS.meiMerchant]))).rejects.toThrow(/cannot be changed/);
    const ok = await asUser(db, IDS.meiOwner, () => db.query("update merchants set name = 'Mei Dumplings' where id = $1 returning id", [IDS.meiMerchant]));
    expect(ok.rows).toHaveLength(1);
  });
});

describe("order numbers", () => {
  it("run per merchant: m00001-00000001, m00001-00000002, and the other merchant starts again", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    const b = await order(IDS.customer2, IDS.meiOffering, IDS.porkFood);
    const c = await order(IDS.customer, IDS.luisOffering, TACOS);
    expect(await numberOf(a)).toBe("m00001-00000001");
    expect(await numberOf(b)).toBe("m00001-00000002");
    expect(await numberOf(c)).toBe("m00002-00000001");
  });

  it("a cancelled order keeps its number and a new order never reuses it", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    await asUser(db, IDS.customer, () => db.query("select cancel_order($1)", [a]));
    const b = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    expect(await numberOf(a)).toBe("m00001-00000001");
    expect(await numberOf(b)).toBe("m00001-00000002");
  });

  it("an order number cannot be edited, and users cannot read or change the counters", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    await expect(db.query("update orders set order_no = 'x' where id = $1", [a])).rejects.toThrow(/cannot be changed/);
    await expect(asUser(db, IDS.meiOwner, () => db.query("select * from merchant_order_counters"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, IDS.meiOwner, () => db.query("update merchant_order_counters set last_no = 0"))).rejects.toThrow(/permission denied/);
  });

  it("the customer and the merchant both see the number; the scan returns it", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    const mine = await asUser(db, IDS.customer, () => db.query<{ order_no: string }>("select order_no from orders where id = $1", [a]));
    expect(mine.rows[0].order_no).toBe("m00001-00000001");
    const theirs = await asUser(db, IDS.meiOwner, () => db.query<{ order_no: string }>("select order_no from orders where id = $1", [a]));
    expect(theirs.rows[0].order_no).toBe("m00001-00000001");
    const { qr_token } = (await db.query<{ qr_token: string }>("select qr_token from orders where id = $1", [a])).rows[0];
    const scan = await asUser(db, IDS.meiOwner, () => db.query<{ order_no: string }>("select order_no from confirm_pickup($1)", [qr_token]));
    expect(scan.rows[0].order_no).toBe("m00001-00000001");
  });
});

describe("the migration on existing data", () => {
  it("numbers existing merchants and orders by creation time, then continues from there", async () => {
    const old = await createDb({ stopBefore: "20261018" });
    const item = (await old.query<{ id: string }>("select id from offering_items where offering_id = $1 and food_item_id = $2", [IDS.meiOffering, IDS.porkFood])).rows[0].id;
    // three existing orders for Mei (inserted newest-first on purpose) and one for Luis
    await old.query("insert into orders (id, customer_id, offering_id, created_at) values ('90000000-0000-0000-0000-000000000003', $1, $2, now() - interval '1 day')", [IDS.customer, IDS.meiOffering]);
    await old.query("insert into orders (id, customer_id, offering_id, created_at) values ('90000000-0000-0000-0000-000000000001', $1, $2, now() - interval '3 days')", [IDS.customer2, IDS.meiOffering]);
    await old.query("insert into orders (id, customer_id, offering_id, created_at, status) values ('90000000-0000-0000-0000-000000000002', $1, $2, now() - interval '2 days', 'cancelled')", [IDS.customer, IDS.meiOffering]);
    await old.query("insert into orders (id, customer_id, offering_id) values ('90000000-0000-0000-0000-000000000009', $1, $2)", [IDS.customer, IDS.luisOffering]);
    void item;

    await old.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261018000000_merchant_codes_order_numbers.sql"), "utf8"));

    const rows = (await old.query<{ id: string; order_no: string }>("select id, order_no from orders order by order_no")).rows;
    expect(Object.fromEntries(rows.map((r) => [r.id.slice(-1), r.order_no]))).toEqual({
      "1": "m00001-00000001",
      "2": "m00001-00000002",
      "3": "m00001-00000003",
      "9": "m00002-00000001",
    });
    const codes = (await old.query<{ code: string }>("select code from merchants order by code")).rows.map((r) => r.code);
    expect(codes).toEqual(["m00001", "m00002"]);

    // new rows continue the sequences
    await old.query("insert into orders (customer_id, offering_id) values ($1, $2)", [IDS.customer2, IDS.luisOffering]);
    await old.query("insert into merchants (owner_id, name) values ($1, 'Third')", [IDS.customer]);
    expect((await old.query<{ order_no: string }>("select order_no from orders where customer_id = $1 and offering_id = $2", [IDS.customer2, IDS.luisOffering])).rows[0].order_no).toBe("m00002-00000002");
    expect((await old.query<{ code: string }>("select code from merchants where name = 'Third'")).rows[0].code).toBe("m00003");
  });
});
