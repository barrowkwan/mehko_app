# Privacy policy & terms pages

Public pages (no login) in all four languages: **`/privacy`** and **`/terms`**, linked from the footer of every page and from the login screen ("By continuing you agree to…").

> **Not legal advice.** The text was drafted by an AI model from what the app actually does (data, providers, location sharing, deletion). Before relying on it — especially before going public in the app stores — have it reviewed by a qualified person for your jurisdiction. Spanish and Chinese versions also need a native-speaker read (see roadmap QA-3).

## Before you publish (required setup)
Set these in **Render → mehko-app → Environment** (they are inlined at **build time**, so choose *Save, rebuild and deploy*):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address shown (as a mail link) wherever the policies say "contact us". **A privacy policy needs one.** Without it the pages show a generic fallback sentence. |
| `NEXT_PUBLIC_OPERATOR_NAME` | Who runs the service (your name or business name). Defaults to "Neighborhood Eats". |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical URL; otherwise taken from the request host. |

## Where to paste the URLs
(Use your real domain; today `https://mehko-app.onrender.com`.)
- **Google** (Google Auth Platform → *Branding*): Privacy policy link = `…/privacy`, Terms of service link = `…/terms`, and add the domain under authorized domains.
- **Facebook** (App settings → *Basic*): Privacy Policy URL = `…/privacy`, Terms of Service URL = `…/terms`, **User data deletion** → *Data deletion instructions URL* = `…/privacy#deleting-your-data`. Required to switch the app to **Live**.
- **Apple / App Store Connect and Google Play (later, for the mobile apps)**: Privacy Policy URL = `…/privacy`; account deletion is available in the app at **Account**.

## How it's built
| What | Where |
| --- | --- |
| Policy text (4 languages) | `content/legal/privacy.ts`, `content/legal/terms.ts` (structured data: sections → paragraphs/bullet lists; tokens `{operator} {contact} {site} {updated}`) |
| "Last updated" date | `content/legal/meta.ts` (`LEGAL_UPDATED`) — bump on meaningful changes |
| Rendering | `components/legal-document.tsx`, pages `app/privacy`, `app/terms`; helpers `lib/legal.ts`, `lib/site.ts` |
| Public access | `lib/public-paths.ts` (`/login`, `/auth`, `/privacy`, `/terms`) used by the auth gate `lib/supabase/proxy.ts` |
| Labels / login line | `messages/*.json` → `legal.*` |

## Keeping the text true
The policy states facts about the app. **When you change any of these, update both documents (all four languages) and `LEGAL_UPDATED`:**
- new data collected (phone number, photos, payment details, analytics, push tokens),
- new third-party services (email provider, analytics, payment processor, a different host/database; Sentry error monitoring is already listed),
- changes to live location (history kept, background tracking in the mobile apps),
- changes to retention (backup retention is 30 days — see `docs/backup-restore.md`), account deletion behavior, minimum age,
- payments (the text currently says the service processes no payments and charges no fees).
Tests (`lib/__tests__/legal-content.test.ts`) fail if a language has a different structure, an empty string or an unknown token, and check that the privacy policy still mentions location, deletion, login providers, hosting, cookies, children, backups and maps.

## Review checklist for the person reviewing
Operator identity and contact · lawful bases / regional rights (GDPR, UK, CCPA) · minimum age (13) · governing law and venue (currently "where the operator is based") · liability cap (US$50) · food-safety/allergen wording · merchant obligations (licences, cottage-food rules) · cookie statement (strictly-necessary only) · international transfers.
