# Implementation status — Phase 1 (Foundation)

Version **0.1.0** · Report date 2026-10-23

## Summary

The foundation is implemented and validated locally: authentication with an allowlist, a
hardened database schema with RLS, typed data access with a server-side authorization layer, an
iOS-style responsive PWA shell with English/Spanish, and CI. **No mail account can be connected
yet**; every screen says so plainly, and nothing simulates a connection.

## Requirements

| #   | Requirement                                                 | Status | Notes                                                                                                                             |
| --- | ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Strict TypeScript, lint, format, tests                      | Done   | `strict` + `noUncheckedIndexedAccess`; ESLint with security rules; Prettier; Vitest; Playwright smoke                             |
| 2   | Supabase Auth                                               | Done   | Email one-time code via server actions; HttpOnly session cookies; no browser Supabase client                                      |
| 3   | Allowlist of user IDs                                       | Done   | `AUTH_ALLOWED_USER_IDS` + `app_private.authorized_users` enforced in every RLS policy                                             |
| 4   | Schema for all listed entities                              | Done   | profiles, mail_accounts, oauth_credentials, message_metadata, sync_state, sync_jobs, follow_ups, tasks, saved_views, audit events |
| 5   | FKs, uniqueness, indexes, RLS, restricted schemas           | Done   | Composite ownership FKs; `app_private`/`audit` not exposed; `app_worker` least-privilege role                                     |
| 6   | Typed DB access + server authorization layer                | Done   | `lib/db/*`, `lib/auth/*`; `requireOwnedMailAccount` for every account-scoped request                                              |
| 7   | Responsive app shell and navigation                         | Done   | Tab bar (phone) / sidebar (desktop); safe areas; dark mode                                                                        |
| 8   | Inbox, search, actions, follow-ups, settings + empty states | Done   | Real queries; distinct empty vs. error states; settings: profile, mail accounts, language, security, about                        |
| 9   | Documentation + threat model                                | Done   | `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`                                                     |
| 10  | CI + migration tests                                        | Done   | `.github/workflows/ci.yml` (4 jobs); 58 database tests                                                                            |
| —   | PWA installable, version under product name, en/es          | Done   | Manifest + icons + SW; version shown on login, sidebar, settings, about                                                           |
| —   | No AI features                                              | Done   | None present                                                                                                                      |

## Validation results (executed in the development container, 2026-10-23)

| Command                                                      | Result                                              |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `npm run lint`                                               | Pass (0 problems)                                   |
| `npm run format:check`                                       | Pass                                                |
| `npm run typecheck`                                          | Pass                                                |
| `npm run test` (unit)                                        | Pass — 9 files, 78 tests                            |
| `npm run test:db` (Postgres 16.15)                           | Pass — 3 files, 58 tests                            |
| `npm run build` (Next.js 16.4.2)                             | Pass — all routes dynamic, no env required to build |
| `npm run e2e` (production build, PostgREST 12.2.3, Chromium) | Pass — 16/16 checks                                 |
| `npm audit --omit=dev --audit-level=high`                    | 0 vulnerabilities                                   |

A mutation check was also run: weakening one RLS policy and one column grant made 5 database tests
fail, confirming the suite detects regressions. Testing found and fixed two real defects during
development: a credential upsert that silently no-op'd for a foreign account, and the profile form
losing typed input after a validation error.

### What the E2E run covers

Production server with a real Postgres + real PostgREST. A small stand-in for Supabase Auth (JWKS,
OTP request/verify, logout) issues genuinely signed ES256 JWTs, which the app verifies with
`getClaims()` as in production. It checks: redirects, 401/404 API behavior, sign-in, HttpOnly
cookies and empty web storage, all empty states, audit logging through `app_worker`, profile save
through RLS, Spanish switch persisted to the profile, ownership enforcement on foreign accounts,
desktop sidebar with version, manifest and service worker, sign-out, denial + audit of a valid but
non-allowlisted user, wrong-code handling, zero CSP violations, and no tokens/codes in server logs.

## Not verified here (requires your accounts or Docker)

- **Hosted Supabase Auth** (real email delivery, rate limits, the Magic Link template with
  `{{ .Token }}`) — exercised only through the local stand-in.
- **Migrations on the official Supabase Postgres image** and `supabase db lint` — the CI `supabase`
  job does this, but it could not run here (no Docker daemon). Locally, migrations ran as a
  superuser on vanilla Postgres 16 with a shim of Supabase's roles and default grants.
- **Vercel deployment** and the `app_worker` login through the Supabase pooler
  (`app_worker.<project-ref>` user format).
- **Installation on a physical iPhone** — verified with Playwright's iPhone 15 Pro emulation only.
- The GitHub Actions workflow has not run yet (nothing has been pushed).

## Deliberately not built (per constraints)

- Microsoft Graph / Gmail integration, OAuth flows, sync workers — Phase 2+.
- Corporate Microsoft 365 access.
- AI features.
- Any seeded or simulated mail account or message.

## Suggested next steps (Phase 2)

1. Personal Microsoft (consumer `/consumers` authority) and Gmail OAuth with PKCE, server-side
   callback, `storeCredential()` + `mail_accounts` insert as `app_worker`, token revocation on
   disconnect.
2. Sync worker (Vercel Cron or Supabase scheduled function) consuming `app_private.sync_jobs` with
   `FOR UPDATE SKIP LOCKED`, writing metadata only.
3. App-level rate limiting for server actions; optional TOTP MFA.
4. Create/complete tasks and follow-ups (schema and RLS are ready).
