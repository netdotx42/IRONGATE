import type { ScanResult } from "./types";
function e(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function reportHTML(result: ScanResult) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>IRONGATE — ${e(result.hostname)}</title><style>body{font:15px/1.7 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:24px;color:#172438}h1{letter-spacing:3px;color:#12694e}h2{font-size:24px}article{border-top:1px solid #ccc;padding:20px 0;break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f8;padding:12px}small{color:#475569}.score{font-size:32px;color:#12694e}@media print{body{margin:0;padding:0}}</style></head><body><h1>IRONGATE</h1><p>Your Digital Fortress · Passive configuration report</p><h2>${e(result.hostname)} — ${e(result.tool)}</h2><p>${e(result.url)}</p><p>UTC: ${e(result.completed_at)} · Duration: ${e(result.duration_ms)} ms · Scoring v${e(result.scoring_version)}</p><p class="score">${e(result.score ?? "Not Tested")} / 100 · Grade ${e(result.grade ?? "—")}</p>${result.findings.map((f) => `<article><h3>${e(f.name)}</h3><small>${e(f.status)} · ${e(f.severity)} · Weight ${e(f.weight)}</small>${f.value ? `<pre>${e(f.value)}</pre>` : ""}<p>${e(f.explanation)}</p><p><strong>Recommended action:</strong> ${e(f.recommendation)}</p></article>`).join("")}<h3>Methodology and limitations</h3><ul>${result.limitations.map((s) => `<li>${e(s)}</li>`).join("")}</ul><p>Configured checks earn full weight; review earns half; missing earns zero. Not Tested and Not Applicable checks are excluded. A ≥90, B ≥80, C ≥70, D ≥60, otherwise F. No applicable checks means no score.</p><p>This report is a configuration observation, not a guarantee of security.</p></body></html>`;
}
