import { describe, expect, it, vi } from "vitest";
import { SendError, createDryRunSender, createResendSender, senderFromEnv } from "../notifications/provider";

const email = {
  from: "Neighborhood Eats <orders@example.com>",
  to: "nina@example.org",
  subject: "Order confirmed",
  html: "<p>hi</p>",
  text: "hi",
  replyTo: "help@example.com",
  headers: { "List-Unsubscribe": "<https://x.test/u>" },
  idempotencyKey: "row-1",
};
const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe("Resend sender", () => {
  it("posts the email to the Resend API with the key, an idempotency key, and returns the message id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { id: "msg_123" }));
    const sender = createResendSender("re_test_key", fetchImpl as unknown as typeof fetch);
    expect(await sender.send(email)).toEqual({ id: "msg_123" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(init.headers["Idempotency-Key"]).toBe("row-1");
    expect(JSON.parse(init.body)).toEqual({
      from: email.from, to: ["nina@example.org"], subject: "Order confirmed", html: "<p>hi</p>", text: "hi",
      reply_to: "help@example.com", headers: { "List-Unsubscribe": "<https://x.test/u>" },
    });
  });

  it("marks rate limits, server errors and network failures as retryable, other client errors as permanent", async () => {
    for (const [status, retryable] of [[429, true], [500, true], [503, true], [400, false], [401, false], [403, false], [422, false]] as const) {
      const sender = createResendSender("k", (async () => res(status, { message: "nope" })) as unknown as typeof fetch);
      const err = await sender.send(email).catch((e) => e);
      expect(err, String(status)).toBeInstanceOf(SendError);
      expect((err as SendError).retryable, String(status)).toBe(retryable);
    }
    const down = createResendSender("k", (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch);
    const err = (await down.send(email).catch((e) => e)) as SendError;
    expect(err).toBeInstanceOf(SendError);
    expect(err.retryable).toBe(true);
  });

  it("never leaks the API key in an error message", async () => {
    const sender = createResendSender("re_SUPER_SECRET_KEY", (async () => res(401, { message: "Invalid API key re_SUPER_SECRET_KEY" })) as unknown as typeof fetch);
    const err = (await sender.send(email).catch((e) => e)) as SendError;
    expect(err.message).not.toContain("re_SUPER_SECRET_KEY");
  });
});

describe("dry-run sender", () => {
  it("only logs (no recipient addresses beyond a masked form) and never touches the network", async () => {
    const log = vi.fn();
    const r = await createDryRunSender(log).send(email);
    expect(r.id).toMatch(/^dry-run-/);
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("Order confirmed");
    expect(logged).not.toContain("nina@example.org");
    expect(logged).toContain("n***@example.org");
  });
});

describe("senderFromEnv", () => {
  it("is off by default and when explicitly off", () => {
    expect(senderFromEnv({})).toBeNull();
    expect(senderFromEnv({ NOTIFICATIONS_PROVIDER: "off" })).toBeNull();
  });
  it("supports dry-run with a placeholder sender address", () => {
    const c = senderFromEnv({ NOTIFICATIONS_PROVIDER: "dry-run" })!;
    expect(c.sender.name).toBe("dry-run");
    expect(c.from).toContain("@");
  });
  it("builds Resend from the key and sender address, and refuses incomplete config", () => {
    const c = senderFromEnv({ NOTIFICATIONS_PROVIDER: "resend", EMAIL_API_KEY: "re_x", EMAIL_FROM: "Eats <orders@example.com>", EMAIL_REPLY_TO: "help@example.com" })!;
    expect(c.sender.name).toBe("resend");
    expect(c.from).toBe("Eats <orders@example.com>");
    expect(c.replyTo).toBe("help@example.com");
    expect(() => senderFromEnv({ NOTIFICATIONS_PROVIDER: "resend", EMAIL_FROM: "x@y.z" })).toThrow(/EMAIL_API_KEY/);
    expect(() => senderFromEnv({ NOTIFICATIONS_PROVIDER: "resend", EMAIL_API_KEY: "k" })).toThrow(/EMAIL_FROM/);
    expect(() => senderFromEnv({ NOTIFICATIONS_PROVIDER: "carrier-pigeon" })).toThrow(/NOTIFICATIONS_PROVIDER/);
  });
});
