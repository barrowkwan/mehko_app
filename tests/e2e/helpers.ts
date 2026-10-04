// Signs test users in without OAuth: password users made with the admin API, then the same session cookies the
// app would set are copied into the browser context.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
export const run = Math.random().toString(36).slice(2, 8);
const created: string[] = [];

export async function createUser(name: string) {
  const email = `${name}-${run}@e2e.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: "e2e-password-123", email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email };
}

export async function removeUsers() {
  for (const id of created) await admin.auth.admin.deleteUser(id);
}

export async function signIn(context: BrowserContext, baseURL: string, email: string) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (all) => all.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: "e2e-password-123" });
  if (error) throw error;
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })));
}
