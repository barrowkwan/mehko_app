import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";
import { isLocale, localized, type Locale } from "../locale";
import type { Line } from "./templates";
import type { Store } from "./process";
import type { Loaded, OutboxRow } from "./types";

// The real outbox store: reads and writes with the service-role client (the outbox and its functions are not
// reachable by signed-in users) and builds each email's content from live data at send time.

type Admin = SupabaseClient<Database>;
const DAY_MS = 86_400_000;

export function createSupabaseStore(admin: Admin, siteUrl: string): Store {
  const must = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };

  async function recipient(userId: string) {
    const profile = must(await admin.from("profiles").select("display_name, locale, email_notifications").eq("id", userId).maybeSingle());
    if (!profile) return null;
    const { data } = await admin.auth.admin.getUserById(userId);
    return {
      email: data?.user?.email ?? null,
      name: profile.display_name,
      locale: (isLocale(profile.locale) ? profile.locale : "en") as Locale,
      wantsEmail: profile.email_notifications,
    };
  }

  return {
    async enqueueDue() {
      must(await admin.rpc("enqueue_due_notifications"));
    },

    async claim(limit) {
      return must(await admin.rpc("claim_notifications", { p_limit: limit })) as unknown as OutboxRow[];
    },

    async load(row): Promise<Loaded> {
      const who = await recipient(row.user_id);
      if (!who) return { skip: "no_profile" };
      const { locale } = who;

      if (row.type === "merchant_cutoff_summary") {
        const o = must(
          await admin
            .from("offerings")
            .select(
              `id, pickup_date, pickup_start, pickup_end,
               merchant:merchants(name, translations),
               pickup_point:pickup_points(name, address, timezone),
               offering_items(id, food_item:food_items(name, translations)),
               orders(id, status, note, customer:profiles(display_name), order_items(offering_item_id, qty))`,
            )
            .eq("id", row.entity_id)
            .maybeSingle(),
        );
        if (!o || !o.merchant || !o.pickup_point) return { skip: "offering_gone" };
        const active = o.orders.filter((x) => x.status !== "cancelled");
        if (active.length === 0) return { skip: "no_orders" };
        const names = new Map(o.offering_items.map((i) => [i.id, i.food_item ? localized(i.food_item.name, i.food_item.translations, locale, "name") : "?"]));
        const totals = new Map<string, number>();
        const orders = active.map((x) => {
          const items: Line[] = x.order_items.map((i) => ({ name: names.get(i.offering_item_id) ?? "?", qty: i.qty }));
          for (const i of items) totals.set(i.name, (totals.get(i.name) ?? 0) + i.qty);
          return { customerName: x.customer?.display_name ?? "?", items, note: x.note };
        });
        return {
          recipient: who,
          content: {
            type: "merchant_cutoff_summary",
            data: {
              merchantName: localized(o.merchant.name, o.merchant.translations, locale, "name"),
              pickupDate: o.pickup_date,
              pickupStart: o.pickup_start,
              pickupEnd: o.pickup_end,
              timezone: o.pickup_point.timezone,
              pickupPoint: { name: o.pickup_point.name, address: o.pickup_point.address },
              totals: [...totals].map(([name, qty]) => ({ name, qty })),
              orders,
              offeringUrl: `${siteUrl}/merchant/offerings/${o.id}`,
            },
          },
        };
      }

      // order_confirmed / pickup_reminder
      const order = must(
        await admin
          .from("orders")
          .select(
            `id, order_no, status,
             offering:offerings(pickup_date, pickup_start, pickup_end, cutoff_at, instructions, translations,
               merchant:merchants(name, translations),
               pickup_point:pickup_points(name, address, timezone),
               offering_items(id, food_item:food_items(name, translations))),
             order_items(offering_item_id, qty, unit_price_cents)`,
          )
          .eq("id", row.entity_id)
          .maybeSingle(),
      );
      if (!order || !order.offering?.merchant || !order.offering.pickup_point) return { skip: "order_gone" };
      if (order.status === "cancelled") return { skip: "order_cancelled" };
      if (row.type === "pickup_reminder" && order.status !== "placed") return { skip: "order_not_active" };

      const o = order.offering;
      const names = new Map(o.offering_items.map((i) => [i.id, i.food_item ? localized(i.food_item.name, i.food_item.translations, locale, "name") : "?"]));
      return {
        recipient: who,
        content: {
          type: row.type,
          data: {
            orderNo: order.order_no,
            recipientName: who.name,
            merchantName: localized(o.merchant!.name, o.merchant!.translations, locale, "name"),
            items: order.order_items.map((i) => ({ name: names.get(i.offering_item_id) ?? "?", qty: i.qty, unitPriceCents: i.unit_price_cents })),
            pickupDate: o.pickup_date,
            pickupStart: o.pickup_start,
            pickupEnd: o.pickup_end,
            timezone: o.pickup_point!.timezone,
            pickupPoint: { name: o.pickup_point!.name, address: o.pickup_point!.address },
            cutoffAt: o.cutoff_at,
            instructions: o.instructions ? localized(o.instructions, o.translations, locale, "instructions") : null,
            orderUrl: `${siteUrl}/orders/${order.id}`,
          },
        },
      };
    },

    async sentToday(userId) {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      const { count } = await admin.from("notification_outbox").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "sent").gte("sent_at", since);
      return count ?? 0;
    },

    async markSent(id, providerId) {
      must(await admin.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: providerId ? `sent:${providerId}` : null }).eq("id", id));
    },
    async markSkipped(id, reason) {
      must(await admin.from("notification_outbox").update({ status: "skipped", last_error: reason }).eq("id", id));
    },
    async markRetry(id, error, dueAt) {
      must(await admin.from("notification_outbox").update({ status: "pending", due_at: dueAt.toISOString(), last_error: error }).eq("id", id));
    },
    async markFailed(id, error) {
      must(await admin.from("notification_outbox").update({ status: "failed", last_error: error }).eq("id", id));
    },
  };
}
