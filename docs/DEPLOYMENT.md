# Deployment and live acceptance

## Current deployment status

**Production URL: not deployed.** No dedicated IRONGATE Supabase project or verified Resend sender has been selected/configured for this build. Existing connected projects were left unchanged. Creating a Supabase project requires the owner to select its organization and agree to any quoted cost. Do not paste credentials into a chat or commit them to source.

## Supabase setup

Use a dedicated project in a suitable region. Apply the included initial migration before enrolling users. The migration expects Supabase's `auth.users`, `auth.uid()`, `anon`, `authenticated` and `service_role` roles. It uses pgcrypto and PostgreSQL foreign keys, RLS and service-only RPCs.

All user tables have ownership-scoped SELECT policies. Browser/anonymous writes to application tables and privileged RPCs are explicitly revoked. Authorized route handlers perform writes using the server-only service role key, always checking user ownership. The application does not grant general client-side INSERT/UPDATE/DELETE policies.

Enable email confirmation and password length >=12. Configure Site URL, allowed callback/recovery URLs and appropriate authentication mail delivery. Enable leaked-password protection/MFA for the Supabase administrative account where available. Use a short access-token lifetime appropriate to your account policy; access tokens may outlive session revocation until expiry.

Before production, run the opt-in live integration test against a disposable test project. Run Supabase's security/performance advisors after applying migrations. Reconfirm RLS using two separate users against hosted PostgREST, not only the local PostgreSQL test.

## Environment

| Variable | Scope | Required behavior |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Public build + runtime | Supabase project API URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public build + runtime | Publishable key or compatible anon key |
| SUPABASE_SERVICE_ROLE_KEY | Server only | Privileged application writes and dispatcher |
| RESEND_API_KEY | Server only | Resend email send permission |
| RESEND_FROM_EMAIL | Server only | Sender on a verified Resend domain |
| CRON_SECRET | Server only | Random secret, minimum 32 characters |
| NEXT_PUBLIC_APP_URL | Public build + runtime | Exact origin; HTTPS in production |
| NEXT_PUBLIC_SUPPORT_EMAIL | Public build | Optional real operator contact |

Public values must exist during the Vercel build. Use separate values for local, preview and production environments. Origin checks intentionally reject browser mutations from an origin that does not match `NEXT_PUBLIC_APP_URL`; configure each deployment's origin deliberately. Never prefix privileged credentials with `NEXT_PUBLIC_`.

## Vercel

1. Import the source as a Next.js project, with the `irongate` directory as project root if the ZIP was extracted above it.
2. Use Node.js 24 LTS and `npm ci`; build command is `npm run build`.
3. Configure all production variables and enable Fluid Compute with a 300-second Node.js function duration. The API handler exports `maxDuration=300`. Confirm the selected plan supports this duration and the requested cron behavior.
4. Deploy to a preview or staged production environment, configure its exact app origin/callback URLs, and run live smoke tests before exposing the intended production domain.
5. `vercel.json` registers `0 6 * * *` for `/api/cron/dispatch`. Set `CRON_SECRET` so Vercel sends `Authorization: Bearer <secret>`. Cron scheduling is production-only; previews do not establish working automation.
6. Confirm the first real production invocation, job rows, saved results, alert rows and email provider delivery events. Preserve logs that contain error codes and job IDs, not passwords, credentials or complete request bodies.

Daily dispatch also selects due weekly/monthly monitors. Monthly dates clamp to the last valid day. Next runs are calculated in UTC after the completed or exhausted attempt; this is best-effort scheduling, not precise uptime monitoring. Hobby cron may invoke within its allowed daily window. See official [function duration](https://vercel.com/docs/functions/configuring-functions/duration) and [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) before release.

## Monitoring capacity and retry behavior

This MVP allows **10 monitors total per installation**, and up to 20 domains per account. Paused monitors still occupy a slot. The global monitor cap is serialized in PostgreSQL. Two workers process up to five jobs each; request scan concurrency is capped at eight using database leases. Increase dispatcher capacity and verify execution budgets before raising the cap.

Job claims use `FOR UPDATE SKIP LOCKED`, unique `(monitor_id, scheduled_for)` pairs and UUID claim tokens. A job retries at most three times. Failed attempts become eligible after 15 minutes, which normally means the next daily cron. Expired five-minute job leases can be reclaimed. Completion checks the claim token before advancing schedules. Failures remain in `scan_jobs`, and exhausted jobs generate an alert.

Alert deduplication uses a unique domain/type/day key and a 24-hour cooldown check. Delivery claims use atomic leases and preference filtering. Unsent alerts are eligible for up to seven days and at most three attempts; failed sends have a 15-minute minimum retry interval. Resend idempotency keys use the alert ID. Provider idempotency is time-limited: exactly-once delivery across database/provider failures is not guaranteed. Inspect unknown outcomes before manually retrying. `sent_at` means the API accepted a send, not that an inbox delivery event was verified.

## Live acceptance checklist

- Register two users, confirm both emails, sign in and test password recovery.
- Prove that each user can read only their own domains, scans, monitors, alerts and preferences.
- Add a DNS-controlled domain. Confirm verification fails before publishing the TXT record, then succeeds only with the exact displayed challenge.
- Run WebShield and HeaderGuard on known test hosts. Independently compare DNS, TLS, redirects and response headers. Validate negative TLS cases on controlled test fixtures.
- Save results, reload, inspect history, compare HeaderGuard results and download JSON/HTML; print to PDF.
- Enroll a verified domain, pause/resume, update schedule and confirm unverified or stale verification is rejected.
- Invoke cron without a secret (401) and with the configured secret. Confirm jobs and scans persist. Invoke twice and inspect duplicate suppression/locking.
- On a controlled domain remove a security header or use a short-lived test certificate. Confirm the correct alert, preference handling, provider API acceptance and an actual delivered email event/inbox receipt.
- Confirm the real Vercel daily invocation. Verify retry recovery, outbox failures, cooldown and expiration thresholds.
- Exercise mobile/desktop layouts, focus order, tab keys/arrows, modal focus trapping, reduced motion and screen-reader status output.
- Run Lighthouse and record actual performance, accessibility and best-practice scores. Targets are 90+, not measured results.
- Test account deletion on a throwaway account. Check cascading records and revoked sessions. Review the inline privacy and terms text for the actual operator.

Do not mark production acceptance complete until these checks pass against the deployed services.
