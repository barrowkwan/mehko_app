# Docs index

Start here when fixing a bug or adding a feature. Read in this order, stopping when you have enough.

| Doc | Use it to |
| --- | --- |
| [architecture.md](architecture.md) | Understand the layers, request flow, auth, and where logic lives |
| [data-model.md](data-model.md) | Look up tables, constraints, RPCs, RLS rules, the reporting view |
| [features.md](features.md) | Find the exact routes/files/DB objects/tests behind a feature (the fastest way to locate code) |
| [enhancing.md](enhancing.md) | Follow step-by-step recipes for common changes (payments, new report, new provider, schema change…) |
| [social-login-setup.md](social-login-setup.md) | Set up Google / Facebook / GitHub / Apple (and why Instagram isn't possible, how Yahoo could work) |
| [deployment.md](deployment.md) | Deploy for free (Render + hosted Supabase) and how the CI/CD pipeline works |
| [i18n.md](i18n.md) | Languages, how the locale is chosen, adding strings/languages, merchant translations |
| [roadmap.md](roadmap.md) | Backlog of future work and recommendations (not started); [plans/](plans/README.md) holds plans for items in progress |
| [backup-restore.md](backup-restore.md) | Daily encrypted DB backups: setup, restore steps, rehearsal |
| [decisions.md](decisions.md) | Learn *why* things are the way they are, past bugs, and gotchas |

Setup, commands and env vars are in the root [README.md](../README.md).

## Fast triage

- **"Customer can't order / edit"** → `place_order` / `update_order` in the migration, then `app/orders/actions.ts`. Reproduce in `tests/db/schema.test.ts`.
- **"Merchant sees wrong data / can't see data"** → RLS policy section of the migration; `lib/auth.ts` `requireMerchant`.
- **"Report is wrong"** → `lib/reports.ts` (pure, unit-tested) and the `order_lines` view.
- **"Weather/holiday missing"** → `lib/context-fetch.ts` and `app/api/cron/fetch-context/route.ts` (was the cron called?).
- **"QR doesn't confirm"** → `confirm_pickup` RPC, `app/merchant/scan/scanner.tsx`.
- **"Live map empty"** → `can_share_location`, `location_shares` policies, `components/location-toggle.tsx`, `components/live-map.tsx`.
- **"Redirect loop / not logged in"** → `proxy.ts`, `lib/supabase/proxy.ts`, `app/auth/callback/route.ts`.

## Working rules for changes

1. Business rules (cutoff, stock, ownership) belong in the **database** (RPC/RLS/trigger), with the app only calling them. Add a test in `tests/db/`.
2. Schema change = **new migration file** in `supabase/migrations/` (never edit an applied one) + regenerate `types/database.ts` + update [data-model.md](data-model.md).
3. Pure logic goes in `lib/` with a unit test in `lib/__tests__/`.
4. Before finishing: `npm test && npm run typecheck && npm run lint && npm run build`.
5. Next.js 16 differs from older versions — read `node_modules/next/dist/docs/` before using a Next API (see [AGENTS.md](../AGENTS.md)).
