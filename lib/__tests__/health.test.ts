import { describe, expect, it, vi } from "vitest";
import { checkSupabase } from "../health";

const base = { url: "https://abc.supabase.co", key: "anon-key" };
const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

describe("checkSupabase", () => {
  it("is ok when the table query answers 2xx, and calls it with the key only in the apikey header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200));
    const r = await checkSupabase({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    // A real (RLS-protected, so empty for anonymous callers) table query. Hosted Supabase refuses the REST
    // root (/rest/v1/) for anything but the service_role key, so the root can't be used as a health probe.
    expect(url).toBe("https://abc.supabase.co/rest/v1/profiles?select=id&limit=1");
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("anon-key");
    // Publishable keys (sb_publishable_…) are not JWTs and must not be sent as a Bearer token.
    expect(headers.Authorization).toBeUndefined();
  });
  it("is not ok on 401/403 (misconfigured key) and 5xx (provider trouble)", async () => {
    for (const status of [401, 403, 500, 503, 404]) {
      const r = await checkSupabase({ ...base, fetchImpl: (async () => res(status)) as unknown as typeof fetch });
      expect(r.ok, String(status)).toBe(false);
      expect(r.reason).toBe(`http-${status}`);
    }
  });
  it("is not ok when the request fails", async () => {
    const r = await checkSupabase({ ...base, fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: false, reason: "unreachable" });
  });
  it("times out instead of hanging", async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch;
    const started = Date.now();
    const r = await checkSupabase({ ...base, fetchImpl: hang, timeoutMs: 50 });
    expect(r).toMatchObject({ ok: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(2000);
  });
  it("reports not-configured without calling the network", async () => {
    const fetchImpl = vi.fn();
    expect(await checkSupabase({ url: "", key: "", fetchImpl: fetchImpl as unknown as typeof fetch })).toMatchObject({ ok: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
