# Design & architecture guide (start here)

**Audience:** a junior engineer (or anyone new) who needs to understand *every moving part* of Neighborhood Eats: what each piece is, **why we chose it**, its **pros and cons**, and **what the alternatives were**. It explains the reasoning; the other docs in `docs/` tell you *where the code is* and *how to change it*.

> **How this guide relates to the other docs.** [`../README.md`](../README.md) is the working index (fast triage, change recipes). [`../architecture.md`](../architecture.md) is the short original layer map. [`../data-model.md`](../data-model.md) is the table-by-table reference. [`../decisions.md`](../decisions.md) is the log of gotchas and past bugs. This folder is the *teaching* version: longer, with diagrams, trade-offs and alternatives.

## What the app is, in one paragraph

A small multi-merchant pre-order/pickup web app. **Merchants** (home food businesses, market stalls) publish *offerings*: foods, optional prices and limits, a pickup date, one or more pickup places/times, and an order cutoff. **Customers** browse, order and edit until the cutoff, then show a QR code at pickup, which the merchant scans. Merchants can optionally share their live location on pickup day, get emailed order summaries, and share an offering on Facebook with a real preview. It runs in four languages (English, Spanish, Simplified and Traditional Chinese). Customers and merchants sign in with Google / Facebook / Apple (no passwords). There are no card payments yet (cash/Venmo/Zelle are arranged directly).

## Reading order

| # | Document | Read it to understand… | Time |
| --- | --- | --- | --- |
| 1 | [01 System overview](01-system-overview.md) | The big picture: components, who talks to whom, one request end to end, the vocabulary | 15 min |
| 2 | [02 Tech stack and alternatives](02-tech-stack-and-alternatives.md) | Next.js, React, TypeScript, Tailwind, Zod, next-intl, maps… why each, pros/cons, alternatives | 25 min |
| 3 | [03 Database and Supabase](03-database-supabase.md) | **Why Supabase/Postgres**, row-level security, SQL functions, migrations, storage, realtime, alternatives | 35 min |
| 4 | [04 Authentication and OAuth](04-authentication-oauth.md) | **Why social login (OAuth)**, the exact flow, sessions, providers, alternatives (passwords, magic links, Auth0…) | 30 min |
| 5 | [05 Security and privacy](05-security-and-privacy.md) | Threats, the defence layers, secrets, public surfaces, privacy-by-design choices, known gaps | 25 min |
| 6 | [06 Hosting, deployment and CI/CD](06-hosting-deployment-ci.md) | **Why Render**, GitHub Actions pipelines, environments, env vars, free-tier limits, alternatives | 30 min |
| 7 | [07 Core flows](07-core-flows.md) | Ordering, cutoff, stock, pickup slots, numbering, prices, QR pickup, live location, sharing, notifications | 40 min |
| 8 | [08 Third-party integrations](08-integrations.md) | Every external service: why, what data leaves, failure behaviour, alternatives | 20 min |
| 9 | [09 Testing and quality](09-testing-quality.md) | The four test layers, what each can and cannot catch, how to add tests | 20 min |
| 10 | [10 Code structure and patterns](10-code-structure-patterns.md) | Folder map, server vs client components, server actions, forms, i18n, time zones, money | 25 min |
| 11 | [11 Operations and future](11-operations-and-future.md) | Running it, costs, scaling limits, upgrade triggers, roadmap, first-week onboarding plan | 15 min |

**Suggested paths**
- *"I just joined, give me the gist":* 01 → 03 (sections 1–4) → 07.
- *"I'll work on the UI":* 01 → 02 → 10 → 07.
- *"I'll work on the database/backend rules":* 01 → 03 → 07 → 09.
- *"I own deployment/ops":* 06 → 05 → 11 → 08.
- *"I'm reviewing security":* 05 → 04 → 03 (RLS) → 08.

## The five ideas that explain most design choices

1. **Rules live in the database.** Cutoff, stock, ownership, who can see what — enforced by Postgres (row-level security, SQL functions, triggers). The Next.js app is deliberately thin. This makes the rules impossible to bypass from a browser and reusable by a future mobile app. ([03](03-database-supabase.md), [07](07-core-flows.md))
2. **No passwords, ever.** Sign-in is delegated to Google/Facebook/Apple via OAuth, so we never store or reset a password. ([04](04-authentication-oauth.md))
3. **Free-tier first, upgrade by trigger.** Render free + Supabase free + GitHub Actions + free tiers of Resend/Geoapify/Sentry. Each choice notes when it stops being enough. ([06](06-hosting-deployment-ci.md), [11](11-operations-and-future.md))
4. **Privacy by design.** Merchants can be home kitchens: location data stripped from photos, live location expires on its own, public pages show a fixed whitelist, Sentry never sees personal data, backups are encrypted. ([05](05-security-and-privacy.md))
5. **Optional integrations degrade gracefully.** No email key → no emails; no place-search key → the map still works; no Sentry DSN → no reporting. Each integration is an adapter switched by an environment variable and replaced by a fake in tests. ([08](08-integrations.md))

## Glossary

| Term | Meaning |
| --- | --- |
| **Merchant** | A user who owns a `merchants` row (a business). Not a separate account type: any signed-in user can become one. |
| **Customer** | Any signed-in user placing orders. A person can be both. |
| **Food (item)** | A thing a merchant makes (`food_items`): name, description, photo, translations. **Has no price.** |
| **Offering** | One sale event: a date, a cutoff, a list of foods (with optional price and limit per food) and one or more pickup *slots*. Shown to merchants as one row. |
| **Offering item** | A food inside an offering (`offering_items`): the **price and quantity limit live here**. |
| **Pickup point** | A place (name, address, map position, timezone) the merchant uses repeatedly. |
| **Slot** | One pickup point + time range within an offering. Technically each slot is a row in `offerings` and slots of one offering share a `group_id`. |
| **Cutoff** | The moment ordering closes for an offering (stored as an absolute UTC instant). |
| **Order** | A customer's order for one slot, with lines (`order_items`), an optional note, a QR token and a status (placed / cancelled / picked up). |
| **Merchant code / offering number / order number** | Human-friendly IDs: `m00001`, `m00001-000001`, `m00001-000001-000001`. |
| **RLS** | Row-Level Security: Postgres rules that decide which rows each user can read/write. |
| **RPC** | "Remote procedure call" = a SQL function the app calls by name (`place_order`, …). |
| **Security definer** | A SQL function that runs with its owner's rights (so it can check things the caller may not read). |
| **Server Component / Server Action** | Next.js code that runs only on the server: pages that read data, and functions that handle form submissions. |
| **Service role key** | The Supabase master key that bypasses RLS. Server only; never in the browser. |
| **Anon key** | The *public* Supabase key shipped to browsers; safe only because RLS protects the data. |
| **PKCE** | The extra protection used in the OAuth "authorization code" flow ([04](04-authentication-oauth.md)). |
| **Outbox** | A table of "emails to send" processed by a job (reliable background work without a queue service). |

## Conventions used in this guide

- ✅ = what the project does today · ⚠️ = a known limitation · 🔁 = alternative we considered.
- "Verify before relying" marks vendor prices/limits that change; they were checked in October 2026 and are summarized in the repo docs, not guaranteed.
- Code paths are relative to the repository root. Mermaid diagrams render on GitHub and in most Markdown viewers.
