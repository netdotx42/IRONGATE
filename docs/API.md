# API reference

The modular-monolith API is routed through `src/app/api/[...path]/route.ts` on the Node.js runtime. Paths below are relative to `/api`. Authentication uses Supabase session cookies, not a public API key interface.

Successful JSON: `{"data": ...}`. Error JSON: `{"error":{"code":"FIXED_CODE","message":"safe description"}}`. All JSON responses are no-store. Mutation requests require `Content-Type: application/json` and Origin matching the configured app origin. Request bodies are capped at 8 KiB. The export endpoint returns an attachment rather than the JSON envelope.

| Method | Path | Input / behavior |
| --- | --- | --- |
| POST | /tools/webshield | `{url, save?: boolean}`; anonymous scans allowed, save requires authentication |
| POST | /tools/headerguard | Same input and save rules |
| GET | /domains | Owned domain list and TXT challenges |
| POST | /domains | `{hostname}`; up to 20 per account |
| DELETE | /domains/:id | Delete owned domain and cascading associated data |
| POST | /domains/:id/verify | Read DNS TXT and verify exact challenge |
| GET | /scans | Paginated history; `page=0` (20 per page); optional `hostname` and `tool` filters |
| GET | /scans/:id | Owned saved scan |
| POST | /scans/:id/export | Download saved result JSON |
| GET | /dashboard | Owned domains/monitors, latest 100 scans and latest 50 alerts |
| GET | /monitors | Owned schedules |
| POST | /monitors | `{domain_id, frequency: daily|weekly|monthly}`; current verified ownership required; installation cap 10 |
| PATCH | /monitors/:id | `{enabled?, frequency?}`; current verification required to enable |
| DELETE | /monitors/:id | Remove owned monitor and its jobs |
| GET | /alerts | Latest 100 owned alerts |
| PATCH | /alerts/:id | Acknowledge an owned alert |
| GET | /settings | Account email, preferences and retention information |
| PATCH | /settings | `{email_enabled, ssl_alerts, header_alerts, summary_enabled:false}` |
| DELETE | /settings | `{confirmation:"DELETE"}`; global sign-out then cascading account deletion |
| GET | /cron/dispatch | Exact Bearer cron secret; not a user-session endpoint |

Password evaluation has **no server endpoint**. Authentication calls go directly to Supabase via its supported browser client. `/auth/callback` is a Route Handler, not another primary page.

Expected errors include INVALID_INPUT, INVALID_URL, BLOCKED_DESTINATION, INVALID_ORIGIN, UNAUTHORIZED, NOT_FOUND, RATE_LIMITED, SCAN_CAPACITY_REACHED, DOMAIN_NOT_VERIFIED, LIMIT_REACHED, RESOURCE_ALREADY_EXISTS, TXT_NOT_FOUND, SERVICE_UNAVAILABLE and safe generic request/database failures. Failures do not expose internal network addresses, SQL or secrets.

HTML and print/PDF exports are generated from the displayed result in the browser. Saved scans can also be downloaded through the authenticated export route. Prior-result comparison only uses actual saved records matching the hostname/tool.
