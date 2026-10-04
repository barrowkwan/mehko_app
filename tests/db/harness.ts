import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = join(__dirname, "../..");

// Minimal stand-in for the parts of Supabase the migration depends on:
// the auth schema (users, auth.uid()), the anon/authenticated roles and the realtime publication.
const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text,
    raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  create publication supabase_realtime;

  -- Stand-ins for Supabase Storage (buckets, objects, the foldername helper) so storage policies can be tested.
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to anon, authenticated;
`;

export const IDS = {
  meiOwner: "00000000-0000-0000-0000-0000000000a1",
  luisOwner: "00000000-0000-0000-0000-0000000000a2",
  customer: "00000000-0000-0000-0000-0000000000c1",
  customer2: "00000000-0000-0000-0000-0000000000c2",
  meiMerchant: "10000000-0000-0000-0000-000000000001",
  meiPoint: "20000000-0000-0000-0000-000000000001",
  meiOffering: "40000000-0000-0000-0000-000000000001",
  luisOffering: "40000000-0000-0000-0000-000000000002",
  porkFood: "30000000-0000-0000-0000-000000000001",
};

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);

  const dir = join(root, "supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));

  // Supabase grants these by default; RLS then decides what is visible.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on all tables in schema public to anon;
  `);
  await db.exec(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data)
    values ('${IDS.customer2}', 'c2@example.com', '{"full_name":"Pat Second"}');
  `);
  return db;
}

// Runs fn as the given signed-in user (RLS applies), then restores the superuser.
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function itemId(db: PGlite, offering: string, food: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    "select id from offering_items where offering_id = $1 and food_item_id = $2",
    [offering, food],
  );
  return r.rows[0].id;
}
