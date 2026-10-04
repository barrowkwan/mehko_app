# Data model

Source of truth: `supabase/migrations/*.sql`. Mirror any change in `types/database.ts`.

## Tables

| Table | Purpose | Key columns / constraints |
| --- | --- | --- |
| `profiles` | One per auth user (trigger `handle_new_user`) | `id` = `auth.users.id`, `display_name`, `avatar_url`, `locale` (en/es/zh-CN/zh-TW, null = not chosen yet) |
| `merchants` | A business owned by a user | `owner_id`, `country_code` (holiday lookup), `translations` jsonb (optional name/description per language) |
| `pickup_points` | Merchant's pickup locations (many) | `lat`, `lng`, `timezone` (IANA), `active` |
| `food_items` | Merchant's menu | `active`, `price_cents` (unused until payments), `translations` jsonb (optional name/description per language), `image_path` (photo path in the `food-images` bucket) |
| `offerings` | A sale event: one pickup point on one date | `instructions` (optional pickup instructions ≤500 chars) + `translations` jsonb (`{es:{instructions}}`), `pickup_date`, `pickup_start/end`, `cutoff_at`, `status` draft/published/closed. Trigger `check_offering_schedule`: cutoff ≤ pickup start in the point's timezone |
| `offering_items` | Foods in an offering | `quantity_limit` (null = unlimited), unique (offering, food) |
| `orders` | A customer's order on an offering | `note` (optional, ≤300 chars, trimmed; visible to the customer and that offering's merchant only), `status` placed/cancelled/picked_up, `qr_token` (unique), `picked_up_at`, `payment_status` (default `'none'`), `payment_ref`. **Partial unique** index: one non-cancelled order per (customer, offering) |
| `order_items` | Lines of an order | PK (order, offering_item), `qty > 0` |
| `location_shares` | Merchant live location, one row per offering | `lat`, `lng`, `active`, `updated_at`; in Realtime publication |
| `offering_context` | Weather + holiday snapshot per offering | `weather_bucket` (clear/cloudy/rain/snow/hot/cold), `temp_max_c`, `precip_mm`, `is_holiday`, `holiday_name` |

View: `order_lines` (`security_invoker`) — one row per ordered item with merchant, date, pickup point, food, qty, customer, holiday and weather. Excludes cancelled orders. Feeds reports.

## RPCs (all `security definer`, `authenticated` only)

| Function | Rule enforced |
| --- | --- |
| `place_order(offering, items jsonb, note text default null)` | Offering published; `now() < cutoff_at`; stock; one active order |
| `update_order(order, items jsonb, note text default null)` | Own order, status `placed`, before cutoff; stock (excluding own lines) |
| `update_offering(offering, point, date, start, end, cutoff, items jsonb, instructions text default null, translations jsonb default null)` | Invoker rights, atomic. Owner only (`Offering not found` otherwise). Replaces schedule and items in one call; items = `[{food_item_id, quantity_limit}]`; all-or-nothing, so a rejected change leaves the offering untouched. Subject to the protection triggers below |
| `duplicate_offering(offering, new_date)` | Invoker rights. Owner only. Creates a **draft** copy on `new_date` (not in the past): same pickup point, times, items/limits (archived foods skipped, orders never copied); cutoff keeps the same *wall-clock* lead before pickup in the pickup point's timezone (DST-safe). Returns the new id |
| `account_deletion_blocker()` | Invoker rights (RLS). Returns `'merchant_active_orders'` if the caller owns a merchant with an active (`placed`) order whose pickup date is today or later, else null. Used by the Account page / `deleteAccount` before the auth user is deleted |
| `cancel_order(order)` | Own order, `placed`, before cutoff |
| `confirm_pickup(token)` | Token's offering belongs to caller's merchant; not cancelled; idempotent (returns `already_picked_up`) |
| `offering_stock(offering)` | Remaining quantity for limited items (customers can't read others' orders) |

`items` = `[{"offering_item_id": "<uuid>", "qty": <int>}]`. Helpers: `is_merchant_owner`, `offering_merchant`, `has_order_on`, `can_share_location`, internal `_write_order_items`.

## Food photos (migration `20261007000000_food_photos.sql`)

Storage bucket **`food-images`**: public read, JPEG only, 1 MiB max. Files live at `<merchant_id>/<food_id>-<random>.jpg`; storage RLS (`is_food_image_owner`) lets only that merchant's owner write/list/delete in their own single-level folder (no `..`, no root files, no non-UUID folders). `food_items.image_path` stores the path (not a URL). The browser resizes to ≤1200 px JPEG; the server re-validates (JPEG signature, ≤800 KB) and **strips every metadata segment** (EXIF/GPS, XMP, IPTC, comments — `lib/images.ts`) before uploading with the merchant's own session. Replacing/removing a photo deletes the old file; account deletion removes the merchant's whole folder (`app/account/actions.ts`).

## Offering edit protection (migration `20261006000000_edit_clone_offerings.sql`)

Triggers enforce these for every client: **moving** an offering (pickup point or date) is refused while it has `placed` orders; the **schedule of a past offering** (pickup date over at the pickup point) can't change (status still can); an offering with `placed`/`picked_up` orders **can't be deleted** (cancelled orders go with it — without this guard the `ON DELETE CASCADE` added for account deletion would let an owner wipe other customers' orders through the API); an **item** with active orders can't be removed (only-cancelled lines are cleaned up); an item's **limit** can't drop below the quantity already ordered; an item's food/offering can't be re-pointed. Account deletion still works because it removes orders before offerings (`merchants_delete_offerings_first`).

## Email notifications (migration `20261009000000_email_notifications.sql`)
`profiles.email_notifications` (opt-out) and `notification_outbox` (RLS on, no policies, no grants to anon/authenticated: server only). A trigger enqueues `order_confirmed`; `enqueue_due_notifications()` enqueues `pickup_reminder` and `merchant_cutoff_summary`; `claim_notifications()` hands rows to the sender with `for update skip locked`. Only `service_role` can execute them. Rows are unique per (user, type, entity) so nothing is sent twice.

## Order history visibility (migration `20261010000000_customers_keep_their_offerings.sql`)
`offerings`/`offering_items` are readable while `published`, by the owning merchant, **and by any customer who has an order in that offering** (`has_order_in()`), whatever its status. Without this, closing or un-publishing an offering after pickup blanked the customer's order history and made the order page 404.

## Account deletion

Deleting an `auth.users` row (admin API, see `app/account/actions.ts`) cascades: `profiles` → the user's orders; `merchants` → pickup points, foods, offerings → offering items, orders (and order items), live location, weather snapshot. Two things make this safe (migration `20261005000000_account_deletion.sql`): `orders.offering_id` is `ON DELETE CASCADE`, and trigger `merchants_delete_offerings_first` deletes a merchant's orders then offerings first, because Postgres cascades to foods/pickup points before offerings and the strict foreign keys elsewhere would otherwise reject it. Other customers keep their accounts but lose that merchant's order history. Policy: deletion is blocked while `account_deletion_blocker()` is non-null.

## Row level security summary

| Table | Who can read | Who can write |
| --- | --- | --- |
| `profiles` | self; merchants for their customers | self (update) |
| `merchants`, `pickup_points`, `food_items` | any signed-in user | owner |
| `offerings`, `offering_items` | published to all; all to owner | owner (pickup point and food must belong to same merchant) |
| `orders`, `order_items` | customer (own); merchant (their offerings) | **nobody directly** — RPCs only |
| `location_shares` | owner; customers with a non-cancelled order when `active` | owner, insert only when `can_share_location` (pickup date in point's tz); update may always set `active = false` |
| `offering_context` | any signed-in user | service role only (cron) |

## Adding to the model

New migration file named `YYYYMMDDHHMMSS_description.sql`. Enable RLS on every new table and write policies in the same file. Add tests to `tests/db/schema.test.ts`. See [enhancing.md](enhancing.md#schema-change).
