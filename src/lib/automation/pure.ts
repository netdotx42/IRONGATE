import type { ScanResult } from "../types";
export function nextRun(frequency: string, from = new Date()) {
  const d = new Date(from);
  if (frequency === "monthly") {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const end = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, end));
  } else d.setUTCDate(d.getUTCDate() + (frequency === "weekly" ? 7 : 1));
  return d.toISOString();
}
export function changes(current: ScanResult, previous?: ScanResult) {
  const output: {
    type: string;
    severity: string;
    message: string;
    key: string;
  }[] = [];
  const add = (type: string, severity: string, message: string, key = type) =>
    output.push({ type, severity, message, key });
  if (current.tool === "webshield") {
    const https = current.findings.find((f) => f.id === "https");
    if (https?.status === "Missing")
      add(
        "https_unavailable",
        "critical",
        "HTTPS is unavailable. Restore connectivity and valid TLS.",
      );
    const tls = current.findings.find((f) => f.id === "tls");
    if (tls?.status === "Missing")
      add(
        "certificate_invalid",
        "critical",
        "TLS certificate validation failed. Review hostname, trust and validity.",
      );
    if (
      current.certificate_days !== undefined &&
      current.certificate_days <= 30
    ) {
      const threshold =
        current.certificate_days <= 7
          ? 7
          : current.certificate_days <= 14
            ? 14
            : 30;
      add(
        "certificate_expiry",
        threshold === 7 ? "critical" : "warning",
        `Certificate expires in ${current.certificate_days} days. Renew it.`,
        `certificate_expiry:${threshold}`,
      );
    }
  }
  if (previous) {
    for (const f of current.findings) {
      const old = previous.findings.find((x) => x.id === f.id);
      if (
        current.tool === "headerguard" &&
        ["Configured", "Needs Review"].includes(old?.status ?? "") &&
        f.status === "Missing"
      )
        add(
          "header_removed",
          "warning",
          `${f.name} was removed. ${f.recommendation}`,
          `header_removed:${f.id}`,
        );
    }
    if (
      current.score !== null &&
      previous.score !== null &&
      current.scoring_version === previous.scoring_version &&
      current.score < previous.score
    )
      add(
        "configuration_regressed",
        "warning",
        `Configuration score decreased from ${previous.score} to ${current.score}. Review findings.`,
      );
  }
  return output;
}
export function dedupKey(
  domain: string,
  key: string,
  day = new Date().toISOString().slice(0, 10),
) {
  return `${domain}:${key}:${day}`;
}
