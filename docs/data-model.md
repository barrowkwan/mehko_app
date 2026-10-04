# Data model

Source of truth: `supabase/migrations/*.sql`. Mirror any change in `types/database.ts`.

## Tables

| Table | Purpose | Key columns / constraints |
| --- | --- | --- |
| `profiles` | One per auth user (trigger `handle_new_user`) | `id` = `auth.users.id`, `display_name`, `avatar_url`, `locale` (en/es/zh-CN/zh-TW, null = not chosen yet) |
| `merchants` | A business owned by a user | `owner_id`, `country_code` (holiday lookup), `translations` jsonb (optional name/description per language) |
| `pickup_points` | Merchant's pickup locations (many) | `lat`, `lng`, `timezone` (IANA), `active` |
| `food_items` | Merchant's menu | `active`, `price_cents` (unused until payments), `translations` jsonb (optional name/description per language) |
| `offerings` | A sale event: one pickup point on one date | `pickup_date`, `pickup_start/end`, `cutoff_at`, `status` draft/published/closed. Trigger `check_offering_schedule`: cutoff ≤ pickup start in the point's timezone |
| `offering_items` | Foods in an offering | `quantity_limit` (null = unlimited), unique (offering, food) |
| `orders` | A customer's order on an offering | `status` placed/cancelled/picked_up, `qr_token` (unique), `picked_up_at`, `payment_status` (default `'none'`), `payment_ref`. **Partial unique** index: one non-cancelled order per (customer, offering) |
| `order_items` | Lines of an order | PK (order, offering_item), `qty > 0` |
| `location_shares` | Merchant live location, one row per offering | `lat`, `lng`, `active`, `updated_at`; in Realtime publication |
| `offering_context` | Weather + holiday snapshot per offering | `weather_bucket` (clear/cloudy/rain/snow/hot/cold), `temp_max_c`, `precip_mm`, `is_holiday`, `holiday_name` |

View: `order_lines` (`security_invoker`) — one row per ordered item with merchant, date, pickup point, food, qty, customer, holiday and weather. Excludes cancelled orders. Feeds reports.

## RPCs (all `security definer`, `authenticated` only)

| Function | Rule enforced |
| --- | --- |
| `place_order(offering, items jsonb)` | Offering published; `now() < cutoff_at`; stock; one active order |
| `update_order(order, items jsonb)` | Own order, status `placed`, before cutoff; stock (excluding own lines) |
| `cancel_order(order)` | Own order, `placed`, before cutoff |
| `confirm_pickup(token)` | Token's offering belongs to caller's merchant; not cancelled; idempotent (returns `already_picked_up`) |
| `offering_stock(offering)` | Remaining quantity for limited items (customers can't read others' orders) |

`items` = `[{"offering_item_id": "<uuid>", "qty": <int>}]`. Helpers: `is_merchant_owner`, `offering_merchant`, `has_order_on`, `can_share_location`, internal `_write_order_items`.

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
