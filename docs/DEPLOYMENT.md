# Deployment

Production runs on **Vercel** (Next.js) and **Supabase** (Auth + Postgres). Nothing below asks
for corporate Microsoft 365 access, and no provider OAuth app is needed until Phase 2.

> Every value marked `<…>` comes from your own Supabase/Vercel accounts. Do not reuse examples.

## 1. Supabase project

1. Create a project (choose a region close to you and to your Vercel region).
2. **Authentication → Sign In / Providers**
   - Email provider: enabled. **Allow new users to sign up: off.**
   - Email OTP expiration: `600` seconds; OTP length `6`.
3. **Authentication → Emails → Templates → Magic Link**: the body must contain `{{ .Token }}`
   (the app asks for the code; it does not use the link). `supabase/templates/magic_link.html`
   has a ready-made template.
4. **Authentication → URL Configuration**: Site URL = your production URL
   (e.g. `https://<your-app>.vercel.app`).
5. **Project Settings → JWT Keys**: prefer asymmetric signing keys (ECC P-256). The app's
   `getClaims()` then verifies sessions locally via JWKS; with legacy symmetric keys it falls back
   to a network call to Supabase Auth on each check (still secure, slower).
6. **Project Settings → Data API**: exposed schemas = `public` only.
7. **Authentication → Rate Limits**: review the email and verification limits.

## 2. Apply the database migrations

```bash
npx supabase@2.121.0 login
npx supabase@2.121.0 link --project-ref <project-ref>
npx supabase@2.121.0 db push          # applies supabase/migrations/* in order
```

## 3. Create and authorize your user

1. **Authentication → Users → Add user → Create new user** with your email (auto-confirm).
2. Copy the new user's **UID**.
3. In the **SQL Editor**, authorize it (this also creates the profile):

```sql
insert into app_private.authorized_users (user_id, note)
values ('<your-user-uid>', 'owner');
```

## 4. Enable the least-privilege server role

The server connects to Postgres as `app_worker` (no superuser, no RLS bypass). Migrations
create it with `NOLOGIN`; give it a password yourself:

```bash
openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40   # generate a password locally
```

```sql
alter role app_worker with login password '<generated-password>';
```

Connection string (Supabase **Connect → Transaction pooler**, port 6543), with the user replaced:

```
postgresql://app_worker.<project-ref>:<generated-password>@<pooler-host>:6543/postgres?sslmode=require
```

## 5. Vercel

1. Import the GitHub repository (framework preset: Next.js, Node.js 22).
2. Environment variables (Production, and Preview if you use preview deployments with a
   separate Supabase project):

| Variable                               | Value                                                     |
| -------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project-ref>.supabase.co`                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) — never a secret key |
| `AUTH_ALLOWED_USER_IDS`                | Your user UID (comma-separate additional users)           |
| `DATABASE_URL`                         | The `app_worker` pooler URL from step 4 (mark Sensitive)  |

`CREDENTIALS_ENCRYPTION_KEYS` / `CREDENTIALS_ACTIVE_KEY_VERSION` are only needed once account
connection ships (Phase 2). Generate with `openssl rand -base64 32`, store as `1:<key>`.

3. Deploy. The build fails on purpose if a secret is placed in a `NEXT_PUBLIC_*` variable.

## 6. Verify

1. `GET https://<your-app>/api/health` → `{"status":"ok","version":"0.1.0"}`.
2. Open the app, request a code, sign in. You land on **Inbox** with "No mail accounts connected".
3. **Settings → Security & sessions** lists "Signed in" (proves the `app_worker` connection works).
4. In a private window, try another email: it must never get in.

## 7. Install on iPhone

Safari → open the app → Share → **Add to Home Screen**. It launches standalone with safe-area
support. Sign-in codes are typed in-app, so the session stays inside the installed app.

## Local development

```bash
npm install
cp .env.example .env.local        # fill in values
npm run dev                        # http://localhost:3000
```

Use either a separate hosted Supabase project for development, or the local stack
(`npx supabase@2.121.0 start`, requires Docker): it prints a local API URL and publishable key,
Studio at http://localhost:54323 (create your user there and authorize it with the SQL above), and
sign-in emails arrive in Mailpit at http://localhost:54324. `DATABASE_URL` is optional in
development (audit logging is then disabled with a warning).

## Tests

```bash
npm run lint && npm run format:check && npm run typecheck
npm run test                                   # unit tests
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unified_mail_test npm run test:db
npm run build && POSTGREST_BIN=/path/to/postgrest npm run e2e
```

`test:db` and `e2e` need a disposable local Postgres 15+ where the URL's user is a superuser; they
drop and recreate their databases. `e2e` also needs the PostgREST binary and Playwright Chromium.

## Rollback

- App: promote the previous deployment in Vercel.
- Database: migrations are forward-only; write a new migration to revert a change. Take a backup
  (Supabase → Database → Backups) before applying migrations to production.
