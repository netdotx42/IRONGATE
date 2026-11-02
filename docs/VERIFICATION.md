# Verification record

Build date: 2 November 2026. These are observed results, not inferred production acceptance.

| Check | Result | Scope |
| --- | --- | --- |
| Strict TypeScript | Passed | Application and test TypeScript |
| Production build | Passed | Next.js Webpack, five primary pages + API/auth handlers; sandbox-only process-memory compatibility preload |
| Unit / API-contract suite | 69 passed, 1 skipped | URL/IP rejection, pinned DNS/redirect behavior, scoring, policy quality, schedules, password generation, HTML escaping, cron/auth/origin/body/email contracts; external boundaries mocked where appropriate |
| Local PostgreSQL migration suite | 22 checks passed | Exact migration in PGlite with a minimal Supabase auth schema shim; RLS, direct-write/RPC denial, ownership, schedules, leases, retries, rates, concurrency, alert uniqueness, email leases and cascade cleanup |
| HTTP smoke | 6 checks passed | HTTP 200 + expected content/security headers for all five pages; cross-origin mutation rejected |
| Full dependency audit | 0 known vulnerabilities reported | `npm audit --json`; not a security guarantee |
| Hosted Supabase integration | Skipped | Requires dedicated test project/credentials; local SQL does not validate hosted Auth/PostgREST configuration |
| External website scan smoke | Blocked | `example.com` DNS returned EAI_AGAIN; no fabricated scan scores were substituted |
| Playwright desktop/mobile | Blocked before assertions | 10 test cases attempted; Chromium process terminated with SIGTRAP in the sandbox |
| Actual DNS ownership check | Unverified | Requires a controlled domain and TXT changes |
| Resend inbox delivery | Unverified | Local contract tests validate API request shape, encoding, idempotency header and failure behavior only |
| Vercel production and actual cron | Unverified | No IRONGATE deployment configured |
| WCAG / mobile visual / Lighthouse | Unverified | Browser launch unavailable; no scores claimed |

## Reproduce local checks

```bash
npm ci
npm run typecheck
npm test
npm run test:database
npm run test:smoke
npm run build
```

On a normal host install Playwright's Chromium/dependencies and run `npm run test:e2e`. Live tests are opt-in and documented in README/DEPLOYMENT. Never use real customer accounts for destructive cleanup tests. Temporary local test fixtures are isolated from production data.

## Required acceptance still open

Hosted authentication and recovery; hosted migration/advisors/RLS; live DNS challenge; successful external WebShield/HeaderGuard results independently checked; real persisted dashboard/history; actual scheduled dispatch; delivered test email; duplicate/retry behavior under live service failures; responsive/a11y/Lighthouse browser tests; deployment and production smoke tests.

The package is a source deliverable with verified local checks. It is not represented as a fully validated live production deployment.
