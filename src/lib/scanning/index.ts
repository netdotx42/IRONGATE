import {
  parseURL,
  safeRequest,
  destination,
  type Probe,
} from "../security/network";
import { score, finding, SCORING_VERSION } from "../scoring";
import type { ScanResult, Finding } from "../types";
function cspQuality(value: string) {
  const directives = value.split(";").map((v) => v.trim().split(/\s+/));
  const scripts = directives.filter((v) =>
    ["default-src", "script-src", "script-src-elem"].includes(
      v[0]?.toLowerCase(),
    ),
  );
  return (
    scripts.length > 0 &&
    scripts.every(
      (v) =>
        v.length > 1 &&
        v
          .slice(1)
          .every(
            (token) =>
              ![
                "*",
                "http:",
                "https:",
                "data:",
                "'unsafe-inline'",
                "'unsafe-eval'",
              ].includes(token.toLowerCase()),
          ),
    ) &&
    !/unsafe-inline|unsafe-eval/i.test(value)
  );
}
function hstsQuality(value: string) {
  const directives = value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => /^max-age\s*=/i.test(v));
  return (
    directives.length === 1 &&
    Number(directives[0].match(/^max-age\s*=\s*"?(\d+)"?$/i)?.[1]) >= 15552000
  );
}
function frameQuality(value: string) {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 1 && tokens[0] === "'none'") return true;
  return (
    tokens.length > 0 &&
    tokens.every(
      (token) =>
        token === "'self'" ||
        /^(?:https?:\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?$/i.test(
          token,
        ),
    )
  );
}
export function headerFindings(p: Probe): Finding[] {
  if ([405, 501].includes(p.status))
    return [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Framing protection",
    ].map((name, i) =>
      finding(
        String(i),
        name,
        null,
        1,
        "The server does not support HEAD for this response. Header behavior was not evaluated.",
        "Inspect the GET response manually or enable HEAD with equivalent security headers.",
      ),
    );
  const h = (name: string) => String(p.headers[name] ?? "");
  const csp = h("content-security-policy");
  const ancestors = csp.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1];
  const definitions: [
    string,
    string,
    number,
    (v: string) => boolean,
    string,
  ][] = [
    [
      "content-security-policy",
      "Content-Security-Policy",
      25,
      cspQuality,
      "Deploy a tested policy using nonces or hashes. Start in report-only mode; restrict script-src and object-src.",
    ],
    [
      "strict-transport-security",
      "Strict-Transport-Security",
      20,
      hstsQuality,
      "On HTTPS, use max-age=31536000 after confirming HTTPS works. Add includeSubDomains only if every subdomain supports HTTPS.",
    ],
    [
      "x-content-type-options",
      "X-Content-Type-Options",
      15,
      (v) => v.toLowerCase() === "nosniff",
      "Set X-Content-Type-Options: nosniff and serve correct content types.",
    ],
    [
      "referrer-policy",
      "Referrer-Policy",
      10,
      (v) =>
        [
          "no-referrer",
          "same-origin",
          "strict-origin",
          "strict-origin-when-cross-origin",
        ].includes(v.toLowerCase().split(",").at(-1)?.trim() ?? ""),
      "Use strict-origin-when-cross-origin or a stricter policy appropriate for the site.",
    ],
    [
      "permissions-policy",
      "Permissions-Policy",
      10,
      (v) =>
        /\w[\w-]*\s*=\s*\([^)]*\)/.test(v) &&
        !/=\s*\*/.test(v) &&
        !/\(\s*\*\s*\)/.test(v),
      "Explicitly restrict unused features, e.g. camera=(), microphone=(), geolocation=().",
    ],
    [
      "frame-policy",
      "Framing protection",
      20,
      () =>
        ancestors
          ? frameQuality(ancestors)
          : /^(DENY|SAMEORIGIN)$/i.test(h("x-frame-options")),
      "Prefer CSP frame-ancestors with the intended allowlist. For legacy browsers use DENY or SAMEORIGIN consistently; avoid conflicting policies.",
    ],
  ];
  return definitions.map(([id, name, weight, check, recommendation]) => {
    const value =
      id === "frame-policy"
        ? [csp.match(/frame-ancestors\s+[^;]+/i)?.[0], h("x-frame-options")]
            .filter(Boolean)
            .join("; ")
        : h(id);
    if (id === "strict-transport-security" && !p.url.startsWith("https:"))
      return {
        ...finding(
          id,
          name,
          null,
          weight,
          "HSTS is only applicable to HTTPS responses.",
          recommendation,
          value,
        ),
        status: "Not Applicable",
      };
    return finding(
      id,
      name,
      !!value && check(value),
      weight,
      value
        ? "Observed policy checked with conservative heuristics; application context still requires review."
        : "No enforcing header observed on the final response.",
      recommendation,
      value,
      !!value && !check(value),
    );
  });
}
export async function scan(
  raw: string,
  tool: "webshield" | "headerguard",
): Promise<ScanResult> {
  const start = Date.now(),
    u = parseURL(raw),
    deadline = start + 16000;
  await destination(u);
  let secure: Probe | undefined;
  let failure = "";
  try {
    const target = new URL(u);
    target.protocol = "https:";
    secure = await safeRequest(target.href, deadline);
  } catch (e) {
    failure =
      e instanceof Error
        ? `${"code" in e ? String(e.code) : ""} ${e.message}`
        : "Connection failed";
  }
  let findings: Finding[];
  let days: number | undefined;
  if (tool === "headerguard") {
    if (secure) findings = headerFindings(secure);
    else
      findings = [
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Framing protection",
      ].map((n, i) =>
        finding(
          String(i),
          n,
          null,
          1,
          "HTTPS response unavailable; no policy can be evaluated.",
          "Restore HTTPS and repeat the check.",
        ),
      );
  } else {
    let redirect: Probe | undefined;
    try {
      const plain = new URL(u);
      plain.protocol = "http:";
      redirect = await safeRequest(plain.href, deadline);
    } catch {
      /* A blocked or unavailable HTTP endpoint cannot establish redirect behavior. */
    }
    const cert =
      secure?.certificates
        ?.slice()
        .sort((a, b) => Date.parse(a.valid_to) - Date.parse(b.valid_to))[0] ??
      secure?.certificate;
    days = cert
      ? Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86400000)
      : undefined;
    findings = [
      finding(
        "dns",
        "Public DNS resolution",
        true,
        5,
        "Hostname resolved exclusively to public addresses.",
        "Maintain public DNS records.",
      ),
      finding(
        "https",
        "HTTPS response available",
        !!secure,
        25,
        secure
          ? `Final response: HTTP ${secure.status}.`
          : `HTTPS connection failed (${/CERT|TLS|SSL|ALTNAME|certificate|self.signed/i.test(failure) ? "certificate or TLS validation error" : "network, timeout, or transport failure"}).`,
        "Provide a publicly reachable HTTPS endpoint with a trusted certificate.",
      ),
      finding(
        "tls",
        "Trusted TLS and hostname",
        secure
          ? true
          : failure.match(/CERT|TLS|SSL|ALTNAME|certificate|self.signed/i)
            ? false
            : null,
        25,
        "TLS trust and hostname are validated by the Node.js TLS verifier on every HTTPS hop. A network failure cannot establish certificate validity.",
        "Install a valid certificate covering the hostname and complete trust chain.",
      ),
      finding(
        "expiry",
        "Certificate remaining lifetime",
        days === undefined ? null : days > 30,
        20,
        days === undefined
          ? "Certificate not available."
          : `${days} days remaining on the earliest-expiring certificate in the HTTPS redirect chain.`,
        "Renew certificates automatically; investigate expiry within 30 days.",
        cert?.valid_to,
        days !== undefined && days > 0 && days <= 30,
      ),
      finding(
        "redirect",
        "HTTP upgrades to HTTPS",
        redirect ? redirect.url.startsWith("https:") : null,
        15,
        redirect
          ? `HTTP request finished at ${new URL(redirect.url).protocol}`
          : "HTTP endpoint could not be checked.",
        "Redirect HTTP to HTTPS with 301 or 308.",
      ),
      finding(
        "cookies",
        "Observed cookie attributes",
        secure
          ? secure.headers["set-cookie"]?.length
            ? secure.headers["set-cookie"].every(
                (c) =>
                  /;\s*secure(?:;|$)/i.test(c) &&
                  /;\s*httponly(?:;|$)/i.test(c) &&
                  /;\s*samesite=(lax|strict|none)(?:;|$)/i.test(c),
              )
            : null
          : null,
        10,
        secure?.headers["set-cookie"]?.length
          ? "Checks Secure, HttpOnly and SameSite on observed Set-Cookie headers. Some non-session cookies intentionally need JavaScript access."
          : "No Set-Cookie headers observed; not tested.",
        "Use Secure, HttpOnly and an appropriate SameSite policy for session cookies.",
      ),
    ];
  }
  return {
    tool,
    hostname: u.hostname,
    url: secure?.url ?? u.href,
    ...score(findings),
    findings,
    scoring_version: SCORING_VERSION,
    started_at: new Date(start).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - start,
    certificate_days: days,
    limitations: [
      "Passive HEAD requests only; no exploitation, crawling or authenticated testing.",
      "A configuration score is not proof of security. Missing observations are not evidence of absence.",
      "TLS validation covers each HTTPS hop; expiry is the minimum observed lifetime across the redirect chain. Headers refer to the final response and use conservative heuristics, not full policy parsing.",
    ],
  };
}

export function scanStatus(result: ScanResult): "completed" | "failed" {
  return result.score === null ||
    (result.tool === "webshield" &&
      result.findings.some((f) => f.id === "https" && f.status === "Missing"))
    ? "failed"
    : "completed";
}
