# Legal review brief (privacy policy & terms)

**Purpose:** hand this page to a lawyer or a reputable policy-review service together with the live pages (`/privacy`, `/terms` — source in `content/legal/`). It states what the app actually does, so the reviewer can check that the documents match reality and the law, and lists the decisions only the operator can make. The drafts were written by an AI model; **they are not legal advice and have not been reviewed by a lawyer.**

## 1. The service in one paragraph
Neighborhood Eats is a web app (mobile apps planned) where **independent local food merchants** publish what they will sell for pickup on a date, with an order cutoff and one or more pickup points, and **customers pre-order** and pick up. The operator provides the platform only. **No payments run through the service** (cash, Venmo or Zelle are agreed directly between customer and merchant). Sign-in is only through Google, Facebook, GitHub or Apple. Merchants can optionally share their live location on the pickup day. Four languages (English, Spanish, Simplified and Traditional Chinese).

## 2. Operator (to confirm)
| Item | Current | Decision needed |
| --- | --- | --- |
| Operator named in the policies | "Barrow Kwan" (an individual) | Individual or a legal entity (LLC, etc.)? Registered address? Some laws require identifying the controller and a postal address |
| Contact email shown | kwan.global.it.services@gmail.com | A dedicated address (e.g. privacy@yourdomain) is advisable |
| Countries where the service is offered / where operator is based | not stated | Needed for governing law, GDPR/UK GDPR/CCPA applicability, age limits |

## 3. Personal data inventory (from the database schema and code)
| Data | Where | Source | Who can see it | Purpose |
| --- | --- | --- | --- | --- |
| Name, email, profile-picture URL, provider and provider user id | Supabase Auth (`auth.users`, `auth.identities`), `profiles` (name, picture URL, language) | Google / Facebook / GitHub / Apple sign-in | The user; merchants see **name and picture** of customers who ordered from them (not the email) | Account, showing who ordered |
| Language choice | `profiles.locale`, cookie `NEXT_LOCALE` | User | The user | Show the app in their language |
| Orders: items, quantities, status, timestamps, offering and pickup point, **QR token** | `orders`, `order_items` | Customer | The customer and the merchant of that offering | Ordering and confirming pickup |
| Merchant business data: name, description, country, foods, translations | `merchants`, `food_items` | Merchant | All signed-in users (shown to customers) | Listing |
| **Pickup points: name, address, latitude/longitude, timezone** | `pickup_points` | Merchant (may be a **home address**) | All signed-in users | Where to collect |
| **Merchant live location** (latest position only, overwritten, no history) | `location_shares` | Merchant's device, only if they switch it on, only on the pickup date | Customers who have an active order for that offering | Show the merchant's location |
| Sign-in IP address and timestamps | Supabase Auth audit logs | Automatic | Operator (Supabase dashboard) | Security |
| Server request logs (IP, user agent) | Render and Supabase logs | Automatic | Operator | Operation, security |
| Error reports | Sentry (US region ingest) | Automatic on errors | Operator | Fix bugs. Configured to **drop** user id/email/IP, cookies, headers, bodies, query strings, local variables; text is scrubbed of emails/tokens |
| Daily encrypted database backup (all of the above except session tokens) | GitHub Actions artifact, AES-256 encrypted, **kept 30 days** | Automatic | Operator (holds the passphrase) | Disaster recovery |
Not collected: payment card data, customers' precise location, phone numbers, government IDs, advertising identifiers. No analytics or advertising trackers.

## 4. Cookies / local storage
Strictly necessary only: Supabase session cookies (keep the user signed in) and `NEXT_LOCALE` (language, 1 year). No consent banner is currently shown (relies on the "strictly necessary" exemption). Mobile apps (planned) will keep the session in encrypted device storage.

## 5. Third parties and what each receives
| Party | Role | Data | Region |
| --- | --- | --- | --- |
| Supabase | Database, auth, realtime (processor) | All app data | **Confirm project region** in the Supabase dashboard |
| Render | Web hosting (processor) | Request metadata, app traffic | **Confirm region** (default Oregon, US) |
| Google, Facebook, GitHub, Apple | Sign-in providers (independent controllers) | Tell us name/email/picture at sign-in | — |
| GitHub | Source code, CI, encrypted backup storage | Encrypted backups; no plaintext personal data in the repo | US |
| Sentry | Error monitoring (processor) | Scrubbed error reports | US ingest |
| OpenStreetMap tile servers | Map images (only when a map is opened) | Viewer's **IP address** and the map area | — |
| Open-Meteo | Weather for a pickup date | **Pickup point coordinates** + date (no user data) — note it may be a merchant's home | — |
| Nager.Date | Public holidays | Country code + year | — |
Open-Meteo's free API is understood to be **non-commercial use**; terms should be checked (roadmap OPS-10).

## 6. Retention and deletion (as implemented)
- Data is kept while the account exists. **In-app deletion** (Account page) removes the profile, the user's orders and, for merchants, foods, pickup points, offerings and all orders on them (customers lose that merchant's order history). Blocked while a merchant has upcoming active orders.
- Backups: encrypted, 30 days, so deleted data may remain in backups up to 30 days.
- Provider logs follow the providers' own retention.
- No automated export tool yet (handled by email on request).

## 7. Questions for the reviewer
**Privacy policy**
1. Which regimes apply given where users and the operator are (GDPR / UK GDPR / CCPA-CPRA / other US state laws / PIPEDA…)? Required extra sections (lawful bases, retention table, categories of personal information, "we do not sell/share", appeals, DPO/representative, international-transfer mechanism such as SCCs)?
2. Is "strictly necessary cookies only, no banner" acceptable for the markets targeted?
3. **Merchants receive customers' names and orders**: should the policy say merchants are independent controllers of that data, and should merchants accept data-protection duties in the Terms?
4. Is the location-sharing disclosure sufficient (consent, purpose, deletion)? Should it be an explicit opt-in step with a notice?
5. Minimum age: drafts say **13** (US COPPA); EU member states set 13–16. Should it be 16, or 18 for merchants?
6. Breach-notification and data-subject-request timelines to state?
7. Are the Apple privacy "nutrition labels" and Google Play Data-safety answers derivable from this policy (they will be needed for the mobile apps)?

**Terms of service**
1. The service is a **marketplace connecting independent home/local food sellers with consumers**. Is the disclaimer of food-safety and allergen responsibility adequate? Should merchants **represent and warrant** that they hold all required food licences/cottage-food permits, and **indemnify** the operator? (Currently not required and no indemnity clause.)
2. Governing law and venue ("where the operator is based") and the US$50 liability cap: enforceable? Consumer-law carve-outs?
3. Missing clauses to consider: indemnification, dispute resolution / arbitration and class-waiver (US), DMCA/IP complaints, force majeure, severability/entire agreement/assignment, electronic communications, merchant termination while orders are open, taxes, no-show handling, moderation of user content.
4. Acceptance mechanics: currently **browsewrap** ("By continuing you agree…" on the login page). Should merchants (and customers) tick an explicit box, with the accepted version/date stored? (Roadmap SEC-9.)
5. Does the operator, as an individual, need to register a business or take insurance given food-related liability?

## 8. Practical ways to get this reviewed
A small-business/startup lawyer (a few hours, with this brief and the live pages), or a reputable policy service that offers lawyer review. Ask for the changes as a diff against `content/legal/privacy.ts` and `content/legal/terms.ts` (all four languages must keep the same structure — `npm test` checks it). Native-speaker proofreading of the Spanish and Chinese text is separate (roadmap QA-3).
