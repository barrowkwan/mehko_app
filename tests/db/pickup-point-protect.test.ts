import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb, itemId } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createDb();
}, 60_000);

const edit = (userId: string, set: string) =>
  asUser(db, userId, () => db.query(`update pickup_points set ${set} where id = $1 returning id`, [IDS.meiPoint]));
const order = async () => {
  const item = await itemId(db, IDS.meiOffering, IDS.porkFood);
  return asUser(db, IDS.customer, () =>
    db.query("select place_order($1, $2::jsonb)", [IDS.meiOffering, JSON.stringify([{ offering_item_id: item, qty: 1 }])]),
  );
};

describe("editing a pickup point", () => {
  it("is free while nothing is ordered", async () => {
    const r = await edit(IDS.meiOwner, "name = 'Riverside Lot', address = '1 New St', lat = 40.1, lng = -73.9");
    expect(r.rows).toHaveLength(1);
  });

  it("cannot move or re-address a point that has an active order on an upcoming offering", async () => {
    await order();
    await expect(edit(IDS.meiOwner, "lat = 41.0")).rejects.toThrow(/upcoming orders/);
    await expect(edit(IDS.meiOwner, "lng = -70.0")).rejects.toThrow(/upcoming orders/);
    await expect(edit(IDS.meiOwner, "address = 'Somewhere else'")).rejects.toThrow(/upcoming orders/);
  });

  it("can still rename it and fix its timezone while it has orders", async () => {
    await order();
    expect((await edit(IDS.meiOwner, "name = 'Renamed Park'")).rows).toHaveLength(1);
    expect((await edit(IDS.meiOwner, "timezone = 'America/Chicago'")).rows).toHaveLength(1);
  });

  it("a cancelled order or a past offering does not block the move", async () => {
    const id = (await order()).rows[0] as { place_order: string };
    await asUser(db, IDS.customer, () => db.query("select cancel_order($1)", [id.place_order]));
    expect((await edit(IDS.meiOwner, "lat = 41.0")).rows).toHaveLength(1);

    await order(); // active again, then the pickup day passes
    await db.query("alter table offerings disable trigger offerings_protect_changes");
    await db.query("update offerings set pickup_date = current_date - 5, cutoff_at = now() - interval '6 days' where id = $1", [IDS.meiOffering]);
    expect((await edit(IDS.meiOwner, "lat = 42.0")).rows).toHaveLength(1);
  });

  it("another merchant cannot edit it at all", async () => {
    expect((await edit(IDS.luisOwner, "name = 'Hijacked'")).rows).toHaveLength(0);
  });
});
