export type HealthResult = { ok: boolean; reason?: string; ms: number };

// Can we run a tiny query against Supabase with our public key? Uses a real table (RLS makes it return an
// empty list for anonymous callers) because hosted Supabase rejects the REST root for non-service keys.
// Also catches a paused free-tier project (request fails or 5xx) and a broken key (401/403).
// Never exposes the URL or key.
export async function checkSupabase(opts: {
  url: string | undefined;
  key: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<HealthResult> {
  const started = Date.now();
  const { url, key, fetchImpl = fetch, timeoutMs = 4000 } = opts;
  if (!url || !key) return { ok: false, reason: "not-configured", ms: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key },
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok ? { ok: true, ms: Date.now() - started } : { ok: false, reason: `http-${res.status}`, ms: Date.now() - started };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "unreachable", ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
