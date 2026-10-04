# Todo (waiting on a person)

Things that are **not code work for Claude**: they need you, a native speaker, a lawyer or an account/device. Code ideas live in [roadmap.md](roadmap.md). Move an item to the roadmap/plan when it turns into implementation work.

## Open

**Check the Facebook preview (FEAT-14):** after the deploy, open an offering → Share → turn on "Share publicly" → copy the link → paste it into [Facebook's Sharing Debugger](https://developers.facebook.com/tools/debug/) and press Debug / Scrape again: you should see the merchant, foods, pickup times and a photo. Then try a real post draft and the WhatsApp/Messages preview.

**Do this to turn on place search for pickup points (FEAT-10b):** create a free account at geoapify.com → Projects → your project → copy the API key → in Render add `GEOAPIFY_API_KEY` (Environment) → redeploy (no rebuild needed; it is read at runtime). Until then the search box is hidden and merchants use the map. Free plan: 3,000 searches/day; keep the "Powered by Geoapify" credit.

| ID | What | Who / what's needed | Notes |
| --- | --- | --- | --- |
| QA-3 | Native-speaker review of translations (es, zh-CN, zh-TW) | A native speaker | Spanish and both Chinese catalogs were AI-drafted. Prioritise cutoff / pickup / QR wording and the **email** texts (`email` namespace). Strings are in `messages/*.json`; send the reviewer the file or a table of key → text. Keep ICU `{placeholders}`, plural forms and `<tags>` intact. |
| SEC-9 | Record acceptance of the Terms (checkbox for merchants incl. "I hold the licences my food business needs"; first-login prompt for customers; `terms_accepted_at` + `terms_version`) | Legal review decides the wording and whether it is needed | Today acceptance is implied ("By continuing you agree…"). Brief: [legal-review-brief.md](legal-review-brief.md) §7, Terms Q4. Implementation is S–M once wording is settled. |
| QA-2 | Real-device check (iOS Safari, Android Chrome) | You, with a phone | Step-by-step: [qa-real-device.md](qa-real-device.md) |
| OPS-1 | Test-restore a backup into a throw-away Supabase project | You (needs a spare project) | Before the first real merchants, no later than the first mobile beta. [backup-restore.md](backup-restore.md) |
| SEC-1 | Legal review of privacy policy and terms | A lawyer | [legal-review-brief.md](legal-review-brief.md) |
| SEC-7 | Login provider go-live (Google Publish, Facebook Live, Apple) | You (provider consoles, $99 Apple) | [social-login-setup.md](social-login-setup.md) |
| MOB | Mobile spike week prerequisites | You (Mac: simulator runtime, Android SDK PATH, Expo account) | [plans/mobile-native-expo.md](plans/mobile-native-expo.md) |
| NOTIF-1 | Confirm a real order email arrives | You | After the first test order with `NOTIFICATIONS_PROVIDER=resend`. |
