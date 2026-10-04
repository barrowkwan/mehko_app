# FEAT-2 · Food photos

**Status:** Implemented 2026-10-04 — verifying after deploy (migration applied by CI; manual browser check below)
**Roadmap items:** FEAT-2   **Size:** M   **Owner:** Claude + product owner

## Goal
A merchant can add a photo to each food; customers see it when browsing and ordering.

## Design decisions
| Topic | Decision | Why |
| --- | --- | --- |
| Storage | Supabase Storage bucket `food-images`, **public read**, files under `<merchant_id>/…` | Photos of public listings; unguessable names; no signed-URL plumbing; served via CDN |
| DB | `food_items.image_url` (unused) renamed to **`image_path`** (path in the bucket, not a full URL) | URLs break if the project changes (e.g. restore into a new project); build the URL at render time |
| Who can write | Storage RLS: only the merchant's owner may insert/update/delete under their own `<merchant_id>/` folder | Same ownership model as the rest of the app (`is_merchant_owner`) |
| Upload path | Browser resizes the picture (max 1200 px, JPEG ~0.8) and submits it with the form; the **server action uploads it** with the user's own session | No orphan files when someone abandons a form; RLS applies; no service key |
| **Privacy: hidden metadata** | Phone photos carry **GPS location/EXIF** (a home kitchen!). The browser re-encode removes it, and the server **verifies JPEG and strips every metadata segment (APP1–APP15, comments) again** before storing | Defense in depth: a tampered request can't smuggle a location in |
| Allowed files | JPEG only after conversion; server limit 800 KB; bucket limits `image/jpeg`, 1 MB | Cost + safety; enforced in the database/storage layer, not just the UI |
| Cleanup | Replacing/removing a photo deletes the old file; **account deletion removes the merchant's whole folder** (best effort) | Privacy + free-tier storage (1 GB) |
| Caching | Unique file name per upload, `Cache-Control: 1 year` | Cheap egress; no stale images after replacement |
| Alt text | The food's (localized) name | Accessibility |

## Scope
- In: migration (column rename, bucket, storage policies), pure image helpers (+tests), Foods add/edit upload UI, display on browse/order screens, account-deletion cleanup, translations (4 languages), privacy-policy update, tests, docs.
- Out (roadmap): crop/rotate tools, multiple photos per food, image CDN transforms (paid), photo for merchant profile, native camera capture (mobile app).

## Platform split
- **Shared:** migration, `lib/images.ts` (validation, EXIF strip, path/url helpers), messages.
- **Web:** upload field with preview, display components.
- **Mobile:** later (MOB M4) — same bucket/policies and server rules.

## Tasks
- [x] Unit tests first: `lib/__tests__/images.test.ts` (JPEG check, metadata stripping, validation, paths)
- [x] Migration + regenerate types; live integration tests for storage policies
- [x] Server: upload/replace/remove in `addFood`/`updateFood`; account-deletion cleanup
- [x] UI: `ImageInput` (resize + preview), show photos on browse/order/Foods
- [x] Messages (4 languages) + privacy policy text (4 languages) + `LEGAL_UPDATED`
- [x] End-to-end in the running app (EXIF really removed from the stored bytes)
- [x] Docs, roadmap; deploy and verify

## Verification
Pure logic in vitest; storage RLS/limits against the real local Supabase; full upload flow by posting the real form with a JPEG that contains a fake GPS EXIF block and checking the stored file. **Not testable here:** the in-browser resize (needs a real browser) — manual check steps in the plan after deploy.

## Manual browser check (the in-browser resize can't be tested without a real browser)
1. Merchant → Foods → add a food and choose a **phone photo** (ideally one with location on). A preview appears.
2. Save: the thumbnail shows in the list; open the live ordering page as a customer: the photo shows beside the food.
3. Right-click the photo → open in a new tab → check the file is small (typically 100–300 KB) and ≤1200 px wide. (Optional privacy check: drop it on an EXIF viewer such as exif.tools; there should be no GPS.)
4. Edit the food → pick another photo (the old one is replaced) → tick **Remove photo** → it disappears.
5. Try a **HEIC** photo from an iPhone and a **PNG**: both should work (converted in the browser). A file the browser can't read shows "This picture couldn't be read".

## Rollout notes
Migration: rename column (unused so far), create bucket + policies. Backward compatible with the previous app version. Free-tier limits: 1 GB storage, shared egress.
