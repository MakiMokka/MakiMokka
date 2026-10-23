# Security model and threat model

Unified Mail is a private, single-user email productivity app built so that more users can be
added safely later. It will eventually hold OAuth access to personal mailboxes, so it is
designed as if it already does.

## Assets

| Asset                                    | Where it lives                                           | Sensitivity |
| ---------------------------------------- | -------------------------------------------------------- | ----------- |
| Provider OAuth refresh/access tokens     | `app_private.oauth_credentials` (AES-256-GCM ciphertext) | Critical    |
| Credential encryption keys               | Server env `CREDENTIALS_ENCRYPTION_KEYS` (Vercel)        | Critical    |
| `app_worker` database password           | Server env `DATABASE_URL` (Vercel)                       | High        |
| Supabase session (JWT + refresh token)   | HttpOnly cookie on the user's device                     | High        |
| Message metadata (subject, sender, date) | `public.message_metadata`                                | High        |
| Follow-ups, tasks, saved views           | `public.*`                                               | Medium      |
| Audit trail                              | `audit.events` (append-only)                             | Medium      |

Message **bodies, previews/snippets and attachments are never stored**. A schema test fails if a
column resembling them is ever added.

## Trust boundaries

```
iPhone/desktop browser ──HTTPS──▶ Vercel (Next.js proxy, server components, actions, route handlers)
                                     │                         │
                         Supabase Auth + Data API      Postgres pooler as app_worker
                         (user JWT, RLS enforced)      (operational schemas, audit)
                                     │                         │
                                     └──────── Postgres ───────┘
```

The browser never talks to Supabase, Microsoft or Google directly (`connect-src 'self'`). There is
no browser Supabase client; the ESLint config forbids `createBrowserClient`.

## Controls

### Authentication

- Supabase Auth email one-time **code** (not magic link, so it works inside an installed iOS PWA).
- `shouldCreateUser: false` and `enable_signup = false`: nobody can self-register. Users are created
  by the operator.
- Responses to "send code" are identical whether or not the email exists (no account enumeration).
- Identity always comes from `supabase.auth.getClaims()`, which verifies the JWT signature and
  expiry; unverified cookie contents are never trusted.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production. JavaScript cannot read
  them, and nothing is stored in `localStorage`/`sessionStorage` (ESLint rule + E2E assertion).
- Sign out of this device or of all devices (`scope: global`).
- Supabase's built-in auth rate limits apply (`[auth.rate_limit]` in `supabase/config.toml`; the
  hosted project's limits are configured in the dashboard).

### Authorization (defense in depth)

1. **App allowlist** — `AUTH_ALLOWED_USER_IDS` (server-only). `decideAccess()` is the single decision
   point. A verified user who is not listed is signed out of every session and redirected to
   `/unauthorized`; the attempt is audited.
2. **Database allowlist** — `app_private.authorized_users`. Every RLS policy requires
   `app_security.is_authorized()`; revoking a row cuts off access immediately, even with a valid JWT.
3. **Per-boundary checks** — `proxy.ts` only redirects optimistically. Every layout/page
   (`requireAuthorizedUser`), server action and route handler (`requireAuthorizedApiUser`) re-checks.
4. **Account ownership** — `requireOwnedMailAccount(ctx, accountId)` must be called by any handler
   receiving an account id. Unknown _and_ foreign ids both return 404 so other users' accounts cannot
   be discovered.
5. **Composite foreign keys** — children reference `(id, user_id)` of their parent, so a row can
   never link to another user's account or message, even though FK checks bypass RLS.

### Database privileges

- Supabase's default `GRANT ALL` to `anon`/`authenticated` is revoked; minimal grants are re-added.
- `anon`: nothing. `authenticated`: own rows only; column-level `UPDATE` grants exclude `id`,
  `user_id`, `status` and provider fields. Users cannot create, delete or re-status mail accounts or
  modify message metadata.
- `app_private`, `audit`: not exposed through the Data API, no grants to API roles or `service_role`.
- `app_worker`: `NOLOGIN` until an operator enables it; not superuser, no `BYPASSRLS`, read-only on
  the allowlist, insert/select only on audit, no access to user-authored data or `auth.*`.
- `audit.events` is append-only via triggers that block `UPDATE`/`DELETE`/`TRUNCATE` for everyone,
  including the owner.
- Every `SECURITY DEFINER` function pins `search_path = ''` (tested).
- The service-role key is **not used anywhere**. A build-time guard refuses to build if a secret
  (service-role JWT, `sb_secret_*`, Postgres URL, or a secret-like name) is placed in `NEXT_PUBLIC_*`.

### Credential storage (ready for Phase 2)

- AES-256-GCM in the application; Postgres only stores ciphertext, 12-byte nonce, 16-byte tag and
  key version (sizes enforced by `CHECK` constraints).
- Additional authenticated data binds each ciphertext to `(user_id, account_id)`: a ciphertext copied
  to another row fails to decrypt (tested end-to-end).
- Versioned keyring for rotation (`needsRotation()`); keys are 32 random bytes from env, never in
  the database.
- Upserts cannot overwrite another user's credential; the repository raises
  `CredentialOwnershipError` instead of silently doing nothing.
- Tokens are never returned to the browser, logged, or put in URLs.

### Browser and HTTP hardening

- Per-request nonce CSP: `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-inline` or
  `unsafe-eval` in production, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'none'`, `form-action 'self'`, `upgrade-insecure-requests`. The E2E suite asserts zero CSP
  violations on every screen.
- `HSTS` (production), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP
  `same-origin`, restrictive `Permissions-Policy`, `X-Powered-By` removed, `robots: noindex`.
- API responses: `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'`, generic
  error bodies with a request id; stack traces and internal messages are never returned.
- Server actions: Next.js enforces same-origin `Origin`/`Host` checks; all inputs validated with Zod.
- Redirect targets are restricted to same-site relative paths (`safeRedirectPath`).
- The service worker never caches pages or API responses — only a static offline page and an icon.

### Logging

- One structured logger (`src/lib/logging/logger.ts`); `no-console` is enforced elsewhere.
- Keys such as token, secret, password, cookie, authorization, code, email, subject, body, content
  are redacted at any depth; JWTs, bearer tokens, Supabase keys, Postgres URLs and email addresses are
  scrubbed from free text.
- Sync tables accept only machine error codes (`^[a-z0-9_.:-]{1,64}$`), so provider responses or
  message text cannot be persisted as "error messages".
- Audit metadata is restricted to an allowlist of keys with short, character-restricted values.

## Threats (STRIDE) and mitigations

| #   | Threat                                           | Mitigation                                                                                | Residual risk                                                                                             |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| S1  | Stranger signs up or signs in                    | Sign-ups disabled; `shouldCreateUser:false`; two allowlists                               | Low                                                                                                       |
| S2  | Stolen session cookie                            | HttpOnly + Secure + SameSite; "sign out of all devices" revokes refresh tokens            | An access JWT stays valid until it expires (Supabase default 1 h); lower JWT expiry to shrink this window |
| S3  | Forged JWT                                       | `getClaims()` verifies signature; PostgREST verifies again                                | Low                                                                                                       |
| S4  | OTP brute force                                  | Supabase rate limits and code expiry (10 min recommended)                                 | Depends on hosted limits — review in dashboard                                                            |
| T1  | User edits another user's rows                   | RLS `user_id = auth.uid()` on USING and WITH CHECK; column grants                         | Low (tested)                                                                                              |
| T2  | Cross-tenant references (IDOR via FK)            | Composite `(id, user_id)` foreign keys                                                    | Low (tested)                                                                                              |
| T3  | Tampering with audit history                     | Append-only triggers; app_worker lacks UPDATE/DELETE                                      | A database owner can still disable triggers                                                               |
| R1  | Denying a security-relevant action               | Audit events for sign-in, denied sign-in, sign-out, settings changes                      | Audit writes are best-effort (logged on failure)                                                          |
| I1  | Token theft via database dump/backup             | Application-layer encryption; keys only in env                                            | Env + DB compromise together exposes tokens                                                               |
| I2  | Token/content leakage via logs                   | Redacting logger; error-code-only columns; no body storage                                | New code must use the logger                                                                              |
| I3  | XSS exfiltrates session or data                  | Nonce CSP, React escaping, `react/no-danger` lint, HttpOnly cookies, `connect-src 'self'` | Low                                                                                                       |
| I4  | Service-role key leaks to the browser            | Key not used; build guard on `NEXT_PUBLIC_*`                                              | Low                                                                                                       |
| I5  | Account enumeration                              | Identical OTP responses; 404 for foreign account ids                                      | Low                                                                                                       |
| I6  | Cached private pages on shared devices           | Dynamic `no-store` pages; SW caches nothing private                                       | Browser history remains                                                                                   |
| D1  | Request floods                                   | Vercel platform protections; Supabase rate limits                                         | No app-level rate limiting yet (planned before multi-user)                                                |
| E1  | Privilege escalation via `SECURITY DEFINER`      | Fixed `search_path`; functions in non-exposed schemas; `EXECUTE` revoked from `PUBLIC`    | Low (tested)                                                                                              |
| E2  | Leaked `DATABASE_URL`                            | Connects as least-privilege `app_worker`, not `postgres`                                  | Attacker could read ciphertext and metadata; rotate the password                                          |
| E3  | Proxy matcher change silently removes protection | Every page/action/handler re-checks authorization itself                                  | Low                                                                                                       |

## Operational guidance

- Rotate the `app_worker` password and the credential keys if `DATABASE_URL` or
  `CREDENTIALS_ENCRYPTION_KEYS` may have leaked. Add the new key version, set it active, re-encrypt,
  then remove the old version.
- To remove someone's access: delete their row from `app_private.authorized_users` **and** remove
  their id from `AUTH_ALLOWED_USER_IDS`, then redeploy.
- Never add a column for bodies/snippets/attachments; the schema test will fail by design.
- Corporate Microsoft 365 tenants are intentionally out of scope until a separate review.

## Known gaps (tracked for later phases)

- No application-level rate limiting on server actions.
- No MFA enforcement (Supabase supports TOTP; consider enabling before adding users).
- Audit writes are best-effort; a failed write does not block the action.
- `supabase db lint` and the Supabase-image migration job run in CI only; they were not executed in
  the development environment (no Docker daemon there).
