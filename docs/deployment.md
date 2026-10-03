# Deployment (free tier): Render + hosted Supabase, deployed from GitHub Actions

```
git push to main
   └─ GitHub Actions (.github/workflows/ci.yml)
        ├─ test         lint · typecheck · unit + DB tests · build
        ├─ integration  tests against a throwaway local Supabase stack
        └─ deploy       (needs both above, main only, needs DEPLOY_ENABLED=true)
             1. supabase db push   → migrations applied to the hosted Supabase project
             2. Render deploy hook → Render builds & starts exactly this commit
   .github/workflows/scheduled.yml  daily → GET /api/cron/fetch-context (weather/holiday data,
                                            also keeps Supabase awake)
```

Until you complete the setup below, CI runs tests only — the deploy job and the daily job are skipped.

## Free options considered

| Option | Free? | Commercial use? | Verdict |
| --- | --- | --- | --- |
| **Render free web service** (chosen) | Yes, no card | Allowed | Runs the app as a normal Node server. **Sleeps after ~15 min idle** → first request after a quiet period takes ~30–60 s |
| Vercel Hobby | Yes | **No — non-commercial only** ([Vercel fair-use rules, summarized here](https://justinmckelvey.com/blog/is-vercel-free)); business use needs Pro ($20/user/mo) | Best Next.js experience; use it only for a hobby project |
| Google Cloud Run | Generous free tier | Allowed | Scales to zero; needs a billing account (card) and a Dockerfile |
| Cloudflare Workers (OpenNext) | Yes (100k req/day) | Allowed | Newest/least proven path for Next 16; free-plan worker size limit may be too small |
| Netlify | Credit-based free plan | Check terms | Possible; not evaluated here |

Backend: **Supabase free** — 500 MB DB, ~200 concurrent Realtime connections, 50k MAU, 2 active projects; **pauses after 7 days without requests** (the daily job prevents this) and has **no automatic backups** (export periodically with `supabase db dump`). Upgrade to Pro ($25/mo) for backups and no pausing when this becomes a real business.

## One-time setup

### 1. Hosted Supabase project
1. <https://supabase.com/dashboard> → **New project** (remember the **database password**). Note the **Project ref** (the `xxxx` in `xxxx.supabase.co`).
2. **Project Settings → API:** copy the **Project URL**, **anon (public) key** and **service_role key**.
3. **Authentication → URL Configuration:** *Site URL* = your Render URL (step 2.4 below, e.g. `https://mehko-app.onrender.com`); add `https://<your-render-url>/auth/callback` to *Redirect URLs*.
4. **Authentication → Sign In / Providers:** enable and configure Google/Facebook/GitHub/Apple — see [social-login-setup.md](social-login-setup.md). The provider callback is `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Account → **Access Tokens:** create a token for CI (`SUPABASE_ACCESS_TOKEN`).

The first deploy applies `supabase/migrations/` to this project automatically (you don't run SQL by hand). The dev seed is **not** applied.

### 2. Render service
1. <https://dashboard.render.com> → **New → Blueprint** → connect GitHub repo `barrowkwan/mehko_app` → Render reads [render.yaml](../render.yaml) and proposes the `mehko-app` free web service.
2. When prompted, enter the env vars (marked `sync: false`):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (secret!)
   - `CRON_SECRET` = a long random string (`openssl rand -hex 32`)
   - `NEXT_PUBLIC_AUTH_PROVIDERS` (already defaulted) = the providers you enabled in Supabase
3. Apply. The first build starts; Render's own auto-deploy is off, GitHub Actions triggers later deploys.
4. Note the service URL (`https://<name>.onrender.com`), then finish step 1.3 above.
5. Service → **Settings → Deploy Hook:** copy the URL.

### 3. GitHub repository settings (Settings → Secrets and variables → Actions)

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `SUPABASE_ACCESS_TOKEN` | token from step 1.5 |
| Secret | `SUPABASE_DB_PASSWORD` | the database password from step 1.1 |
| Secret | `SUPABASE_PROJECT_REF` | project ref |
| Secret | `RENDER_DEPLOY_HOOK_URL` | deploy hook URL from step 2.5 |
| Secret | `CRON_SECRET` | same value as in Render |
| Variable | `SITE_URL` | `https://<name>.onrender.com` (or your custom domain) |
| Variable | `DEPLOY_ENABLED` | `true` (set this last) |

### 4. Go
Push to `main` (or re-run the latest workflow). Watch **Actions**: `test` and `integration` must pass, then `deploy` migrates the DB and triggers Render. Then open the site, sign in, and use **Merchant → Become a merchant**.

## Day-to-day
- Merge to `main` → tested → migrated → deployed. Pull requests only run tests.
- New migration = new file in `supabase/migrations/` (see [enhancing.md](enhancing.md#schema-change)); `supabase db push` applies only new ones. Migrations run **before** the new app version starts, so make them backward-compatible with the previous app version (add columns before using them; remove columns in a later release).
- Manually run the daily job: Actions → *Daily job* → *Run workflow*.
- Custom domain: Render → Settings → Custom Domains; then update `SITE_URL`, Supabase Site URL/Redirect URLs.

## Caveats
- **Cold starts** on Render free (see above). A paid Render instance ($7/mo) removes sleeping.
- The deploy job only *triggers* the Render deploy; check the Render dashboard for build status/logs. Failed Render builds keep the previous version running.
- `supabase db push` applies migrations only; Auth provider settings are configured in the dashboard (not pushed from `config.toml`).
- The deploy and daily jobs were written from the platforms' documentation and have **not been run against real accounts**; expect to fix small things on the first run.
- Live location needs Realtime; free Supabase allows ~200 concurrent connections.
