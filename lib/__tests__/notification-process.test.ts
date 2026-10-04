import { describe, expect, it, vi } from "vitest";
import { processOutbox, type Store } from "../notifications/process";
import { SendError, type Email, type Sender } from "../notifications/provider";
import type { Loaded, OutboxRow } from "../notifications/types";

const NOW = new Date("2026-10-08T12:00:00Z");
const SECRET = "unit-test-secret-0123456789abcdef";
const row = (id: string, over: Partial<OutboxRow> = {}): OutboxRow => ({ id, user_id: `00000000-0000-0000-0000-00000000000${id.slice(-1)}`, type: "order_confirmed", entity_id: "e-" + id, attempts: 1, ...over });

const content = {
  type: "order_confirmed" as const,
  data: {
    recipientName: "Nina", merchantName: "Mei", items: [{ name: "Dumplings", qty: 2 }], pickupDate: "2026-10-09", pickupStart: "17:00", pickupEnd: "19:00",
    timezone: "UTC", pickupPoint: { name: "Park", address: null }, cutoffAt: "2026-10-08T20:00:00Z", instructions: null, orderUrl: "https://eats.example.com/orders/1", orderNo: "m00001-00000001",
  },
};
const loaded = (over: Partial<{ email: string | null; wantsEmail: boolean; locale: "en" | "es" }> = {}): Loaded => ({
  recipient: { email: "nina@example.org", name: "Nina", locale: "en", wantsEmail: true, ...over },
  content,
});

function setup(rows: OutboxRow[], loadFor: (r: OutboxRow) => Loaded | Promise<Loaded> = () => loaded(), sentToday = 0) {
  const calls: string[] = [];
  const store: Store = {
    enqueueDue: vi.fn(async () => void calls.push("enqueue")),
    claim: vi.fn(async (limit: number) => { calls.push(`claim:${limit}`); return rows; }),
    load: vi.fn(async (r: OutboxRow) => loadFor(r)),
    sentToday: vi.fn(async () => sentToday),
    markSent: vi.fn(async () => {}),
    markSkipped: vi.fn(async () => {}),
    markRetry: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
  };
  const sent: Email[] = [];
  const sender: Sender = { name: "resend", send: vi.fn(async (e: Email) => { sent.push(e); return { id: "msg_" + sent.length }; }) };
  const run = (over: Record<string, unknown> = {}) =>
    processOutbox({
      store, sender, from: "Eats <orders@example.com>", replyTo: null, siteUrl: "https://eats.example.com", unsubscribeSecret: SECRET,
      loadMessages: async (l) => (await import(`../../messages/${l}.json`)).default, now: () => NOW, limit: 10, ...over,
    });
  return { store, sender, sent, calls, run };
}

describe("processOutbox", () => {
  it("queues time-based notifications first, then claims up to the limit and sends", async () => {
    const t = setup([row("n1")]);
    const result = await t.run({ limit: 7 });
    expect(t.calls).toEqual(["enqueue", "claim:7"]);
    expect(result).toEqual({ sent: 1, skipped: 0, retried: 0, failed: 0 });
    expect(t.store.markSent).toHaveBeenCalledWith("n1", "msg_1");
  });

  it("sends a rendered, localized email with unsubscribe headers and an idempotency key", async () => {
    const es = setup([row("n2")], () => loaded({ locale: "es" }));
    await es.run();
    const e = es.sent[0];
    expect(e.to).toBe("nina@example.org");
    expect(e.from).toBe("Eats <orders@example.com>");
    expect(e.subject).toContain("Pedido confirmado");
    expect(e.idempotencyKey).toBe("n2");
    expect(e.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const url = /<(https:\/\/eats\.example\.com\/api\/unsubscribe\?token=[^>]+)>/.exec(e.headers?.["List-Unsubscribe"] ?? "")?.[1];
    expect(url).toBeTruthy();
    expect(e.html).toContain("https://eats.example.com/unsubscribe?token=");
  });

  it("skips (and records why) users without an email, with notifications off, and over the daily cap", async () => {
    const t = setup([row("a1"), row("a2"), row("a3")], (r) => (r.id === "a1" ? loaded({ email: null }) : r.id === "a2" ? loaded({ wantsEmail: false }) : loaded()), 0);
    const result = await t.run();
    expect(result).toEqual({ sent: 1, skipped: 2, retried: 0, failed: 0 });
    expect(t.store.markSkipped).toHaveBeenCalledWith("a1", "no_email");
    expect(t.store.markSkipped).toHaveBeenCalledWith("a2", "unsubscribed");

    const capped = setup([row("c1")], () => loaded(), 25);
    expect(await capped.run()).toEqual({ sent: 0, skipped: 1, retried: 0, failed: 0 });
    expect(capped.store.markSkipped).toHaveBeenCalledWith("c1", "daily_cap");
    expect(capped.sender.send).not.toHaveBeenCalled();
  });

  it("skips rows whose order/offering no longer exists or changed state (store says so)", async () => {
    const t = setup([row("g1")], () => ({ skip: "order_cancelled" }));
    expect(await t.run()).toEqual({ sent: 0, skipped: 1, retried: 0, failed: 0 });
    expect(t.store.markSkipped).toHaveBeenCalledWith("g1", "order_cancelled");
  });

  it("retries a temporary failure with exponential back-off, and gives up after 5 attempts", async () => {
    const flaky = setup([row("r1", { attempts: 1 }), row("r2", { attempts: 3 }), row("r3", { attempts: 5 })]);
    (flaky.sender.send as ReturnType<typeof vi.fn>).mockRejectedValue(new SendError("busy", true));
    const result = await flaky.run();
    expect(result).toEqual({ sent: 0, skipped: 0, retried: 2, failed: 1 });
    const dueFor = (id: string) => (flaky.store.markRetry as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === id)![2] as Date;
    expect(dueFor("r1").getTime() - NOW.getTime()).toBe(4 * 60_000); // 2^1 * 2 min
    expect(dueFor("r2").getTime() - NOW.getTime()).toBe(16 * 60_000); // 2^3 * 2 min
    expect(flaky.store.markFailed).toHaveBeenCalledWith("r3", expect.stringContaining("busy"));
  });

  it("fails permanently on a non-retryable error", async () => {
    const t = setup([row("p1")]);
    (t.sender.send as ReturnType<typeof vi.fn>).mockRejectedValue(new SendError("domain not verified", false));
    expect(await t.run()).toEqual({ sent: 0, skipped: 0, retried: 0, failed: 1 });
    expect(t.store.markFailed).toHaveBeenCalledWith("p1", expect.stringContaining("domain not verified"));
    expect(t.store.markRetry).not.toHaveBeenCalled();
  });

  it("one bad row never stops the others (loader errors become retries)", async () => {
    const t = setup([row("x1"), row("x2"), row("x3")], (r) => {
      if (r.id === "x1") throw new Error("database hiccup");
      return loaded();
    });
    const result = await t.run();
    expect(result).toEqual({ sent: 2, skipped: 0, retried: 1, failed: 0 });
    expect(t.store.markRetry).toHaveBeenCalledWith("x1", expect.stringContaining("database hiccup"), expect.any(Date));
  });

  it("returns zeros and sends nothing when there is nothing due", async () => {
    const t = setup([]);
    expect(await t.run()).toEqual({ sent: 0, skipped: 0, retried: 0, failed: 0 });
    expect(t.sender.send).not.toHaveBeenCalled();
  });

  it("truncates stored error text", async () => {
    const t = setup([row("e1", { attempts: 5 })]);
    (t.sender.send as ReturnType<typeof vi.fn>).mockRejectedValue(new SendError("x".repeat(2000), false));
    await t.run();
    const stored = (t.store.markFailed as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(stored.length).toBeLessThanOrEqual(300);
  });
});
