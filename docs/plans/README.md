# Implementation plans

One file per feature or phase, created **when work on a [roadmap](../roadmap.md) item starts**.

## Lifecycle

```
roadmap.md Backlog  →  plans/<name>.md (Planned → In progress)  →  roadmap.md "Done" + docs updated
```

1. Copy the template below to `docs/plans/<id>-<short-name>.md` (e.g. `feat-1-edit-clone-offerings.md`; for a phase: `phase-a-safe-to-run.md`).
2. **Move** the item's text from `roadmap.md` into the plan (don't duplicate), and leave a one-line link under *In progress* in the roadmap.
3. Keep the plan's **Status** and checklist current while working (small commits).
4. When shipped: set Status to `Done (date, commit/PR)`, move the roadmap one-liner to *Done*, and update `features.md`, `data-model.md`, `i18n.md` etc. as applicable.
5. If scope is dropped, move the item back to the roadmap backlog with a note on why.

## Template

```markdown
# <ID> · <Title>

**Status:** Planned | In progress | Done (YYYY-MM-DD, commit/PR) | Dropped (why)
**Roadmap items:** <IDs>   **Size:** S/M/L   **Owner:** <name>

## Goal
What changes for the user, in one or two sentences.

## Why now / context
Links to the roadmap entry, decisions, constraints (free-tier limits, i18n, RLS).

## Scope
- In:
- Out (deferred → add to roadmap):

## Platform split (once the mobile app exists)
- **Shared** (`packages/*`: logic, validation, error codes, messages):
- **Web** (Next.js UI):
- **Mobile** (Expo UI):

## Design
Data model (new migration file name), RLS/RPC rules, routes/components touched, i18n keys (all 4 languages), error mapping (`lib/db-errors.ts`).

## Tasks
- [ ] Migration + `supabase gen types typescript --local > types/database.ts`
- [ ] DB tests (`tests/db/`) and unit tests
- [ ] UI + translations (`messages/*.json`)
- [ ] Integration test against `supabase start` if Auth/Realtime/RPC behavior changes
- [ ] Docs: features.md, data-model.md, (i18n.md), this plan's status
- [ ] `npm test && npm run typecheck && npm run lint && npm run build`

## Verification
How to confirm it works locally and after deploy (include what can only be checked on a real device/account).

## Rollout notes
Migration compatibility with the previous app version (migrations run before the new app starts), env vars/secrets to add, free-tier impact.
```
