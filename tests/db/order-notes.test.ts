import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
let porkItem: string;

beforeEach(async () => {
  db = await createDb();
  porkItem = await itemId(db, IDS.meiOffering, IDS.porkFood);
}, 60_000);

const items = [{ offering_item_id: "", qty: 1 }];
const place = (userId: string, note?: string | null) =>
  asUser(db, userId, async () => {
    const payload = JSON.stringify([{ ...items[0], offering_item_id: porkItem }]);
    const r = note === undefined
      ? await db.query<{ place_order: string }>("select place_order($1, $2::jsonb)", [IDS.meiOffering, payload]) // old 2-argument call
      : await db.query<{ place_order: string }>("select place_order($1, $2::jsonb, $3)", [IDS.meiOffering, payload, note]);
    return r.rows[0].place_order;
  });
const update = (userId: string, id: string, note?: string | null, qty = 2) =>
  asUser(db, userId, async () => {
    const payload = JSON.stringify([{ offering_item_id: porkItem, qty }]);
    if (note === undefined) await db.query("select update_order($1, $2::jsonb)", [id, payload]); // old 2-argument call
    else await db.query("select update_order($1, $2::jsonb, $3)", [id, payload, note]);
  });
const noteOf = async (id: string) => (await db.query<{ note: string | null }>("select note from orders where id = $1", [id])).rows[0].note;

describe("order notes", () => {
  it("stores a trimmed note and treats a blank note as none", async () => {
    expect(await noteOf(await place(IDS.customer, "  No nuts please — severe allergy  "))).toBe("No nuts please — severe allergy");
    expect(await noteOf(await place(IDS.customer2, "   "))).toBeNull();
  });

  it("keeps the old 2-argument place_order call working (no note)", async () => {
    expect(await noteOf(await place(IDS.customer))).toBeNull();
  });

  it("allows exactly 300 characters and rejects 301", async () => {
    expect(await noteOf(await place(IDS.customer, "x".repeat(300)))).toHaveLength(300);
    await expect(place(IDS.customer2, "x".repeat(301))).rejects.toThrow(/Note is too long/);
  });

  it("update_order: null leaves the note, text replaces it, blank clears it", async () => {
    const id = await place(IDS.customer, "first");
    await update(IDS.customer, id); // old 2-argument call: items change, note untouched
    expect(await noteOf(id)).toBe("first");
    await update(IDS.customer, id, null);
    expect(await noteOf(id)).toBe("first");
    await update(IDS.customer, id, " second ");
    expect(await noteOf(id)).toBe("second");
    await update(IDS.customer, id, "");
    expect(await noteOf(id)).toBeNull();
    await expect(update(IDS.customer, id, "y".repeat(301))).rejects.toThrow(/Note is too long/);
  });

  it("freezes the note at the cutoff and never lets another customer change it", async () => {
    const id = await place(IDS.customer, "keep me");
    await asUser(db, IDS.customer2, async () => {
      await expect(db.query("select update_order($1, $2::jsonb, 'hacked')", [id, JSON.stringify([{ offering_item_id: porkItem, qty: 1 }])])).rejects.toThrow(/Order not found/);
    });
    await db.exec(`update offerings set cutoff_at = now() - interval '1 minute' where id = '${IDS.meiOffering}'`);
    await expect(update(IDS.customer, id, "too late")).rejects.toThrow(/cutoff/i);
    expect(await noteOf(id)).toBe("keep me");
  });

  it("is visible only to the customer and the merchant of that offering", async () => {
    const id = await place(IDS.customer, "allergic to sesame");
    const read = (userId: string) => asUser(db, userId, async () => (await db.query<{ note: string }>("select note from orders where id = $1", [id])).rows);
    expect(await read(IDS.customer)).toEqual([{ note: "allergic to sesame" }]);
    expect(await read(IDS.meiOwner)).toEqual([{ note: "allergic to sesame" }]);
    expect(await read(IDS.luisOwner)).toEqual([]);
    expect(await read(IDS.customer2)).toEqual([]);
  });

  it("cannot be written directly by customers (only through the order functions)", async () => {
    const id = await place(IDS.customer, "ok");
    await asUser(db, IDS.customer, async () => {
      const r = await db.query("update orders set note = 'sneaky' where id = $1 returning id", [id]);
      expect(r.rows).toHaveLength(0);
    });
    expect(await noteOf(id)).toBe("ok");
  });
});

describe("pickup instructions", () => {
  const instr = () => db.query<{ instructions: string | null; translations: unknown }>("select instructions, translations from offerings where id = $1", [IDS.meiOffering]).then((r) => r.rows[0]);

  it("enforces 500 characters and an object for translations", async () => {
    await asUser(db, IDS.meiOwner, async () => {
      await db.query("update offerings set instructions = $2 where id = $1", [IDS.meiOffering, "Meet at the north gate"]);
      await expect(db.query("update offerings set instructions = $2 where id = $1", [IDS.meiOffering, "x".repeat(501)])).rejects.toThrow(/check constraint|violates/i);
      await expect(db.query("update offerings set instructions = '' where id = $1", [IDS.meiOffering])).rejects.toThrow(/check constraint|violates/i);
      await expect(db.query("update offerings set translations = '[1]'::jsonb where id = $1", [IDS.meiOffering])).rejects.toThrow(/check constraint|violates/i);
    });
  });

  it("is readable by customers once the offering is published", async () => {
    await asUser(db, IDS.meiOwner, () => db.query("update offerings set instructions = 'Red tent', translations = $2::jsonb where id = $1", [IDS.meiOffering, JSON.stringify({ es: { instructions: "Carpa roja" } })]));
    await asUser(db, IDS.customer, async () => {
      const r = await db.query<{ instructions: string }>("select instructions from offerings where id = $1", [IDS.meiOffering]);
      expect(r.rows).toEqual([{ instructions: "Red tent" }]);
    });
  });

  const upd = (over: { instructions?: string | null; translations?: object | null }) =>
    asUser(db, IDS.meiOwner, () =>
      db.query("select update_offering($1, $2, pickup_date, '17:00', '19:00', cutoff_at, $3::jsonb, $4, $5::jsonb) from offerings where id = $1", [
        IDS.meiOffering,
        IDS.meiPoint,
        JSON.stringify([{ food_item_id: IDS.porkFood, quantity_limit: 40 }]),
        over.instructions ?? null,
        over.translations === undefined || over.translations === null ? null : JSON.stringify(over.translations),
      ]),
    );

  it("update_offering: null leaves instructions/translations unchanged, text sets, blank clears", async () => {
    await upd({ instructions: " Meet at the gate ", translations: { zh: { instructions: "x" } } });
    expect(await instr()).toEqual({ instructions: "Meet at the gate", translations: { zh: { instructions: "x" } } });
    await upd({}); // both null -> unchanged
    expect(await instr()).toEqual({ instructions: "Meet at the gate", translations: { zh: { instructions: "x" } } });
    await upd({ instructions: "", translations: {} });
    expect(await instr()).toEqual({ instructions: null, translations: {} });
  });

  it("old 7-argument update_offering calls still work and leave the new fields alone", async () => {
    await asUser(db, IDS.meiOwner, () => db.query("update offerings set instructions = 'Keep' where id = $1", [IDS.meiOffering]));
    await asUser(db, IDS.meiOwner, () =>
      db.query("select update_offering($1, $2, pickup_date, '17:30', '19:00', cutoff_at, $3::jsonb) from offerings where id = $1", [IDS.meiOffering, IDS.meiPoint, JSON.stringify([{ food_item_id: IDS.porkFood, quantity_limit: 40 }])]),
    );
    expect((await instr()).instructions).toBe("Keep");
  });

  it("duplicate_offering copies instructions and translations", async () => {
    await asUser(db, IDS.meiOwner, () => db.query("update offerings set instructions = 'Red tent', translations = $2::jsonb where id = $1", [IDS.meiOffering, JSON.stringify({ es: { instructions: "Carpa roja" } })]));
    const newId = await asUser(db, IDS.meiOwner, async () => (await db.query<{ d: string }>("select duplicate_offering($1, current_date + 20) as d", [IDS.meiOffering])).rows[0].d);
    const copy = (await db.query<{ instructions: string; translations: unknown }>("select instructions, translations from offerings where id = $1", [newId])).rows[0];
    expect(copy).toEqual({ instructions: "Red tent", translations: { es: { instructions: "Carpa roja" } } });
  });
});
