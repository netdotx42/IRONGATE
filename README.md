# IRONGATE — Your Digital Fortress

A production-oriented MVP source package for passive website configuration analysis, private password evaluation, and verified-domain monitoring. English interface, UTC schedules and timestamps, configurable domain. No billing or currency transactions are implemented.

**Release status:** source implementation and local checks are provided. A production deployment, live Supabase configuration, DNS verification, actual email delivery, browser acceptance tests, and performance/accessibility measurements have **not** been verified. Read [VERIFICATION.md](docs/VERIFICATION.md) and [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) before release.

## Included

- Exactly five primary pages: `/`, `/tools`, `/dashboard`, `/automation`, `/settings`.
- WebShield: public DNS, HTTPS availability, trusted TLS/hostname validation, certificate expiry across HTTPS redirect hops, HTTP upgrade behavior, observable cookie attributes.
- HeaderGuard: six weighted policy checks, conservative quality heuristics, previous saved scan comparison, practical recommendations.
- KeyGuard: local zxcvbn estimation, secure password/passphrase generation using Web Crypto. No password transmission, storage, logging or analytics.
- Supabase email/password authentication, PKCE callback, recovery, session refresh, RLS, persisted scans, DNS TXT ownership challenges and account deletion.
- Daily Vercel Cron dispatcher, calendar schedules, atomic jobs and delivery leases, retries, alert cooldown/deduplication and Resend HTML/text emails.
- JSON, self-contained HTML and browser print/PDF reports using actual observations.
- Local fonts, responsive dark interface, keyboard navigation, focus indicators, Radix dialogs and lazy-loaded charts/password estimation.

## Quick start

Requirements: Node.js 24 LTS (or a supported Node.js 22.12+ LTS release), npm, a **dedicated** Supabase project, a Resend account with a verified sender, and Vercel for production scheduling.

```bash
npm ci
cp .env.example .env.local
```

Fill the environment values locally; never commit credentials. For local development use `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Without configured Supabase, the public UI and local password evaluator can render, while account and website scan requests fail safely. Website scans require the database even for anonymous users because rate and concurrency limits are database-backed.

1. Apply `supabase/migrations/202611020001_irongate.sql` once to a fresh dedicated Supabase database using its SQL editor or migration tooling. It runs inside a transaction. Do not apply this initial migration to an unrelated application database.
2. Enable Supabase email/password login and **email confirmation**. Set minimum password length to 12. Set Site URL to your app origin and allow the exact `/auth/callback` and `/auth/callback?recovery=1` redirect URLs for each intended environment.
3. Configure production authentication email delivery in Supabase. Resend alert delivery is separate from Supabase authentication email/SMTP configuration.
4. Add the public Supabase URL/key and server-only service role key. Add Resend API key, verified sender email, a random secret of at least 32 characters, and the app URL.
5. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`. Register, confirm your email, and sign in. Add a domain in Command Center, publish the displayed DNS TXT challenge, verify it, and create a monitor in AutoDefense.

## Commands

```bash
npm run typecheck
npm test
npm run test:database
npm run test:smoke
npm run build
npm start
```

`test:database` applies the real migration to an isolated PGlite PostgreSQL engine with a minimal Supabase auth schema shim. It does not connect to or change production. `test:smoke` starts a development server on port 3100 unless `E2E_BASE_URL` is set.

Browser suite:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Live database test, on a **test** Supabase project only:

```bash
# Export environment values securely in this shell first.
IRONGATE_RUN_LIVE_TESTS=true npm run test:integration
```

The opt-in test creates and removes temporary confirmed test users, domains, a monitor and a scan. It does not send email. Set `E2E_BASE_URL` and `E2E_LIVE_DOMAIN` to enable a real website scan/export browser test. The optional live account browser suite uses E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD and E2E_VERIFIED_DOMAIN, a confirmed isolated account and a preverified test domain without an existing monitor. It creates/removes a pending domain and monitor, saves scans and disables credential traces. Live email confirmation/DNS-publication/cron acceptance steps are documented in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project map

| Path | Responsibility |
| --- | --- |
| `src/app` | Five pages, API route handler and authentication callback |
| `src/components` | Shell, accessible controls, tool results, dashboard and schedules |
| `src/lib/security` | SSRF boundary, bounded HTTP, origin checks, database limits |
| `src/lib/scanning` / `scoring` | Passive observations and deterministic scoring v1.0.0 |
| `src/lib/supabase` | Separate browser, cookie-session and privileged clients |
| `src/lib/automation` / `email` | Job dispatch, comparisons, schedules and notifications |
| `supabase/migrations` | Tables, relationships, indexes, RLS and atomic RPCs |
| `tests` | Unit, contract integration, local PostgreSQL, HTTP and browser tests |

See [SECURITY.md](docs/SECURITY.md), [API.md](docs/API.md), and [DEPLOYMENT.md](docs/DEPLOYMENT.md) for implementation and operating details. Production startup rejects missing required variables. `NEXT_PUBLIC_` values are compiled into browser assets, so rebuild when those values change.
