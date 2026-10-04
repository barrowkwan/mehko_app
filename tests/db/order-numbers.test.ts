import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createDb();
}, 60_000);

const CENTRAL = "20000000-0000-0000-0000-000000000002"; // Mei's second pickup point
const ELOTE = "30000000-0000-0000-0000-000000000004"; // Luis's food

const order = async (userId: string, offering: string, food: string) => {
  const item = await itemId(db, offering, food);
  const r = await asUser(db, userId, () =>
    db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [offering, JSON.stringify([{ offering_item_id: item, qty: 1 }])]),
  );
  return r.rows[0].place_order;
};
const numberOf = async (id: string) => (await db.query<{ order_no: string }>("select order_no from orders where id = $1", [id])).rows[0].order_no;
const offeringNo = async (id: string) => (await db.query<{ offering_no: string }>("select offering_no from offerings where id = $1", [id])).rows[0].offering_no;
const sql = (name: string) => readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

describe("merchant codes", () => {
  it("every merchant has a code like m00001, handed out in order", async () => {
    const r = await db.query<{ code: string }>("select code from merchants order by code");
    expect(r.rows.map((x) => x.code)).toEqual(["m00001", "m00002"]);
  });

  it("a new merchant gets the next code, and the code cannot be changed", async () => {
    await db.query("insert into merchants (owner_id, name) values ($1, 'Third')", [IDS.customer]);
    expect((await db.query<{ code: string }>("select code from merchants where name = 'Third'")).rows[0].code).toBe("m00003");
    await expect(asUser(db, IDS.meiOwner, () => db.query("update merchants set code = 'm99999' where id = $1", [IDS.meiMerchant]))).rejects.toThrow(/cannot be changed/);
    const ok = await asUser(db, IDS.meiOwner, () => db.query("update merchants set name = 'Mei Dumplings' where id = $1 returning id", [IDS.meiMerchant]));
    expect(ok.rows).toHaveLength(1);
  });
});

describe("offering numbers", () => {
  it("count per merchant: m00001-000001, then m00001-000002; the other merchant starts again", async () => {
    expect(await offeringNo(IDS.meiOffering)).toBe("m00001-000001");
    expect(await offeringNo(IDS.luisOffering)).toBe("m00002-000001");
    const second = await asUser(db, IDS.meiOwner, () =>
      db.query<{ id: string }>(
        `insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at)
         values ($1, $2, current_date + 5, '10:00', '12:00', now() + interval '1 day') returning id`,
        [IDS.meiMerchant, IDS.meiPoint],
      ),
    );
    expect(await offeringNo(second.rows[0].id)).toBe("m00001-000002");
  });

  it("ignores a number supplied by the client and cannot be edited", async () => {
    const r = await asUser(db, IDS.meiOwner, () =>
      db.query<{ id: string }>(
        `insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, offering_no)
         values ($1, $2, current_date + 5, '10:00', '12:00', now() + interval '1 day', 'm00002-000001') returning id`,
        [IDS.meiMerchant, IDS.meiPoint],
      ),
    );
    expect(await offeringNo(r.rows[0].id)).toBe("m00001-000002");
    await expect(asUser(db, IDS.meiOwner, () => db.query("update offerings set offering_no = 'm00001-000099' where id = $1", [IDS.meiOffering]))).rejects.toThrow(/cannot be changed/);
  });

  it("all pickup slots of one offering share its number; a duplicate is a new offering", async () => {
    const slot = (await asUser(db, IDS.meiOwner, () =>
      db.query<{ add_offering_slot: string }>("select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00')", [IDS.meiOffering, CENTRAL]),
    )).rows[0].add_offering_slot;
    expect(await offeringNo(slot)).toBe("m00001-000001");
    expect(await offeringNo(IDS.meiOffering)).toBe("m00001-000001");

    const copy = (await asUser(db, IDS.meiOwner, () =>
      db.query<{ duplicate_offering: string }>("select duplicate_offering($1, current_date + 9)", [IDS.meiOffering]),
    )).rows[0].duplicate_offering;
    expect(await offeringNo(copy)).toBe("m00001-000002");
  });
});

describe("order numbers", () => {
  it("count per offering: m00001-000001-000001, -000002; another offering starts again at 000001", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    const b = await order(IDS.customer2, IDS.meiOffering, IDS.porkFood);
    const c = await order(IDS.customer, IDS.luisOffering, ELOTE);
    expect(await numberOf(a)).toBe("m00001-000001-000001");
    expect(await numberOf(b)).toBe("m00001-000001-000002");
    expect(await numberOf(c)).toBe("m00002-000001-000001");

    // a second offering of the same merchant has its own counter
    const copy = (await asUser(db, IDS.meiOwner, () =>
      db.query<{ duplicate_offering: string }>("select duplicate_offering($1, current_date + 9)", [IDS.meiOffering]),
    )).rows[0].duplicate_offering;
    await db.query("update offerings set status = 'published' where id = $1", [copy]);
    expect(await numberOf(await order(IDS.customer, copy, IDS.porkFood))).toBe("m00001-000002-000001");
  });

  it("orders in different pickup slots of the same offering continue one sequence", async () => {
    const slot = (await asUser(db, IDS.meiOwner, () =>
      db.query<{ add_offering_slot: string }>("select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00')", [IDS.meiOffering, CENTRAL]),
    )).rows[0].add_offering_slot;
    expect(await numberOf(await order(IDS.customer, IDS.meiOffering, IDS.porkFood))).toBe("m00001-000001-000001");
    expect(await numberOf(await order(IDS.customer2, slot, IDS.porkFood))).toBe("m00001-000001-000002");
  });

  it("a cancelled order keeps its number and a new order never reuses it", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    await asUser(db, IDS.customer, () => db.query("select cancel_order($1)", [a]));
    const b = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    expect(await numberOf(a)).toBe("m00001-000001-000001");
    expect(await numberOf(b)).toBe("m00001-000001-000002");
  });

  it("moving an order to another slot of the offering keeps its number", async () => {
    const slot = (await asUser(db, IDS.meiOwner, () =>
      db.query<{ add_offering_slot: string }>("select add_offering_slot($1, $2, current_date + 3, '12:00', '13:00')", [IDS.meiOffering, CENTRAL]),
    )).rows[0].add_offering_slot;
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    await asUser(db, IDS.customer, () => db.query("select change_order_slot($1, $2)", [a, slot]));
    expect(await numberOf(a)).toBe("m00001-000001-000001");
  });

  it("an order number cannot be edited, and users cannot read or change the counters", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    await expect(db.query("update orders set order_no = 'x' where id = $1", [a])).rejects.toThrow(/cannot be changed/);
    for (const table of ["merchant_offering_counters", "offering_order_counters"]) {
      await expect(asUser(db, IDS.meiOwner, () => db.query(`select * from ${table}`))).rejects.toThrow(/permission denied/);
      await expect(asUser(db, IDS.meiOwner, () => db.query(`update ${table} set last_no = 0`))).rejects.toThrow(/permission denied/);
    }
  });

  it("the customer, the merchant and the scan all see the number", async () => {
    const a = await order(IDS.customer, IDS.meiOffering, IDS.porkFood);
    const mine = await asUser(db, IDS.customer, () => db.query<{ order_no: string }>("select order_no from orders where id = $1", [a]));
    const theirs = await asUser(db, IDS.meiOwner, () => db.query<{ order_no: string }>("select order_no from orders where id = $1", [a]));
    expect([mine.rows[0].order_no, theirs.rows[0].order_no]).toEqual(["m00001-000001-000001", "m00001-000001-000001"]);
    const { qr_token } = (await db.query<{ qr_token: string }>("select qr_token from orders where id = $1", [a])).rows[0];
    const scan = await asUser(db, IDS.meiOwner, () => db.query<{ order_no: string }>("select order_no from confirm_pickup($1)", [qr_token]));
    expect(scan.rows[0].order_no).toBe("m00001-000001-000001");
  });
});

describe("the migrations on existing data", () => {
  it("numbers existing offerings and renumbers existing orders per offering, then continues", async () => {
    const old = await createDb({ stopBefore: "20261018" });
    const insertOrder = (id: string, customer: string, offering: string, ago: string, status = "placed") =>
      old.query(`insert into orders (id, customer_id, offering_id, created_at, status) values ($1, $2, $3, now() - interval '${ago}', $4)`, [id, customer, offering, status]);
    // an older second offering for Mei, plus the seeded one; orders inserted newest-first on purpose
    const older = "40000000-0000-0000-0000-0000000000a1";
    await old.query(
      `insert into offerings (id, merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, created_at)
       values ($1, $2, $3, current_date + 6, '10:00', '12:00', now() + interval '5 days', now() - interval '10 days')`,
      [older, IDS.meiMerchant, IDS.meiPoint],
    );
    await insertOrder("90000000-0000-0000-0000-000000000003", IDS.customer, IDS.meiOffering, "1 day");
    await insertOrder("90000000-0000-0000-0000-000000000001", IDS.customer2, IDS.meiOffering, "3 days");
    await insertOrder("90000000-0000-0000-0000-000000000002", IDS.customer, IDS.meiOffering, "2 days", "cancelled");
    await insertOrder("90000000-0000-0000-0000-000000000007", IDS.customer, older, "5 days");
    await insertOrder("90000000-0000-0000-0000-000000000009", IDS.customer, IDS.luisOffering, "1 day");

    await old.exec(sql("20261018000000_merchant_codes_order_numbers.sql"));
    const interim = (await old.query<{ order_no: string }>("select order_no from orders where id = '90000000-0000-0000-0000-000000000001'")).rows[0].order_no;
    expect(interim).toMatch(/^m00001-0000000\d$/); // the short-lived first format (per merchant)

    await old.exec(sql("20261019000000_offering_numbers.sql"));
    const offerings = Object.fromEntries((await old.query<{ id: string; offering_no: string }>("select id, offering_no from offerings")).rows.map((r) => [r.id.slice(-2), r.offering_no]));
    expect(offerings).toMatchObject({ a1: "m00001-000001", "01": "m00001-000002", "02": "m00002-000001" }); // the older offering is number 1
    const orders = Object.fromEntries((await old.query<{ id: string; order_no: string }>("select id, order_no from orders")).rows.map((r) => [r.id.slice(-1), r.order_no]));
    expect(orders).toEqual({
      "7": "m00001-000001-000001",
      "1": "m00001-000002-000001",
      "2": "m00001-000002-000002",
      "3": "m00001-000002-000003",
      "9": "m00002-000001-000001",
    });

    // new rows continue every sequence
    await old.query("insert into orders (customer_id, offering_id) values ($1, $2)", [IDS.customer2, IDS.luisOffering]);
    expect((await old.query<{ order_no: string }>("select order_no from orders where customer_id = $1 and offering_id = $2", [IDS.customer2, IDS.luisOffering])).rows[0].order_no).toBe("m00002-000001-000002");
    await old.query(
      `insert into offerings (merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at)
       values ($1, $2, current_date + 8, '10:00', '12:00', now() + interval '1 day')`,
      [IDS.meiMerchant, IDS.meiPoint],
    );
    expect((await old.query<{ offering_no: string }>("select offering_no from offerings where pickup_date = current_date + 8")).rows[0].offering_no).toBe("m00001-000003");
  });

  it("slots that were already grouped keep one shared offering number", async () => {
    const old = await createDb({ stopBefore: "20261018" });
    await old.query("update offerings set group_id = '50000000-0000-0000-0000-000000000001' where id = $1", [IDS.meiOffering]);
    await old.query(
      `insert into offerings (id, merchant_id, pickup_point_id, pickup_date, pickup_start, pickup_end, cutoff_at, group_id)
       select '40000000-0000-0000-0000-0000000000b2', merchant_id, pickup_point_id, pickup_date, '12:00', '13:00', cutoff_at, group_id from offerings where id = $1`,
      [IDS.meiOffering],
    );
    await old.exec(sql("20261018000000_merchant_codes_order_numbers.sql"));
    await old.exec(sql("20261019000000_offering_numbers.sql"));
    const rows = (await old.query<{ offering_no: string }>("select distinct offering_no from offerings where merchant_id = $1", [IDS.meiMerchant])).rows;
    expect(rows).toEqual([{ offering_no: "m00001-000001" }]);
  });
});
