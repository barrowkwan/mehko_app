import type { Locale } from "../locale";
import { renderEmail } from "./templates";
import { SendError, type Sender } from "./provider";
import type { Loaded, OutboxRow } from "./types";
import { signUnsubscribeToken } from "./unsubscribe";

// The sender loop, independent of Supabase and of the email provider so it can be unit-tested with fakes.

export const MAX_ATTEMPTS = 5;
export const DAILY_CAP_PER_USER = 20;

export type Store = {
  enqueueDue(): Promise<void>; // time-based producers (pickup reminders, cutoff summaries)
  claim(limit: number): Promise<OutboxRow[]>;
  load(row: OutboxRow): Promise<Loaded>;
  sentToday(userId: string): Promise<number>;
  markSent(id: string, providerId: string | null): Promise<void>;
  markSkipped(id: string, reason: string): Promise<void>;
  markRetry(id: string, error: string, dueAt: Date): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
};

export type ProcessResult = { sent: number; skipped: number; retried: number; failed: number };

export async function processOutbox(opts: {
  store: Store;
  sender: Sender;
  from: string;
  replyTo: string | null;
  siteUrl: string;
  unsubscribeSecret: string;
  loadMessages: (locale: Locale) => Promise<Record<string, unknown>>;
  now?: () => Date;
  limit?: number;
}): Promise<ProcessResult> {
  const { store, sender, from, replyTo, siteUrl, unsubscribeSecret, loadMessages } = opts;
  const now = opts.now ?? (() => new Date());
  const result: ProcessResult = { sent: 0, skipped: 0, retried: 0, failed: 0 };

  await store.enqueueDue();
  const rows = await store.claim(opts.limit ?? 20);

  for (const row of rows) {
    try {
      const loaded = await store.load(row);
      if ("skip" in loaded) {
        await store.markSkipped(row.id, loaded.skip);
        result.skipped++;
        continue;
      }
      const { recipient, content } = loaded;
      if (!recipient.email) {
        await store.markSkipped(row.id, "no_email");
        result.skipped++;
        continue;
      }
      if (!recipient.wantsEmail) {
        await store.markSkipped(row.id, "unsubscribed");
        result.skipped++;
        continue;
      }
      if ((await store.sentToday(row.user_id)) >= DAILY_CAP_PER_USER) {
        await store.markSkipped(row.id, "daily_cap");
        result.skipped++;
        continue;
      }

      const token = signUnsubscribeToken(row.user_id, unsubscribeSecret);
      const rendered = renderEmail({
        ...content,
        locale: recipient.locale,
        messages: await loadMessages(recipient.locale),
        unsubscribeUrl: `${siteUrl}/unsubscribe?token=${token}`,
        site: new URL(siteUrl).host,
      });
      const { id } = await sender.send({
        from,
        to: recipient.email,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: row.id,
        headers: {
          "List-Unsubscribe": `<${siteUrl}/api/unsubscribe?token=${token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await store.markSent(row.id, id);
      result.sent++;
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      const retryable = e instanceof SendError ? e.retryable : true;
      if (retryable && row.attempts < MAX_ATTEMPTS) {
        await store.markRetry(row.id, message, new Date(now().getTime() + 2 ** row.attempts * 2 * 60_000));
        result.retried++;
      } else {
        await store.markFailed(row.id, message);
        result.failed++;
      }
    }
  }
  return result;
}
