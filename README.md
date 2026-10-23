# OVYRA

_(Repository and package name: `unified-mail`, the Phase 1 working name.)_

A private, iPhone-first email productivity PWA. Single user today, built so more users can be
added securely later. **Phase 1 — Foundation** (v0.1.0): authentication, allowlisted access,
hardened schema with row-level security, typed data access, app shell, English/Spanish.

Connecting Outlook.com and Gmail accounts arrives in a later phase; until then every screen shows
a clearly labeled empty state. Message bodies and attachments are never stored. No AI features.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase Auth + Postgres · Vercel

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL, publishable key, your user id
npm run dev
```

First-time setup of Supabase (migrations, creating and authorizing your user, the `app_worker`
role) and Vercel is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

| Script                 | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Development server                                                  |
| `npm run build`        | Production build (fails if a secret is exposed via `NEXT_PUBLIC_*`) |
| `npm run lint`         | ESLint (Next.js + security rules)                                   |
| `npm run format:check` | Prettier check (`npm run format` to fix)                            |
| `npm run typecheck`    | `tsc --noEmit`                                                      |
| `npm run test`         | Unit tests                                                          |
| `npm run test:db`      | Migration, RLS and privilege tests (needs `TEST_DATABASE_URL`)      |
| `npm run e2e`          | Browser smoke test against the production build (needs PostgREST)   |
| `npm run validate`     | lint + format + typecheck + unit + db tests + build                 |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security model & threat model](docs/SECURITY.md)
- [Implementation status](docs/STATUS.md)
- Brand: [identity & usage rules](docs/brand/IDENTITY.md) · [asset inventory](docs/brand/ASSETS.md) · [accessibility review](docs/brand/ACCESSIBILITY.md)
