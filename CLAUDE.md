@AGENTS.md

# Project docs

Before changing code, read [docs/README.md](docs/README.md): architecture, data model, feature→file map ([docs/features.md](docs/features.md)), change recipes ([docs/enhancing.md](docs/enhancing.md)) and past bugs/gotchas ([docs/decisions.md](docs/decisions.md)).

Rules: business rules live in SQL (RPC/RLS/triggers) with tests in `tests/db/`; schema changes are new migrations plus `types/database.ts` and `docs/data-model.md` updates; finish with `npm test && npm run typecheck && npm run lint && npm run build`. Keep the docs current when you change behavior.

Future work: ideas and recommendations that are not being built yet go in [docs/roadmap.md](docs/roadmap.md). When starting an item, create a plan from the template in [docs/plans/README.md](docs/plans/README.md), move the item's details into it, and link it under "In progress" in the roadmap; when it ships, move it to "Done".
