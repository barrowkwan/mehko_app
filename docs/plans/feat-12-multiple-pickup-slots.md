# FEAT-12 · Several pickup slots per offering

**Status:** Done (2026-10-04). Migration `20261011000000_multiple_pickup_slots.sql`.
**Roadmap items:** FEAT-12 (new, from the merchant's feedback)   **Size:** M–L

## Goal
A merchant can offer the same foods at more than one pickup point and/or time in one offering. A customer picks one slot per order and can move the order to another slot until the cutoff.

## Decisions (product owner)
- **All slots of an offering are on the same date** (different points and/or times; the same point may repeat at another time). Added after the first release (migration `20261012000000_slots_same_date.sql`): the date is a shared part, so moving it moves every upcoming slot. Other days = separate offerings.
- **One cutoff** for the whole offering. **Food limits are shared** across all slots (one pool). **One slot per order**; another slot = another order.

## Design: a slot is an offering row
Slots of one offering are ordinary `offerings` rows that share a `group_id` (null = a normal single-slot offering). Orders, QR codes, prep lists, reports, emails/reminders, live location and account deletion therefore keep working **per slot** with no change.
- `offering_pool(item)` = the same food's `offering_items` across the group. `_write_order_items`, `offering_stock` and the "limit below ordered" trigger count the whole pool.
- `add_offering_slot(offering, point, date, start, end)` copies cutoff, status, instructions, translations, foods and limits into a new sibling (assigning the group on first use).
- `update_offering` keeps the shared parts (cutoff, instructions, translations, foods, limits) in sync on the other upcoming slots, atomically; point/date/time stay per slot.
- `change_order_slot(order, offering)`: same group, published, before the cutoff, quantities carried over; stock cannot run out because it is pooled.
- Status (draft/published/closed) stays **per slot**, so one full slot can be closed while the others stay open.

## UI
- Merchant "New offering": "Add a pickup slot" (repeatable). Offering page: "Pickup slots" list + "Add a pickup slot".
- Customer home: one card per offering with "N pickup options"; offering page lists the other slots; order page has "Change pickup slot".

## Known limits / follow-ups
- "Duplicate to a new date" copies one slot, not the group.
- Deleting or closing is per slot; shared edits do not reach past slots.
- Editing a slot's own point/date/time is done on that slot's edit page.

## Tests
`tests/db/pickup-slots.test.ts` (copying, shared stock, sync, moving orders, refusals, visibility); e2e: merchant creates two slots, customer orders and moves.
