# Social login setup (step by step)

The app only talks to **Supabase Auth**; Supabase talks to each provider. So for every provider you (1) create an OAuth app at the provider, (2) paste its credentials into Supabase, (3) tell the app to show its button. How the flow works: see [architecture.md](architecture.md#key-flows).

## Which providers can you use?

| Provider | Supported? | Notes |
| --- | --- | --- |
| Google | ✅ built in | Easiest. Free. |
| Facebook | ✅ built in | Free; needs an app set to **Live** for non-team users. |
| GitHub | ✅ built in | Free, 5 minutes. Developer-oriented audience. |
| Apple | ✅ built in | Needs a **paid** Apple Developer account ($99/yr), HTTPS, and a client secret that expires every ≤6 months. |
| **Instagram** | ❌ not viable | Supabase has no Instagram provider, and Meta shut the Instagram Basic Display API on **4 Dec 2024**. Its replacement ("Instagram API with Instagram Login") only works for **Business/Creator** accounts, not regular users, so it can't identify customers. Use **Facebook** instead (most Instagram users can also use Facebook login, but not all). |
| **Yahoo** | ⚠️ yes, via custom OIDC | Yahoo does support OpenID Connect ("Sign in with Yahoo"), but Supabase has no built-in Yahoo button. You can add it as a Supabase *custom OIDC provider* (see [Yahoo](#yahoo-optional-custom-oidc)). |

## Common to all providers

**Supabase callback URL** (every provider's "redirect/callback URI" is this, *not* your app's URL):

| Environment | Callback URL |
| --- | --- |
| Local (`supabase start`) | `http://127.0.0.1:54321/auth/v1/callback` |
| Hosted Supabase | `https://<project-ref>.supabase.co/auth/v1/callback` |

**Where to put the credentials**
- *Local:* put them in `supabase/.env` (git-ignored) — Supabase's docs also describe a project-root `.env`; both are ignored by git here. If a value isn't picked up, just export it in your shell instead. These feed the `env(...)` values in `supabase/config.toml`. Then `supabase stop && supabase start`:
  ```
  GOOGLE_CLIENT_ID=…       GOOGLE_CLIENT_SECRET=…
  FACEBOOK_CLIENT_ID=…     FACEBOOK_CLIENT_SECRET=…
  GITHUB_CLIENT_ID=…       GITHUB_CLIENT_SECRET=…
  APPLE_CLIENT_ID=…        APPLE_CLIENT_SECRET=…
  ```
- *Hosted:* Supabase dashboard → **Authentication → Sign In / Providers** → pick the provider → paste values → toggle **Enable** → Save.

**Which buttons the app shows:** `NEXT_PUBLIC_AUTH_PROVIDERS` in `.env.local` (comma list of `google,facebook,github,apple`; default `google,facebook,apple`). Restart/rebuild after changing it (`NEXT_PUBLIC_*` is inlined at build time).

**Supabase URL config** (hosted): Authentication → **URL Configuration** → *Site URL* = your app URL; add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for dev) to *Redirect URLs*. Locally this is already set in `config.toml`.

**Test it:** `npm run dev` → `/login` → click the provider → approve → you land on `/`. Check the `profiles` table has a row with your name.

---

## 1. Google (recommended first test)

Google's console has two separate things: the **consent screen** (what users see; set up once) and a **Client** (the credential that gives you the Client ID and secret). You need both. Menu labels below are for the current "Google Auth Platform" UI; older consoles call the same things *OAuth consent screen* and *Credentials → Create credentials → OAuth client ID*.

**A. Project**
1. Go to <https://console.cloud.google.com/>, open the project picker (top bar) → **New project** → name it (e.g. `mehko-app`) → **Create**, and make sure it's selected.

**B. Consent screen** (left menu: **Google Auth Platform**; if it says "not configured yet", click **Get started**)
2. *App information:* App name (e.g. `Mehko`), User support email (your Gmail) → Next.
3. *Audience:* choose **External** → Next.
4. *Contact information:* your email → Next.
5. Tick the agreement → **Continue** → **Create**.
6. Left menu **Audience**: while *Publishing status* is **Testing**, only people listed under **Test users** can sign in. Click **Add users** and add your Google address (and anyone else testing), or click **Publish app** to let any Google user sign in (no review needed for basic sign-in).
7. Left menu **Data Access** (scopes): the basic `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile` are enough and need no verification. Nothing to add if they already show; otherwise **Add or remove scopes** and tick those three.

**C. Create the Client** (this is the step that gives you the credentials)
8. Left menu **Clients** → **+ Create client**.
9. *Application type:* **Web application**. *Name:* e.g. `Mehko web`.
10. *Authorized JavaScript origins* → **+ Add URI** → your Render URL, e.g. `https://mehko-app-xxxx.onrender.com` (no trailing slash, no path). For local dev also add `http://localhost:3000`.
11. *Authorized redirect URIs* → **+ Add URI** → the **Supabase** callback: `https://<PROJECT_REF>.supabase.co/auth/v1/callback` (for local Supabase add `http://127.0.0.1:54321/auth/v1/callback`). This must be the Supabase URL, **not** your Render URL, and match exactly.
12. Click **Create**. A dialog shows the **Client ID** and **Client secret**. **Copy both now** — Google may not show the secret again (you can also download the JSON, or create a new secret under the client later).

**D. Supabase**
13. Supabase dashboard → **Authentication → Sign In / Providers → Google** → enable → paste Client ID and Client secret → **Save**. (Local: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `supabase/.env`.)
14. `google` is in the app's default `NEXT_PUBLIC_AUTH_PROVIDERS`, so the button already shows.

Common errors: `redirect_uri_mismatch` → the URI in step 11 must match the Supabase callback exactly; `access_denied` / "app not verified" in Testing mode → add yourself as a test user (step 6); "provider is not enabled" from Supabase → step 13 not done on the hosted project (`config.toml` only configures the local stack).

## 2. Facebook

1. <https://developers.facebook.com/apps> → **Create app** → use case **Authenticate and request data from users with Facebook Login** → app type Consumer/Other → name it.
2. **App settings → Basic:** copy **App ID** and **App secret** (`FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`). Fill **Privacy Policy URL** (required to go Live) and an app icon/category.
3. **Facebook Login → Settings:** under **Valid OAuth Redirect URIs** add the Supabase callback URL. Keep *Client OAuth Login* and *Web OAuth Login* on.
4. Permissions: `public_profile` and `email` are available without App Review; Supabase requests `email` by default.
5. **Development vs Live:** in *Development* mode only people with a role on the app (admin/developer/tester) can sign in. For real customers switch the toggle at the top of the dashboard to **Live**.
6. Add `facebook` to `NEXT_PUBLIC_AUTH_PROVIDERS`.

Gotchas: Facebook enforces HTTPS redirect URIs and is stricter with `http://127.0.0.1` than Google. If local testing is rejected, test Facebook against a hosted Supabase project (or an HTTPS tunnel). Some Facebook accounts have no email — the app doesn't require one.

## 3. GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App** (<https://github.com/settings/developers>).
2. *Homepage URL:* `http://localhost:3000` (or your site). *Authorization callback URL:* the Supabase callback.
   - GitHub allows **one** callback URL per OAuth app → create a separate app for local and for production.
3. **Register application**, then **Generate a new client secret** (shown once). Copy **Client ID** and secret → `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
4. Add `github` to `NEXT_PUBLIC_AUTH_PROVIDERS`.

Gotcha: users with a private email still work — Supabase reads their primary email via the `user:email` scope.

## 4. Apple

Requirements: paid **Apple Developer Program** membership; HTTPS (Apple will not accept `http://127.0.0.1`, so **test Apple against hosted Supabase**, not the local stack).

1. <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles**. Note your **Team ID** (top-right).
2. **Identifiers → + → App IDs → App**: create an App ID (e.g. `com.yourco.eats`), enable the **Sign in with Apple** capability.
3. **Identifiers → + → Services IDs**: create one (e.g. `com.yourco.eats.web`). This is your **Client ID**.
   - Enable **Sign in with Apple → Configure**: Primary App ID = the one from step 2.
   - *Domains and Subdomains:* `<project-ref>.supabase.co` (no scheme).
   - *Return URLs:* `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **Keys → +**: create a key with **Sign in with Apple** enabled, linked to your App ID. Download `AuthKey_XXXXXXXXXX.p8` (one-time download — store it safely) and note the **Key ID**.
5. **Generate the client secret** — it's a signed JWT (ES256) built from Team ID, Services ID, Key ID and the `.p8`. Use Supabase's generator linked from the Apple provider page in the dashboard (browser-only; use Chrome/Firefox, not Safari), or sign one yourself. **It expires after at most 6 months** — put a recurring reminder in your calendar, regenerate, and paste it again, or logins will break.
6. In the Supabase dashboard enable **Apple**: *Client IDs* = the Services ID (`com.yourco.eats.web`), *Secret Key* = the JWT. Save.
7. Add `apple` to `NEXT_PUBLIC_AUTH_PROVIDERS`.

Gotchas: Apple returns the user's name only on the **first** sign-in; if "Hide My Email" is chosen the email is a private relay address. For local-only `supabase start` you can still fill `APPLE_*` but the Apple round trip will fail without HTTPS.

## Instagram (not supported — what to do instead)

There is no way to offer "Log in with Instagram" for ordinary customers: Supabase has no provider for it, the old Basic Display API is gone, and the new Instagram Login is limited to Business/Creator accounts and is not an identity login for the public. Offer **Facebook**, **Google** and **Apple** (and optionally GitHub/Yahoo) instead.

## Yahoo (optional, custom OIDC)

Supabase supports any OpenID Connect provider as a **custom provider** with a `custom:` prefix (Free plan: up to 3). Yahoo's OIDC issuer is `https://api.login.yahoo.com`.

1. <https://developer.yahoo.com/apps/> → **Create an App**: name, **Redirect URI(s)** = the Supabase callback (Yahoo has historically required an `https://` redirect, so test against hosted Supabase), API permissions: **OpenID Connect** (`openid`, `email`, `profile`).
2. Copy the **Client ID** and **Client Secret**.
3. Register it in Supabase (Admin API, service-role key — run once; or the dashboard if your plan shows custom providers):
   ```js
   await supabase.auth.admin.customProviders.createProvider({
     provider_type: 'oidc',
     identifier: 'custom:yahoo',
     name: 'Yahoo',
     client_id: '<Yahoo client id>',
     client_secret: '<Yahoo client secret>',
     issuer: 'https://api.login.yahoo.com',
     scopes: ['openid', 'profile', 'email'],
   })
   ```
4. In `app/login/login-buttons.tsx` add `{ id: "custom:yahoo", label: "Continue with Yahoo" }` to the provider list (cast the id if TypeScript's `Provider` type rejects it), and add `custom:yahoo` to `NEXT_PUBLIC_AUTH_PROVIDERS`.

This path is documented by Supabase but has **not been tested in this project** — verify end to end before relying on it.

## Legal URLs the providers ask for

Google, Facebook (and later the app stores) require a privacy policy URL, and Facebook also needs terms and a data-deletion URL before an app can go live. They are `/privacy`, `/terms` and `/privacy#deleting-your-data` on your site; exact fields are in [legal-pages.md](legal-pages.md#where-to-paste-the-urls).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Provider page says redirect URI mismatch | The URI registered at the provider isn't exactly the Supabase callback (scheme, host, port, path) |
| Back on `/login?error=auth` | Code exchange failed: Site URL / Redirect URLs not allow-listing `/auth/callback`, or wrong client secret |
| "Unsupported provider: provider is not enabled" | Provider not enabled in Supabase (config.toml `enabled = true` + env vars, or dashboard toggle) |
| Works for you but not others | Google app in *Testing*, or Facebook app in *Development* mode |
| Apple suddenly fails months later | Client-secret JWT expired — regenerate |
| Button missing | Not in `NEXT_PUBLIC_AUTH_PROVIDERS`, or dev server not restarted |
