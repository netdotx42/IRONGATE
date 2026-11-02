# Known limitations and deferred work

## Release blockers still requiring live configuration/validation

- No production URL has been deployed. No remote database migration or hosted RLS verification is claimed.
- A dedicated Supabase project/organization, production app origin, credentials, authentication email setup and verified Resend sender still need operator selection/configuration.
- Actual sign-up/confirmation, recovery, live DNS ownership, scan persistence against hosted Supabase, real cron dispatch and an inbox-delivered email have not been verified.
- The build sandbox could not resolve `example.com` (`EAI_AGAIN`). External scan methodology is implemented, but no successful live external scan is claimed from this environment.
- Chromium exits with SIGTRAP before browser assertions. The included desktop/mobile Playwright suite was attempted but did not run successfully. Responsive CSS and six HTTP smoke checks do not establish visual, keyboard, mobile, WCAG or Lighthouse acceptance.
- No measured Lighthouse/Core Web Vitals results. The requested 90+ values remain targets.

## Intentional MVP boundaries

- Ten total monitor slots per installation; twenty domains per account. The installation cap keeps a daily two-worker dispatcher bounded. Paused monitors retain their slot. Scaling requires capacity changes and another execution-budget/load test.
- Daily best-effort cron; no subdaily monitoring. Retry eligibility does not create another cron invocation. A failed job normally retries on a later daily dispatch and stops after three attempts.
- Alerts require current confirmed account email; a separate arbitrary email destination is not supported. Change the account email through a future verified email-change flow if needed. Weekly summaries and additional notification types are deferred.
- Delivery attempts are leased and retried for seven days, up to three attempts. Resend API acceptance is recorded, not verified inbox delivery. Resend idempotency is time-limited, so unknown delivery outcomes after its deduplication window require operator review; exactly-once delivery is not guaranteed.
- Dashboard posture/findings use the latest tool result per hostname within the latest 100 saved scans. History is paginated; trends show the latest 20 scored observations. No fabricated history or live counters.
- HEAD only. No crawling, content download, authenticated checks, port scanning, exploitation or remediation. Unsupported HEAD marks header analysis Not Tested.
- DNS uses the first validated public address; no automatic address-family fallback. Every returned address must be public. Private targets, IP literals and nonstandard ports are deliberately unsupported.
- Header policies use conservative heuristics, not complete parsers or application-specific testing. Cookie/session intent is unknown. Results may differ by region/CDN/user agent or change after the scan.
- Browser Supabase sessions use JavaScript-readable cookies. CSP currently permits inline rendering code/styles; a strict nonce CSP/BFF session architecture is deferred.
- Public scans need Supabase for atomic rate/concurrency limits. Missing services do not fall back to unsafe in-memory limits or simulated results.
- Scan retention is until user/domain deletion; there is no automatic scan-retention timer. Rate buckets are cleaned by dispatch. Profiles are not an editable name/avatar system.
- Inline terms/privacy text is an MVP operator template and needs review for the actual deployment. Support email is configurable and is not invented.
- No billing, teams, public API, AI, browser extension, mobile app, automatic remediation or invasive testing.

## Environment-only build notes

The sandbox does not expose the process memory information used by Node/Next/Vitest. A scratch-only preload caught that unavailable API to allow the production build/test runner to execute. It is **not** bundled in the source ZIP, does not alter application logic or test assertions, and is not needed on a normal Node.js host. The project uses Webpack because the sandbox's Turbopack persistence also failed. Pinned dependencies and the lockfile are included.

Do not interpret local checks as complete production security certification. Follow the live acceptance checklist before public launch.
