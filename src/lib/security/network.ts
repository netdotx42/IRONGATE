import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
export function publicIP(address: string) {
  if (address === "168.63.129.16") return false;
  try {
    const ip = ipaddr.parse(address);
    return (
      ip.range() === "unicast" &&
      !(ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
    );
  } catch {
    return false;
  }
}
export function parseURL(raw: string) {
  if (raw.length > 2048 || /[\s\\\u0000-\u001f]/.test(raw))
    throw new Error("INVALID_URL");
  const source = raw.includes("://") ? raw : `https://${raw}`;
  const authority = source.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || authority.includes("@") || authority.includes("%"))
    throw new Error("INVALID_URL");
  const u = new URL(source);
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && u.port !== (u.protocol === "https:" ? "443" : "80"))
  )
    throw new Error("INVALID_URL");
  const hostname = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // Hostnames only: explicitly reject literal and WHATWG-normalized ambiguous IP addresses.
  if (
    isIP(hostname) ||
    !hostname.includes(".") ||
    hostname.endsWith(".") ||
    hostname.length > 253 ||
    !hostname
      .split(".")
      .every((x) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x)) ||
    /\.(localhost|local|internal|test|invalid)$/.test(hostname)
  )
    throw new Error("BLOCKED_DESTINATION");
  u.hash = "";
  return u;
}
export async function destination(u: URL) {
  const addresses = await Promise.race([
    dns.lookup(u.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error("DNS_TIMEOUT")), 2500);
      t.unref();
    }),
  ]);
  if (!addresses.length || addresses.some((a) => !publicIP(a.address)))
    throw new Error("BLOCKED_DESTINATION");
  return addresses[0];
}
export type Probe = {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  certificate?: {
    valid_to: string;
    valid_from: string;
    subjectaltname?: string;
  };
  certificates?: { hostname: string; valid_to: string; valid_from: string }[];
  authorized?: boolean;
};
export async function safeRequest(
  raw: string,
  deadline = Date.now() + 12000,
  redirects = 0,
): Promise<Probe> {
  if (redirects > 3 || Date.now() > deadline) throw new Error("REQUEST_LIMIT");
  const u = parseURL(raw),
    ip = await destination(u);
  if (Date.now() > deadline) throw new Error("REQUEST_TIMEOUT");
  const result = await new Promise<Probe>((resolve, reject) => {
    const transport = u.protocol === "https:" ? https : http;
    const req = transport.request(
      u,
      {
        method: "HEAD",
        agent: false,
        family: ip.family,
        maxHeaderSize: 16384,
        headers: {
          "User-Agent": "IRONGATE/1.0 passive configuration check",
          Accept: "*/*",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, ip.address, ip.family),
        ...(u.protocol === "https:"
          ? { servername: u.hostname, rejectUnauthorized: true }
          : {}),
      },
      (res) => {
        const socket = res.socket as tls.TLSSocket;
        const cert = socket.getPeerCertificate?.();
        const output: Probe = {
          url: u.href,
          status: res.statusCode ?? 0,
          headers: res.headers,
          certificate: cert?.valid_to
            ? {
                valid_to: cert.valid_to,
                valid_from: cert.valid_from,
                subjectaltname: cert.subjectaltname,
              }
            : undefined,
          certificates: cert?.valid_to
            ? [
                {
                  hostname: u.hostname,
                  valid_to: cert.valid_to,
                  valid_from: cert.valid_from,
                },
              ]
            : [],
          authorized: socket.authorized,
        };
        res.destroy();
        resolve(output);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("REQUEST_TIMEOUT")),
      Math.max(1, Math.min(5000, deadline - Date.now())),
    );
    timer.unref();
    req.on("error", reject);
    req.on("close", () => clearTimeout(timer));
    req.end();
  });
  if (
    [301, 302, 303, 307, 308].includes(result.status) &&
    result.headers.location
  ) {
    const next = new URL(result.headers.location, u);
    if (u.protocol === "https:" && next.protocol !== "https:")
      throw new Error("INSECURE_REDIRECT");
    const final = await safeRequest(next.href, deadline, redirects + 1);
    return {
      ...final,
      certificates: [
        ...(result.certificates ?? []),
        ...(final.certificates ?? []),
      ],
    };
  }
  return result;
}
