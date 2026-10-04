import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb } from "./harness";

const LUIS_MERCHANT = "10000000-0000-0000-0000-000000000002";
let db: PGlite;

beforeEach(async () => {
  db = await createDb();
}, 60_000);

const insert = (userId: string, name: string, bucket = "food-images") =>
  asUser(db, userId, () => db.query("insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)", [bucket, name, userId]));
const visible = (userId: string) => asUser(db, userId, async () => (await db.query<{ name: string }>("select name from storage.objects order by name")).rows.map((r) => r.name));

describe("food_items.image_path", () => {
  it("replaces the unused image_url column", async () => {
    const cols = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'food_items'")).rows.map((r) => r.column_name);
    expect(cols).toContain("image_path");
    expect(cols).not.toContain("image_url");
  });
});

describe("food-images bucket", () => {
  it("is public-read, JPEG-only and capped at 1 MiB", async () => {
    const b = (await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'food-images'")).rows[0];
    expect(b.public).toBe(true);
    expect(Number(b.file_size_limit)).toBe(1048576);
    expect(b.allowed_mime_types).toEqual(["image/jpeg"]);
  });
});

describe("storage policies", () => {
  it("lets a merchant add photos only inside their own merchant folder", async () => {
    await insert(IDS.meiOwner, `${IDS.meiMerchant}/pork-abc.jpg`);
    await expect(insert(IDS.meiOwner, `${LUIS_MERCHANT}/pork-abc.jpg`)).rejects.toThrow(/row-level security/);
  });

  it("rejects customers, folders that aren't a merchant id, root-level files and other buckets", async () => {
    await expect(insert(IDS.customer, `${IDS.meiMerchant}/x.jpg`)).rejects.toThrow(/row-level security/);
    await expect(insert(IDS.meiOwner, "not-a-uuid/x.jpg")).rejects.toThrow(/row-level security/);
    await expect(insert(IDS.meiOwner, "x.jpg")).rejects.toThrow(/row-level security/);
    await expect(insert(IDS.meiOwner, `${IDS.meiMerchant}/../${LUIS_MERCHANT}/x.jpg`)).rejects.toThrow(/row-level security/);
    await db.exec("insert into storage.buckets (id, name) values ('other', 'other')");
    await expect(insert(IDS.meiOwner, `${IDS.meiMerchant}/x.jpg`, "other")).rejects.toThrow(/row-level security/);
  });

  it("only shows, replaces and deletes a merchant's own files", async () => {
    await insert(IDS.meiOwner, `${IDS.meiMerchant}/a.jpg`);
    await insert(IDS.luisOwner, `${LUIS_MERCHANT}/b.jpg`);
    expect(await visible(IDS.meiOwner)).toEqual([`${IDS.meiMerchant}/a.jpg`]);
    expect(await visible(IDS.luisOwner)).toEqual([`${LUIS_MERCHANT}/b.jpg`]);
    expect(await visible(IDS.customer)).toEqual([]);

    await asUser(db, IDS.luisOwner, async () => {
      const upd = await db.query("update storage.objects set name = name where name like $1 returning id", [`${IDS.meiMerchant}/%`]);
      const del = await db.query("delete from storage.objects where name like $1 returning id", [`${IDS.meiMerchant}/%`]);
      expect(upd.rows).toHaveLength(0);
      expect(del.rows).toHaveLength(0);
    });
    await asUser(db, IDS.meiOwner, async () => {
      expect((await db.query("delete from storage.objects where name = $1 returning id", [`${IDS.meiMerchant}/a.jpg`])).rows).toHaveLength(1);
    });
  });
});
