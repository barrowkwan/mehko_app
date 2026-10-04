# FEAT-1 · Edit, duplicate and delete offerings

**Status:** Done (2026-10-04, commit 1b236ec) — live; migration applied to the hosted database by CI. Remaining: your manual smoke test on the live site (below)
**Roadmap items:** FEAT-1 (+ fixes a data-safety gap found while planning)   **Size:** M   **Owner:** Claude + product owner

## Goal
A merchant can fix a mistake in an offering, repeat last week's menu on a new date in two clicks, and delete an offering that nobody ordered — without ever being able to break customers' orders.

## Why now / context
Merchants could only publish or close an offering. Repeating a weekly menu was the most common wish. While planning I found a **latent bug**: migration `20261005` made `orders.offering_id` `ON DELETE CASCADE` (needed for account deletion) and the existing RLS policy lets an owner `DELETE` an offering, so a merchant could silently wipe other customers' orders through the API. Deletion must be guarded in the database.

## Rules (enforced in the database; the UI mirrors them)
| Case | Rule |
| --- | --- |
| Edit, no orders yet | Everything can change: pickup point, date, times, cutoff, items, limits |
| Edit, **active** orders (`placed`) | Pickup point and date are **locked** (customers rely on where/when). Times, cutoff, items can change |
| Edit, past offering (pickup date over at the pickup point) | Schedule is read-only (status can still change) |
| Remove an item | Blocked if any active order contains it; if only cancelled orders contain it, those lines are cleaned up |
| Lower an item's limit | Blocked below the quantity already ordered (raising/removing the limit is fine) |
| Delete an offering | Only if it has no `placed`/`picked_up` orders (cancelled ones are removed with it). Account deletion is unaffected (it removes orders first) |
| Duplicate | Creates a **draft** copy on a new date: same pickup point, times and items/limits (archived foods skipped); cutoff keeps the same *wall-clock* lead before pickup in the pickup point's timezone (DST-safe). New date can't be in the past. Merchant reviews, then publishes |

## Scope
- In: DB triggers + `update_offering` / `duplicate_offering` RPCs, edit page, Duplicate and Delete on the offering page, translations (4 languages), tests, docs.
- Out (roadmap): editing offerings from the mobile app (MOB), notifying customers of changes (NOTIF-1), bulk repeat ("every Friday").

## Platform split
- **Shared (SQL/messages):** migration `20261006000000_edit_clone_offerings.sql`, `errors.*` messages, `lib/db-errors.ts` mapping.
- **Web:** `/merchant/offerings/[id]/edit`, buttons on `/merchant/offerings/[id]`, actions in `app/merchant/actions.ts`.
- **Mobile:** later (MOB M4) — same RPCs.

## Tasks
- [x] DB tests first (`tests/db/offering-edit.test.ts`), then migration
- [x] Error mapping + messages (4 languages)
- [x] Actions: `updateOffering`, `duplicateOffering`, `deleteOffering`
- [x] Edit page (locked fields when orders exist), Duplicate form, Delete button
- [x] Live integration test (real Supabase), end-to-end check in the running app
- [x] Docs: data-model, features, roadmap, this plan → Done
- [x] `npm test && npm run typecheck && npm run lint && npm run build`

## Verification
DB rules via PGlite; the real auth/RLS path via the live-stack integration test; the web flow by driving the running app's server actions; after deploy confirm the migration applied (CI deploy job).

## Manual smoke test on the live site (needs a real merchant login)
1. Open one of your offerings → **Edit**: values are pre-filled (the cutoff shows in your browser's time zone). Change the end time → Save.
2. If it has orders, the pickup point and date are greyed out with an explanation.
3. **Repeat on another date** → pick a date → a draft copy opens; check the cutoff is the same time of day as the original relative to pickup; publish it.
4. **Delete** an offering with no orders (confirm dialog). One with orders shows "can't be deleted".

## Rollout notes
Migration adds triggers/functions only (no column changes): backward-compatible with the previous app version. Customers' existing orders are unaffected.
