# FEAT-3 · Order notes and pickup instructions

**Status:** Implemented 2026-10-04 — verifying after deploy (migration by CI, then your manual check below)
**Roadmap items:** FEAT-3   **Size:** S–M   **Owner:** Claude + product owner

## Goal
Customers can tell the merchant what matters ("nut allergy", "no onions"); merchants can tell customers where and how to find them ("north gate, red tent"). Allergy information must not get lost.

## Design decisions
| Topic | Decision | Why |
| --- | --- | --- |
| Order note | `orders.note`, optional, ≤ 300 chars, trimmed, blank = none. Set when ordering, **editable until the cutoff** with the order (same rule as items) | Special requests are part of the order; frozen at cutoff so the merchant can rely on them |
| Visibility | The customer and the merchant of that offering only (existing order RLS) | Allergy/health information is sensitive |
| Pickup instructions | `offerings.instructions`, optional, ≤ 500 chars, set in the offering form, **copied by "Repeat on another date"** | Instructions rarely change week to week |
| Instruction translations | `offerings.translations` jsonb (`{es:{instructions}}`), same pattern and fallback as foods/merchants | Customers read it in their language |
| API compatibility | New function parameters are **optional with defaults**: `place_order(.., p_note default null)`, `update_order(.., p_note default null)` where **null = leave unchanged**, `''` clears; `update_offering(.., p_instructions default null, p_translations default null)` null = unchanged | Old clients (and the web version still running during a deploy) keep working; no accidental erasing |
| Merchant surface | Offering page: a **"Customer notes"** box above the order list so allergy notes can't be missed, and the note under each order | The prep list is the screen merchants cook from |
| Customer surface | Instructions shown on the offering page and prominently on the order page next to the QR code | The pickup moment is when they need it |
| Privacy | Policy and review brief updated: free-text notes may contain health information (allergies) | Honest disclosure; legal review should look at it |

## Scope
- In: migration, error mapping, offering form (instructions + translations), order form note, merchant + customer display, translations (4 languages), privacy text, tests, docs.
- Out (roadmap): structured allergen tags, per-item notes, merchant replies/chat, notifying the merchant of note edits (NOTIF-1).

## Platform split
- **Shared:** migration, messages, error mapping.
- **Web:** form fields and displays.
- **Mobile:** later (same functions).

## Tasks
- [x] DB tests first (`tests/db/order-notes.test.ts`), then the migration
- [x] Error mapping + messages (4 languages)
- [x] Actions + forms: order note (new/edit), instructions (+ translations) in offering form, duplicate copies them
- [x] Display: customer notes box + per-order note (merchant), instructions (customer: offering + order pages)
- [x] Privacy policy (4 languages), legal review brief
- [x] Live integration test, end-to-end in the running app
- [x] Docs, roadmap; deploy and verify

## Manual check on the live site
1. Merchant: open an offering → **Edit** → fill **Pickup instructions** (and a translation) → Save.
2. Customer (another account/browser, or the same one on a different offering): the instructions appear on the offering page; place an order with a **note** ("no nuts"); the order page shows the instructions box next to the QR code and the note, which you can edit until the cutoff.
3. Merchant: the offering page shows a yellow **Customer notes** box at the top and the note under that order. Repeat on another date → the copy keeps the instructions.

## Rollout notes
Adds nullable columns and replaces three functions with backward-compatible versions (same name, extra optional parameters). Migrations run before the new web version starts; the previous version keeps working.
