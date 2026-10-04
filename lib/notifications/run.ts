import { createAdminClient } from "../supabase/admin";
import { isLocale, type Locale } from "../locale";
import { processOutbox, type ProcessResult } from "./process";
import { senderFromEnv } from "./provider";
import { createSupabaseStore } from "./store";

export type RunOutcome = { enabled: false } | { enabled: true; result: ProcessResult };

// Sends whatever is due. Does nothing (and needs no keys) while NOTIFICATIONS_PROVIDER is off.
// Used by the secret-protected cron route and, best effort, right after a web order is placed.
export async function runNotifications(opts: { siteUrl: string; limit?: number }): Promise<RunOutcome> {
  const config = senderFromEnv(process.env);
  if (!config) return { enabled: false };
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is required when email notifications are enabled");

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || opts.siteUrl).replace(/\/$/, "");
  const result = await processOutbox({
    store: createSupabaseStore(createAdminClient(), siteUrl),
    sender: config.sender,
    from: config.from,
    replyTo: config.replyTo,
    siteUrl,
    unsubscribeSecret: secret,
    loadMessages: async (locale: Locale) => (await import(`../../messages/${isLocale(locale) ? locale : "en"}.json`)).default,
    limit: opts.limit,
  });
  return { enabled: true, result };
}
