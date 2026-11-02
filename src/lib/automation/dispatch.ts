import { admin } from "../supabase/server";
import { scan, scanStatus } from "../scanning";
import { withScanSlot } from "../security/concurrency";
import { nextRun, changes, dedupKey } from "./pure";
import { email } from "../email";
import type { ScanResult } from "../types";
export async function dispatch() {
  const a = admin();
  let completed = 0,
    failed = 0;
  const started = Date.now();
  async function worker() {
    for (let i = 0; i < 5 && Date.now() - started < 220000; i++) {
      const claimed = await a.rpc("claim_job");
      if (claimed.error) throw new Error("SERVICE_UNAVAILABLE");
      const job = claimed.data?.[0];
      if (!job) break;
      const { data: monitor } = await a
        .from("monitors")
        .select("*,domains(*)")
        .eq("id", job.monitor_id)
        .single();
      try {
        if (
          !monitor?.enabled ||
          !monitor.domains?.verified ||
          Date.parse(monitor.domains.verified_at) < Date.now() - 90 * 86400000
        )
          throw new Error("DOMAIN_NOT_VERIFIED");
        for (const tool of ["webshield", "headerguard"] as const) {
          const { data: previous } = await a
            .from("scans")
            .select("result")
            .eq("domain_id", monitor.domain_id)
            .eq("tool", tool)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const result = await withScanSlot(() =>
            scan(monitor.domains.hostname, tool),
          );
          const { data: saved, error } = await a
            .from("scans")
            .insert({
              user_id: monitor.user_id,
              domain_id: monitor.domain_id,
              tool,
              status: scanStatus(result),
              score: result.score,
              grade: result.grade,
              findings: result.findings,
              result,
              scoring_version: result.scoring_version,
              started_at: result.started_at,
              completed_at: result.completed_at,
            })
            .select("id")
            .single();
          if (error) throw new Error("PERSISTENCE_FAILED");
          const repeated = await a
            .from("scans")
            .select("status")
            .eq("domain_id", monitor.domain_id)
            .eq("tool", tool)
            .order("completed_at", { ascending: false })
            .limit(3);
          const foundChanges = changes(
            result,
            previous?.result as ScanResult | undefined,
          );
          if (
            repeated.data?.length === 3 &&
            repeated.data.every((row) => row.status === "failed")
          )
            foundChanges.push({
              type: "repeated_failure",
              key: `repeated_failure:${tool}`,
              severity: "warning",
              message: `${tool} could not complete three consecutive HTTPS checks. Review connectivity, certificate validity and the stored findings.`,
            });
          for (const change of foundChanges) {
            const key = dedupKey(monitor.domain_id, change.key);
            const recent = await a
              .from("alerts")
              .select("id")
              .eq("domain_id", monitor.domain_id)
              .eq("alert_type", change.key)
              .gte("created_at", new Date(Date.now() - 86400000).toISOString())
              .limit(1);
            if (recent.data?.length) continue;
            const inserted = await a.from("alerts").insert({
              user_id: monitor.user_id,
              domain_id: monitor.domain_id,
              scan_id: saved.id,
              severity: change.severity,
              alert_type: change.key,
              message: change.message,
              deduplication_key: key,
            });
            if (inserted.error && inserted.error.code !== "23505")
              throw new Error("ALERT_PERSISTENCE_FAILED");
          }
        }
        const finish = await a.rpc("finish_job", {
          job_id: job.id,
          lease: job.claim_token,
          next_time: nextRun(monitor.frequency),
        });
        if (finish.error || !finish.data) throw new Error("LEASE_LOST");
        completed++;
      } catch {
        failed++;
        const finish = await a.rpc("finish_job", {
          job_id: job.id,
          lease: job.claim_token,
          next_time: nextRun(monitor?.frequency ?? "daily"),
          failure: "Scan execution failed; retry on next dispatch.",
        });
        if (finish.error) throw new Error("SERVICE_UNAVAILABLE");
        if (job.attempts >= 3 && monitor) {
          await a.from("alerts").upsert(
            {
              user_id: monitor.user_id,
              domain_id: monitor.domain_id,
              severity: "warning",
              alert_type: "repeated_failure",
              message:
                "Scheduled scans failed three times. Review DNS and transport availability.",
              deduplication_key: dedupKey(
                monitor.domain_id,
                "repeated_failure",
              ),
            },
            { onConflict: "deduplication_key", ignoreDuplicates: true },
          );
        }
      }
    }
  }
  await Promise.all([worker(), worker()]);
  // Atomic delivery leases prevent concurrent dispatchers from sending the same alert.
  // Failed attempts stay in the outbox for up to seven days; at most three attempts.
  let sent = 0;
  for (let i = 0; i < 20 && Date.now() - started < 250000; i++) {
    const claimed = await a.rpc("claim_alert");
    if (claimed.error) throw new Error("SERVICE_UNAVAILABLE");
    const alert = claimed.data?.[0];
    if (!alert) break;
    try {
      const {
        data: { user },
        error: userError,
      } = await a.auth.admin.getUserById(alert.user_id);
      if (userError || !user?.email || !user.email_confirmed_at)
        throw new Error("RECIPIENT_UNAVAILABLE");
      const { data: domain, error: domainError } = await a
        .from("domains")
        .select("hostname")
        .eq("id", alert.domain_id)
        .single();
      if (domainError || !domain) throw new Error("DOMAIN_UNAVAILABLE");
      await email(
        user.email,
        domain.hostname,
        alert.message,
        alert.severity,
        alert.id,
      );
      const persisted = await a
        .from("alerts")
        .update({ sent_at: new Date().toISOString(), delivery_error: null })
        .eq("id", alert.id)
        .eq("delivery_claim", alert.delivery_claim);
      if (persisted.error) throw new Error("DELIVERY_RECORD_FAILED");
      sent++;
    } catch {
      await a
        .from("alerts")
        .update({
          delivery_error:
            "Delivery attempt failed; inspect provider logs and retry status.",
        })
        .eq("id", alert.id)
        .eq("delivery_claim", alert.delivery_claim);
    }
  }
  await a
    .from("rate_buckets")
    .delete()
    .lt("window_at", new Date(Date.now() - 86400000).toISOString());
  return { completed, failed, sent };
}
