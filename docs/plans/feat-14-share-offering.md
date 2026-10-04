# FEAT-14 · Share an offering on Facebook / social media

**Status:** Done (2026-10-05). Migration `20261020000000_share_offering.sql`. Manual check pending: paste a link into Facebook's Sharing Debugger ([todo.md](../todo.md)).

## Goal
A merchant promotes an offering without retyping it: one link whose preview shows what is on offer, plus a ready-made post.

## Why a public page
Link-preview robots (Facebook, WhatsApp, X, …) cannot sign in; they read Open Graph tags from the server-rendered HTML. The app redirects anonymous visitors to `/login`, so a normal link previews as a login page.

## Decisions (product owner)
- **Opt-in per offering** (off by default), covering all pickup slots of the offering.
- **Place name only** publicly; the street address is shown only if the merchant ticks "Also show the exact street address publicly" (pickup points can be a home).

## Design
- `/o/<offering_no>?lang=<locale>` (e.g. `/o/m00001-000001?lang=zh-TW`): public, server-rendered, `noindex`; title/description/image as OG + Twitter tags. `lang` is chosen by the merchant (robots have no language); a nested explicit-locale translator renders the page (`createTranslator`).
- Data: SQL function `get_shared_offering(p_offering_no)` (security definer, granted to `anon`) returns a whitelist (merchant name/description/logo/website, slots with place [+address], foods, cutoff, open flag). No coordinates, customers, orders, stock or instructions; `null` unless `offerings.share_public`; drafts hidden. Anonymous roles still cannot read any table.
- `set_offering_sharing(offering, public, address)` (owner only; applies to every slot; `add_offering_slot` copies the flags).
- Preview image: first food photo, else merchant logo, else the app icon. (A generated card is a follow-up; Chinese text in `next/og` needs bundled fonts.)
- Merchant UI (`components/share-section.tsx`, `share-switches.tsx`, `share-tools.tsx`): the opt-in switches, then language picker, link, ready-made post text (`lib/share-text.ts`, pure and tested in 4 languages), Copy link / Copy post text, phone share sheet (Web Share API), Share on Facebook, open public page, and a note about Facebook's Sharing Debugger.
- "Order now" → `/offerings/<slot>`; anonymous visitors are sent to `/login?next=…`.

## Follow-ups
Generated image card (1200×630), QR poster/flyer, Instagram-friendly image download, short links, "share" hint right after publishing.

## Ops note
Render free sleeps when idle and Facebook's crawler gives up fast: keep the uptime monitor pinging (≤5 min) or re-scrape in the Sharing Debugger.
