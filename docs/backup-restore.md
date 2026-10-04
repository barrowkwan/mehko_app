# Database backups & restore

**What:** `.github/workflows/backup.yml` runs daily (07:37 UTC) and on demand (Actions → *Database backup* → *Run workflow*). It dumps the **data** of schemas `public` and `auth` (users and identities, so people can log in again), **encrypts** it, and stores it as a workflow artifact for **30 days**. The schema itself is not in the dump: it is `supabase/migrations/`.
**Not included:** auth sessions/refresh tokens (everyone logs in again after a restore), Supabase Storage files (none used yet), the Supabase project settings (Auth providers, URL configuration — re-enter from [social-login-setup.md](social-login-setup.md)).

> The repo is **public**, and artifacts of public repos can be downloaded by anyone. The dump contains personal data (names, emails, order history, locations), so it is **always encrypted** before upload. **Never** change the workflow to upload the plaintext file.

## One-time setup
1. Generate a long random passphrase and **store it in your password manager first** — GitHub secrets cannot be read back, and without the passphrase the backups are useless:
   ```bash
   openssl rand -base64 32
   ```
2. GitHub → Settings → Secrets and variables → Actions → new repository secret **`BACKUP_PASSPHRASE`** = that value (the workflow requires ≥ 20 characters). `SUPABASE_DB_URL` (session pooler) and the variable `DEPLOY_ENABLED=true` already exist from deployment setup.
3. Run the workflow once manually and confirm it is green and an artifact named `db-backup-…` appears.
4. Failure emails: GitHub emails the person who last changed the schedule when a scheduled run fails. Keep it enabled in your notification settings.

## Restore (tested locally: dump → wipe → restore → identical row counts)
1. **Get the file:** Actions → *Database backup* → pick a run → download the `db-backup-…` artifact → unzip → `backup-YYYY-MM-DD.sql.enc`.
2. **Decrypt:**
   ```bash
   export BACKUP_PASSPHRASE='…your passphrase…'
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in backup-YYYY-MM-DD.sql.enc -out backup.sql
   ```
   ("bad decrypt" = wrong passphrase.)
3. **Target database:** a new/empty Supabase project (or the same one after fixing the problem). Make the schema match first:
   ```bash
   supabase db push --db-url "<session-pooler URL of the target>"     # applies supabase/migrations
   ```
   If restoring into a database that already has rows, empty the tables first (otherwise you get duplicate-key errors).
4. **Load the data** (the dump disables triggers/FK checks while loading via `session_replication_role = replica`):
   ```bash
   psql "<session-pooler URL of the target>" -v ON_ERROR_STOP=1 -f backup.sql
   ```
   If your role is not allowed to set `session_replication_role` on the hosted database, ask Supabase support or run the load through the dashboard SQL editor in chunks; this is the one step not yet verified on a hosted project — **do a test restore into a throw-away project soon** (see below).
5. **Verify:** compare counts of `auth.users`, `profiles`, `merchants`, `offerings`, `orders` with what you expect; sign in; open an order.
6. **Re-configure** Auth providers and URL settings in the new project, update `NEXT_PUBLIC_SUPABASE_URL`/keys in Render and the GitHub secrets (`SUPABASE_DB_URL`).
7. Delete the decrypted `backup.sql` (`shred -u backup.sql`).

## Test it (do this once, then every quarter)
Create a free throw-away Supabase project (you can have 2 active) → follow *Restore* into it → verify counts → delete the project. Record the date in `docs/roadmap.md` (OPS-1).

## Local rehearsal (no hosted project needed)
```bash
supabase start && supabase db reset                      # local DB with seed data
supabase db dump --local --data-only --use-copy -s public,auth -f backup.sql \
  -x auth.sessions,auth.refresh_tokens,auth.flow_state,auth.audit_log_entries,auth.one_time_tokens,auth.mfa_amr_claims,auth.mfa_challenges,auth.mfa_factors,auth.mfa_recovery_code_sets
supabase db reset --no-seed                              # empty DB with schema only
docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < backup.sql
```

## Limits & notes
- Artifacts live 30 days (GitHub max for this setting is 90). For longer retention download a monthly copy to a private location.
- Free GitHub-hosted runners: the job takes about a minute and a few MB.
- Supabase **Pro** adds daily platform backups and point-in-time options — see roadmap OPS-5; this workflow remains a useful independent copy.
