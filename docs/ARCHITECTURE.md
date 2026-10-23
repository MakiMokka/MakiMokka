# Architecture

## Stack

- **Next.js 16** App Router, React 19, TypeScript (strict + `noUncheckedIndexedAccess`).
- **Tailwind CSS 4** with the OVYRA design system: tokens in `src/styles/tokens.css`, Tailwind
  mapping, materials and type scale in `src/app/globals.css`, shared component styles in
  `src/components/styles.ts` (see `docs/brand/IDENTITY.md`).
- **Supabase Auth** (email one-time code) and **Postgres** (RLS everywhere).
- **Vercel** hosting. Cache Components/PPR are deliberately off: every page is private and
  rendered per request under a nonce-based CSP.

## Layout

```
src/
  proxy.ts                    Per-request CSP nonce, session refresh, optimistic redirects
  app/
    (public)/login            Email code sign-in (server action)
    (public)/unauthorized     Signed in but not allowlisted
    (app)/layout.tsx          requireAuthorizedUser() + AppShell
    (app)/inbox|search|actions|follow-ups
    (app)/settings/{profile,accounts,language,security,about}
    api/health                Liveness
    api/accounts[/id]         Typed JSON API with ownership checks
    manifest.ts               PWA manifest
  components/                 App shell, tab bar/sidebar, iOS grouped lists, empty states, icons
  lib/
    auth/                     allowlist, access decision, session context, account ownership
    supabase/                 Server client + proxy session refresh (HttpOnly cookies)
    db/types.ts, columns.ts   Database types + exact column manifest (drift-tested)
    db/queries/               User-scoped queries through RLS (Supabase client)
    db/repositories/          app_worker queries (audit, encrypted credentials)
    db/worker.ts              postgres.js connection as app_worker (DATABASE_URL)
    crypto/credentials.ts     AES-256-GCM keyring, AAD binding, rotation
    env/                      Zod-validated server env; values never echoed
    i18n/                     en/es dictionaries, locale resolution, formatting
    logging/logger.ts         Structured, redacting logger
    security/                 CSP, headers, NEXT_PUBLIC secret guard
supabase/
  migrations/                 0100 schemas/roles · 0200 tables · 0300 grants + RLS
  config.toml                 Local stack config (sign-ups off, OTP template)
tests/
  unit/                       Vitest (node + jsdom)
  db/                         Migration/RLS/privilege tests against real Postgres
scripts/e2e/                  Playwright smoke test: production build + PostgREST + JWKS stand-in
```

## Request flow

1. `proxy.ts` generates a nonce, sets the CSP, refreshes the Supabase session cookie and redirects
   anonymous users to `/login` (and non-allowlisted users to `/unauthorized`). It is a convenience,
   not the security boundary.
2. Pages call `getPageContext()` → `requireAuthorizedUser()`, which verifies the JWT with
   `getClaims()` and checks the allowlist. Route handlers call `requireAuthorizedApiUser()` inside
   `withApiHandler()`; server actions call `requireAuthorizedUser()`/`getAuthContext()` themselves.
3. Data access:
   - **User data** → `lib/db/queries` with the request-scoped Supabase client. RLS enforces
     ownership and the DB allowlist; queries also filter by `ctx.userId` explicitly and select
     explicit column lists.
   - **Operational data** (audit, credentials, sync) → `lib/db/repositories` over the `app_worker`
     connection, always scoped by an authorized user id passed in by the caller.
4. Query helpers return `{ ok, data } | { ok: false, errorCode }` so screens distinguish "empty"
   from "failed" and never show an error as an empty mailbox.

## Data model

| Table                                | Schema      | Written by             | Read by    |
| ------------------------------------ | ----------- | ---------------------- | ---------- |
| `profiles`                           | public      | trigger, owner (prefs) | owner      |
| `mail_accounts`                      | public      | app_worker (OAuth)     | owner      |
| `message_metadata`                   | public      | app_worker (sync)      | owner      |
| `follow_ups`, `tasks`, `saved_views` | public      | owner                  | owner      |
| `authorized_users`                   | app_private | operator (SQL)         | RLS helper |
| `oauth_credentials`                  | app_private | app_worker             | app_worker |
| `sync_state`, `sync_jobs`            | app_private | app_worker             | app_worker |
| `events`                             | audit       | app_worker (append)    | app_worker |

## Adding a table (checklist)

1. New migration file; never edit an applied one.
2. Owner column `user_id`; composite FK `(parent_id, user_id)` for user-owned parents.
3. `revoke all … from public, anon, authenticated`, then minimal grants (column-level `UPDATE`).
4. `enable row level security` + policies using `user_id = (select auth.uid()) and (select app_security.is_authorized())`.
5. Index every foreign key's leading column.
6. Update `src/lib/db/columns.ts` and `src/lib/db/types.ts`; `npm run test:db` enforces both.
7. Add RLS tests for cross-user access.

## Internationalization

`src/lib/i18n/dictionaries/{en,es}.ts`. The Spanish dictionary is typed as the English shape, and
unit tests check identical keys, matching `{placeholders}` and no empty strings. Locale order:
profile → `um_locale` cookie → `Accept-Language` → English. Dates use `en-US`/`es-MX` and the
profile time zone.

## PWA

`manifest.ts` (standalone, `start_url=/inbox`, any + maskable icons), Apple touch icon, safe-area
utilities (`pt-safe`, `pb-safe`, `px-safe`, `pb-tabbar`), `viewport-fit=cover`, and a service
worker that only caches a static offline page and an icon. Icons are generated by
`scripts/generate-icons.py`.
