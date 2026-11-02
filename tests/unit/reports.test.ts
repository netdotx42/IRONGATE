import { it, expect } from "vitest";
import { reportHTML } from "../../src/lib/reports";
import { finding } from "../../src/lib/scoring";
it("exports actual observations and escapes untrusted headers", () => {
  const html = reportHTML({
    tool: "headerguard",
    hostname: "example.com",
    url: "https://example.com",
    score: 50,
    grade: "F",
    scoring_version: "1.0.0",
    started_at: "2026-11-02T00:00:00Z",
    completed_at: "2026-11-02T00:00:01Z",
    duration_ms: 1000,
    limitations: ["Passive only"],
    findings: [
      finding(
        "csp",
        "CSP",
        false,
        25,
        "Observed test finding",
        "Set a tested policy",
        "<script>alert(1)</script>",
      ),
    ],
  });
  expect(html).toContain("Observed test finding");
  expect(html).toContain("50 / 100");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("Passive only");
});
