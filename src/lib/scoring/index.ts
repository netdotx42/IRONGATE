import type { Finding } from "../types";
export const SCORING_VERSION = "1.0.0";
export function score(findings: Finding[]) {
  const applicable = findings.filter(
    (f) => !["Not Tested", "Not Applicable"].includes(f.status),
  );
  const weight = applicable.reduce((n, f) => n + f.weight, 0);
  const value = weight
    ? Math.round((applicable.reduce((n, f) => n + f.earned, 0) / weight) * 100)
    : null;
  return {
    score: value,
    grade:
      value === null
        ? null
        : value >= 90
          ? "A"
          : value >= 80
            ? "B"
            : value >= 70
              ? "C"
              : value >= 60
                ? "D"
                : "F",
  };
}
export function finding(
  id: string,
  name: string,
  pass: boolean | null,
  weight: number,
  explanation: string,
  recommendation: string,
  value?: string,
  review = false,
): Finding {
  return {
    id,
    name,
    status:
      pass === null
        ? "Not Tested"
        : pass
          ? "Configured"
          : review
            ? "Needs Review"
            : "Missing",
    severity:
      pass === null
        ? "information"
        : pass
          ? "success"
          : weight >= 20
            ? "critical"
            : "warning",
    weight,
    earned: pass ? weight : review ? weight / 2 : 0,
    explanation,
    recommendation,
    value,
  };
}
