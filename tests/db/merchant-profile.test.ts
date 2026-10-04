import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IDS, asUser, createDb } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createDb();
}, 60_000);

const set = (column: string, value: string | null) =>
  asUser(db, IDS.meiOwner, () => db.query(`update merchants set ${column} = $1 where id = $2`, [value, IDS.meiMerchant]));

describe("merchant profile extras", () => {
  it("accepts valid optional values and null", async () => {
    await set("website", "https://example.com/menu?x=1");
    await set("contact_email", "hello@example.com");
    await set("contact_phone", "+1 (408) 555-0100");
    await set("logo_path", `${IDS.meiMerchant}/logo-abc123.jpg`);
    await set("website", null);
    const r = await db.query<{ website: string | null; contact_email: string }>("select website, contact_email from merchants where id = $1", [IDS.meiMerchant]);
    expect(r.rows[0]).toEqual({ website: null, contact_email: "hello@example.com" });
  });

  it("rejects malformed values", async () => {
    await expect(set("website", "javascript:alert(1)")).rejects.toThrow(/merchants_website_format/);
    await expect(set("website", "ftp://example.com")).rejects.toThrow(/merchants_website_format/);
    await expect(set("website", "https://exa mple.com")).rejects.toThrow(/merchants_website_format/);
    await expect(set("contact_email", "not-an-email")).rejects.toThrow(/merchants_contact_email_format/);
    await expect(set("contact_email", "a@b")).rejects.toThrow(/merchants_contact_email_format/);
    await expect(set("contact_phone", "call me maybe")).rejects.toThrow(/merchants_contact_phone_format/);
    await expect(set("contact_phone", "123")).rejects.toThrow(/merchants_contact_phone_format/);
  });

  it("a logo must live in the merchant's own folder", async () => {
    await expect(set("logo_path", `10000000-0000-0000-0000-000000000002/logo-x.jpg`)).rejects.toThrow(/merchants_logo_path_in_own_folder/);
    await expect(set("logo_path", "logo-x.jpg")).rejects.toThrow(/merchants_logo_path_in_own_folder/);
  });

  it("only the owner can change the profile", async () => {
    const r = await asUser(db, IDS.luisOwner, () => db.query("update merchants set website = 'https://evil.example' where id = $1 returning id", [IDS.meiMerchant]));
    expect(r.rows).toHaveLength(0);
  });
});
