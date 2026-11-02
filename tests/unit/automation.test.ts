import { it, expect } from "vitest";
import { nextRun, changes, dedupKey } from "../../src/lib/automation/pure";
import { finding } from "../../src/lib/scoring";
import type { ScanResult } from "../../src/lib/types";
const base: ScanResult = {
  tool: "webshield",
  hostname: "example.com",
  url: "https://example.com",
  score: 100,
  grade: "A",
  findings: [],
  scoring_version: "1.0.0",
  started_at: "",
  completed_at: "",
  duration_ms: 1,
  limitations: [],
};
it("calculates UTC daily and weekly schedules", () => {
  const from = new Date("2026-10-24T06:00:00Z");
  expect(nextRun("daily", from)).toBe("2026-10-25T06:00:00.000Z");
  expect(nextRun("weekly", from)).toBe("2026-10-31T06:00:00.000Z");
});
it("clamps monthly schedule to the last valid calendar day", () =>
  expect(nextRun("monthly", new Date("2028-01-31T06:00:00Z"))).toBe(
    "2028-02-29T06:00:00.000Z",
  ));
it("uses threshold-specific deterministic deduplication", () => {
  expect(changes({ ...base, certificate_days: 13 })[0].key).toBe(
    "certificate_expiry:14",
  );
  expect(dedupKey("a", "expiry", "2026-11-02")).toBe(
    dedupKey("a", "expiry", "2026-11-02"),
  );
  expect(dedupKey("a", "expiry", "2026-11-02")).not.toBe(
    dedupKey("a", "expiry", "2026-11-03"),
  );
});
it("detects removed headers and configuration regression", () => {
  const old = {
    ...base,
    tool: "headerguard" as const,
    findings: [finding("csp", "CSP", true, 20, "", "")],
  };
  const next = {
    ...old,
    score: 50,
    findings: [finding("csp", "CSP", false, 20, "", "")],
  };
  expect(changes(next, old).map((c) => c.type)).toEqual([
    "header_removed",
    "configuration_regressed",
  ]);
});
it("does not alert on unknown header observations", () =>
  expect(
    changes(
      {
        ...base,
        tool: "headerguard",
        findings: [finding("csp", "CSP", null, 20, "", "")],
      },
      {
        ...base,
        tool: "headerguard",
        findings: [finding("csp", "CSP", true, 20, "", "")],
      },
    ),
  ).toEqual([]));
