import { it, expect } from "vitest";
import { score, finding } from "../../src/lib/scoring";
import { headerFindings, scanStatus } from "../../src/lib/scanning";
it("excludes unknown observations from denominator", () => {
  expect(
    score([
      finding("a", "a", true, 25, "", ""),
      finding("b", "b", false, 25, "", ""),
      finding("c", "c", null, 50, "", ""),
    ]),
  ).toEqual({ score: 50, grade: "F" });
});
it("does not manufacture a score for unknown observations", () =>
  expect(score([finding("a", "a", null, 20, "", "")])).toEqual({
    score: null,
    grade: null,
  }));
it("assigns review partial credit and critical weighting", () => {
  const f = finding("a", "a", false, 20, "", "", "observed", true);
  expect(f.status).toBe("Needs Review");
  expect(f.severity).toBe("critical");
  expect(score([f]).score).toBe(50);
});
it("does not treat header presence as secure", () => {
  const f = headerFindings({
    url: "https://example.com",
    status: 200,
    headers: {
      "content-security-policy": "default-src *; script-src 'unsafe-inline'",
      "strict-transport-security": "max-age=0",
      "x-content-type-options": "foo",
    },
  });
  expect(f.find((v) => v.id === "content-security-policy")?.status).toBe(
    "Needs Review",
  );
  expect(f.find((v) => v.id === "strict-transport-security")?.status).toBe(
    "Needs Review",
  );
});
it("recognizes CSP frame ancestors without requiring X-Frame-Options", () => {
  const f = headerFindings({
    url: "https://example.com",
    status: 200,
    headers: {
      "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
    },
  });
  expect(f.find((v) => v.id === "frame-policy")?.status).toBe("Configured");
});
it("does not recommend HSTS on plaintext observations", () =>
  expect(
    headerFindings({
      url: "http://example.com",
      status: 200,
      headers: {},
    }).find((v) => v.id === "strict-transport-security")?.status,
  ).toBe("Not Applicable"));

it("does not let XFO hide a permissive enforcing frame-ancestors policy", () => {
  const f = headerFindings({
    url: "https://example.com",
    status: 200,
    headers: {
      "content-security-policy": "default-src 'self'; frame-ancestors *",
      "x-frame-options": "DENY",
    },
  });
  expect(f.find((v) => v.id === "frame-policy")?.status).toBe("Needs Review");
});
it("rejects malformed and duplicated HSTS max-age", () => {
  for (const value of ["max-age=31536000evil", "max-age=31536000; max-age=0"]) {
    expect(
      headerFindings({
        url: "https://example.com",
        status: 200,
        headers: { "strict-transport-security": value },
      }).find((v) => v.id === "strict-transport-security")?.status,
    ).toBe("Needs Review");
  }
});
it("does not claim broad script origins are a secure policy", () => {
  expect(
    headerFindings({
      url: "https://example.com",
      status: 200,
      headers: { "content-security-policy": "script-src https:" },
    }).find((v) => v.id === "content-security-policy")?.status,
  ).toBe("Needs Review");
});
it("marks unsupported HEAD results not tested", () =>
  expect(
    headerFindings({
      url: "https://example.com",
      status: 405,
      headers: {},
    }).every((f) => f.status === "Not Tested"),
  ).toBe(true));

it("distinguishes failed observation from completed analysis", () => {
  expect(
    scanStatus({ score: null, tool: "headerguard", findings: [] } as never),
  ).toBe("failed");
  expect(
    scanStatus({
      score: 80,
      tool: "webshield",
      findings: [finding("https", "HTTPS", false, 25, "", "")],
    } as never),
  ).toBe("failed");
  expect(
    scanStatus({
      score: 80,
      tool: "webshield",
      findings: [finding("https", "HTTPS", true, 25, "", "")],
    } as never),
  ).toBe("completed");
});
