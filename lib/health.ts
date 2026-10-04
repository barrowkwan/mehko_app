export type HealthResult = { ok: boolean; reason?: string; ms: number };

// Is the Supabase REST API reachable with our key? Also catches a paused free-tier project
// (the request fails or returns 5xx) and a broken key (401/403). Never exposes the URL or key.
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
    const res = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/`, {
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
