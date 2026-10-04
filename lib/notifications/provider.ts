// Email providers behind one small interface. "dry-run" only logs; "resend" calls Resend's HTTPS API
// (Render's free tier blocks SMTP, so an HTTPS API is the only option there).

export type Email = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

export type Sender = { name: "resend" | "dry-run"; send(email: Email): Promise<{ id: string | null }> };

export class SendError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SendError";
  }
}

export function createResendSender(apiKey: string, fetchImpl: typeof fetch = fetch, baseUrl = "https://api.resend.com"): Sender {
  const redact = (s: string) => (apiKey ? s.split(apiKey).join("[redacted]") : s).slice(0, 200);
  return {
    name: "resend",
    async send(email) {
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/emails`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
          },
          body: JSON.stringify({
            from: email.from,
            to: [email.to],
            subject: email.subject,
            html: email.html,
            text: email.text,
            ...(email.replyTo ? { reply_to: email.replyTo } : {}),
            ...(email.headers ? { headers: email.headers } : {}),
          }),
        });
      } catch (e) {
        throw new SendError(`Could not reach Resend: ${redact(e instanceof Error ? e.message : String(e))}`, true);
      }
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { id: body.id ?? null };
      }
      const detail = redact(await res.text().catch(() => ""));
      // 429 (rate limit) and 5xx are temporary; everything else (bad key, unverified domain, invalid address) is not.
      throw new SendError(`Resend rejected the email (HTTP ${res.status}) ${detail}`.trim(), res.status === 429 || res.status >= 500);
    },
  };
}

const maskEmail = (to: string) => to.replace(/^(.)[^@]*(@.*)$/, "$1***$2");

export function createDryRunSender(log: (...args: unknown[]) => void = console.log): Sender {
  return {
    name: "dry-run",
    async send(email) {
      log(`[email dry-run] to=${maskEmail(email.to)} subject="${email.subject}" (${email.text.length} chars)`);
      return { id: `dry-run-${Math.random().toString(36).slice(2, 10)}` };
    },
  };
}

export type SenderConfig = { sender: Sender; from: string; replyTo: string | null };

// NOTIFICATIONS_PROVIDER: "off" (default) | "dry-run" | "resend" (needs EMAIL_API_KEY and EMAIL_FROM).
export function senderFromEnv(env: Record<string, string | undefined>): SenderConfig | null {
  const provider = (env.NOTIFICATIONS_PROVIDER ?? "off").trim().toLowerCase();
  if (provider === "off" || provider === "") return null;
  const replyTo = env.EMAIL_REPLY_TO?.trim() || null;
  if (provider === "dry-run") {
    return { sender: createDryRunSender(), from: env.EMAIL_FROM?.trim() || "Neighborhood Eats <noreply@example.invalid>", replyTo };
  }
  if (provider === "resend") {
    const key = env.EMAIL_API_KEY?.trim();
    const from = env.EMAIL_FROM?.trim();
    if (!key) throw new Error("NOTIFICATIONS_PROVIDER=resend needs EMAIL_API_KEY");
    if (!from) throw new Error("NOTIFICATIONS_PROVIDER=resend needs EMAIL_FROM (e.g. Neighborhood Eats <orders@yourdomain>)");
    return { sender: createResendSender(key), from, replyTo };
  }
  throw new Error(`Unknown NOTIFICATIONS_PROVIDER "${provider}" (use off, dry-run or resend)`);
}
