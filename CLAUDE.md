@AGENTS.md

# Project docs

Before changing code, read [docs/README.md](docs/README.md): architecture, data model, feature→file map ([docs/features.md](docs/features.md)), change recipes ([docs/enhancing.md](docs/enhancing.md)) and past bugs/gotchas ([docs/decisions.md](docs/decisions.md)).

Rules: business rules live in SQL (RPC/RLS/triggers) with tests in `tests/db/`; schema changes are new migrations plus `types/database.ts` and `docs/data-model.md` updates; finish with `npm test && npm run typecheck && npm run lint && npm run build`. Keep the docs current when you change behavior.
