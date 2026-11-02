import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
let output = "";
const child = process.env.E2E_BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--webpack",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3100",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      },
    );
child?.stdout.on("data", (v) => (output += String(v)));
child?.stderr.on("data", (v) => (output += String(v)));
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child?.exitCode !== null && child) {
      throw new Error(output);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(ready, "server readiness");
  for (const [path, text] of [
    ["/", "Your digital"],
    ["/tools", "Security Lab"],
    ["/dashboard", "Command Center"],
    ["/automation", "AutoDefense"],
    ["/settings", "Account &amp; Settings"],
  ]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200, path);
    const html = await r.text();
    assert.ok(html.includes(text), path + " content");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(
      r.headers
        .get("content-security-policy")
        ?.includes("frame-ancestors 'none'"),
    );
    console.log("PASS HTTP render and security headers: " + path);
  }
  const blocked = await fetch(base + "/api/domains", {
    method: "POST",
    headers: {
      origin: "https://untrusted.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(blocked.status, 403);
  console.log("PASS cross-origin API mutation rejected");
  console.log("6 HTTP smoke checks passed");
} finally {
  child?.kill("SIGTERM");
}
