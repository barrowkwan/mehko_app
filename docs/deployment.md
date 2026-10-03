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
3. *(Done later in step 2.5, once you know the Render URL: Site URL, Redirect URLs, login providers.)*
4. Account → **Access Tokens:** create a token for CI (`SUPABASE_ACCESS_TOKEN`) — see step 3.

Migrations are applied with `supabase db push` (step 2.0 once by hand, then automatically by CI). The dev seed is **not** applied to hosted projects.

### 2. Render service

**2.0 Apply the database schema once, from your machine (recommended; ~2 min).** The app errors on every page until the tables exist, and doing it by hand first also proves the migration works on hosted Supabase.
```bash
cd home_business
supabase login                                   # opens a browser
supabase link --project-ref <PROJECT_REF>        # paste the database password when asked
supabase db push                                 # answer Y; applies supabase/migrations/*
```
`<PROJECT_REF>`: Supabase dashboard → **Project Settings → General → Reference ID** (also the `xxxx` in `https://xxxx.supabase.co`). Check **Table Editor** afterwards: `merchants`, `offerings`, `orders`, … should exist. (CI's `supabase db push` later only applies *new* migrations; Supabase records which ones ran.)

**2.1 Collect the Supabase values** (dashboard → **Project Settings → API** / **API Keys**):

| You need | Where | Becomes |
| --- | --- | --- |
| Project URL (`https://xxxx.supabase.co`) | API page, top | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` public key | API Keys → **Legacy API keys** tab → `anon` (if your project only shows the new keys, use the **Publishable** key) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | same tab → `service_role` → *Reveal* (new keys: the **Secret** key) | `SUPABASE_SERVICE_ROLE_KEY` |

> The legacy `anon`/`service_role` keys are what this project was tested with locally. The new `sb_publishable_…`/`sb_secret_…` keys should work with supabase-js but have not been tried here. The service_role/secret key bypasses all security rules — never put it in the browser, in git, or in a `NEXT_PUBLIC_*` variable.

Also generate the cron secret and keep it handy (you need it in Render **and** GitHub):
```bash
openssl rand -hex 32
```

**2.2 Create the Render account.** Go to <https://dashboard.render.com> → **Sign up with GitHub**. (Free "Hobby" workspace; no credit card.)

**2.3 Create the service from the blueprint.**
1. Dashboard → **New +** → **Blueprint**.
2. **Connect GitHub** → authorize Render → choose **Only select repositories** → `mehko_app` → Save.
3. Back in Render pick the repo `barrowkwan/mehko_app`, branch `main` → **Connect**. Render reads `render.yaml` and shows one web service, `mehko-app`, plan **Free**.
4. Fill the prompted variables with the values from 2.1 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`). Leave `NEXT_PUBLIC_AUTH_PROVIDERS` unless you enabled different providers. **These `NEXT_PUBLIC_*` values are baked in at build time**, so they must be right before the first build; if you change one later, trigger a new deploy.
5. Click **Deploy Blueprint**. The first build starts right away (about 3–6 min). Watch **Logs**; it ends with "Your service is live 🎉".

**2.4 Note your site URL.** Top of the service page: `https://mehko-app-xxxx.onrender.com` (the suffix may differ). Open `<url>/login` — you should see the sign-in buttons (the first load after idle can take ~60 s).

**2.5 Tell Supabase about that URL** (otherwise logins redirect to localhost). Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL** = your Render URL.
- **Redirect URLs** → Add: `https://<your-render-url>/auth/callback`.

Then enable at least one login provider (**Authentication → Sign In / Providers**; guide: [social-login-setup.md](social-login-setup.md)). The OAuth callback you give Google/Facebook/etc. is `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.

**2.6 Copy the deploy hook.** Render → your service → **Settings** → scroll to **Deploy Hook** → copy the URL (`https://api.render.com/deploy/srv-…?key=…`). Treat it as a secret.

### 3. GitHub repository settings

Open <https://github.com/barrowkwan/mehko_app/settings/secrets/actions> (repo → **Settings → Secrets and variables → Actions**).

**Secrets tab → New repository secret** (add each):

| Name | Value / where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> → **Generate new token**, name it `github-ci`, copy it (shown once) |
| `SUPABASE_DB_PASSWORD` | The database password you chose when creating the project. Forgot it? Project Settings → **Database** → *Reset database password* (then use the new one everywhere) |
| `SUPABASE_PROJECT_REF` | Project Settings → General → **Reference ID** |
| `RENDER_DEPLOY_HOOK_URL` | The whole URL from step 2.6 |
| `CRON_SECRET` | The same string you used in Render (step 2.1) |

**Variables tab → New repository variable:**

| Name | Value |
| --- | --- |
| `SITE_URL` | Your Render URL, no trailing slash needed |
| `DEPLOY_ENABLED` | `true` — **add this last**; it switches the deploy and daily jobs on |

*(Optional shortcut after `gh auth login`: `gh secret set SUPABASE_ACCESS_TOKEN` etc., and `gh variable set DEPLOY_ENABLED --body true`.)*

### 4. Go — first automated deploy

1. Trigger a run on `main` now that `DEPLOY_ENABLED=true`:
   ```bash
   git commit --allow-empty -m "Enable deploy" && git push
   ```
2. GitHub → **Actions** → the new **CI** run. Expect `test` ✅, `integration` ✅, then **`deploy`**:
   - *Apply database migrations* — "Remote database is up to date" is normal if you did step 2.0.
   - *Trigger Render deploy* — succeeds when Render accepts the hook.
3. Render → **Events/Logs**: a new deploy for that commit builds (~3–6 min) and goes live. (If the first build from 2.3 is still running, Render queues this one.)
4. Smoke test: open `<SITE_URL>/login` → sign in → **Merchant → Become a merchant** → add a pickup point and a food → create an offering → open `/` in a second browser/account and place an order.
5. Run the daily job once: **Actions → Daily job → Run workflow**. Expect ✅. It returns `{"updated": N}` and fills weather/holiday data.

### If something fails

| Symptom | Cause / fix |
| --- | --- |
| `deploy` job shows **Skipped** | `DEPLOY_ENABLED` isn't exactly `true` (Variables tab, not Secrets), or the run wasn't a push to `main` |
| `supabase link` / `db push`: *access token* or *unauthorized* | `SUPABASE_ACCESS_TOKEN` wrong/expired |
| `db push`: *password authentication failed* | `SUPABASE_DB_PASSWORD` wrong (reset it in Supabase, update the secret) |
| Render hook step: `curl: (22) … 401/404` | `RENDER_DEPLOY_HOOK_URL` incomplete — it must include `?key=…` |
| Render build fails | Open Render **Logs**; most common: a missing `NEXT_PUBLIC_SUPABASE_*` variable |
| Site loads but pages show errors | Migrations not applied (do 2.0), or wrong Supabase URL/key in Render |
| Login bounces to `localhost` or errors after provider | Supabase **Site URL / Redirect URLs** not set (2.5), or provider not enabled/configured |
| Daily job fails with 401 | `CRON_SECRET` differs between GitHub and Render |
| Daily job fails with a timeout | Render cold start; re-run (the job already retries for ~2 min) |

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
