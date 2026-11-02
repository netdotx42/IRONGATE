"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Plus, ShieldCheck, Clock, Mail } from "lucide-react";
import { request } from "@/lib/client";
import type { Domain, Monitor } from "../dashboard/center";
import { Button } from "../ui/button";
import { Auth } from "../auth";
export function Hub() {
  const [domains, setDomains] = useState<Domain[]>([]),
    [monitors, setMonitors] = useState<Monitor[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [domain, setDomain] = useState(""),
    [frequency, setFrequency] = useState("daily"),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [d, m] = await Promise.all([
        request<Domain[]>("domains"),
        request<Monitor[]>("monitors"),
      ]);
      setDomains(d);
      setMonitors(m);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">CONTINUOUS VISIBILITY</span>
        <h1>
          AutoDefense<span className="title-dot">.</span>
        </h1>
        <p>Your verified domains. A watchful eye on what changes.</p>
      </div>
      <div className="automation-banner card">
        <span className="icon-box">
          <Zap size={26} />
        </span>
        <div>
          <h2>Put the routine checks on your schedule.</h2>
          <p>
            WebShield and HeaderGuard, certificate expiry alerts, configuration
            comparisons, and email notifications.
          </p>
        </div>
      </div>
      <div className="grid three compact-cards">
        {[
          [
            ShieldCheck,
            "Verified ownership only",
            "DNS verification must be current before monitoring runs.",
          ],
          [
            Clock,
            "Daily dispatcher",
            "Daily, weekly and monthly schedules, evaluated at 06:00 UTC.",
          ],
          [
            Mail,
            "Actionable notifications",
            "Expiry thresholds, removed headers, regression and repeated failures.",
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Zap;
          return (
            <section className="card" key={String(title)}>
              <I size={20} />
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </section>
          );
        })}
      </div>
      {error ? (
        <div className="error" role="alert">
          {error}
          <div className="row">
            <Button variant="outline" onClick={() => setAuth(true)}>
              Sign in
            </Button>
            <Button variant="ghost" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}
      {loading ? (
        <div className="skeleton">Loading schedules…</div>
      ) : (
        <>
          <section className="card">
            <h2>Create a monitor</h2>
            <p className="muted">
              Both website tools run on each schedule. Up to 10 monitors per
              account. Email is delivered to your confirmed account address.
            </p>
            <form
              className="row wrap align-end"
              onSubmit={(e) => {
                e.preventDefault();
                void act(() =>
                  request("monitors", "POST", { domain_id: domain, frequency }),
                );
              }}
            >
              <label className="grow">
                Verified domain
                <select
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                >
                  <option value="">Select a domain</option>
                  {domains
                    .filter(
                      (d) =>
                        d.verified &&
                        d.verified_at &&
                        Date.parse(d.verified_at) >
                          Date.now() - 90 * 86400000 &&
                        !monitors.some((m) => m.domain_id === d.id),
                    )
                    .map((d) => (
                      <option value={d.id} key={d.id}>
                        {d.hostname}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Frequency
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <Button disabled={busy || !domain}>
                <Plus size={17} />
                Enable monitoring
              </Button>
            </form>
            <p>
              <Link className="text-link" href="/dashboard">
                Add or verify domains in Command Center →
              </Link>
            </p>
          </section>
          <section className="card">
            <h2>Your monitors</h2>
            {monitors.length ? (
              monitors.map((m) => (
                <div key={m.id} className="monitor-row">
                  <div>
                    <h3>
                      {domains.find((d) => d.id === m.domain_id)?.hostname ??
                        "Domain"}
                    </h3>
                    <p className="muted">
                      Last run:{" "}
                      {m.last_run_at
                        ? new Date(m.last_run_at).toUTCString()
                        : "Not yet run"}
                      <br />
                      Next due: {new Date(m.next_run_at).toUTCString()}
                    </p>
                  </div>
                  <span
                    className={`badge ${m.enabled ? "success" : "warning"}`}
                  >
                    {!m.enabled
                      ? "Paused"
                      : domains.some(
                            (d) =>
                              d.id === m.domain_id &&
                              d.verified &&
                              d.verified_at &&
                              Date.parse(d.verified_at) >
                                Date.now() - 90 * 86400000,
                          )
                        ? "Scheduled"
                        : "Verification required"}
                  </span>
                  <label>
                    Frequency
                    <select
                      value={m.frequency}
                      disabled={busy}
                      onChange={(e) =>
                        act(() =>
                          request(`monitors/${m.id}`, "PATCH", {
                            frequency: e.target.value,
                          }),
                        )
                      }
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <div className="row wrap">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          request(`monitors/${m.id}`, "PATCH", {
                            enabled: !m.enabled,
                          }),
                        )
                      }
                    >
                      {m.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this monitor? Scan history will remain.",
                          )
                        )
                          void act(() => request(`monitors/${m.id}`, "DELETE"));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                <Zap size={36} />
                <h3>No active schedules yet.</h3>
                <p>Verify a domain to set up your first monitor.</p>
              </div>
            )}
          </section>
        </>
      )}
      <div className="notice">
        <strong>Dispatch capacity:</strong> This installation supports up to 10
        monitors in total. Checks run when the daily dispatcher evaluates due
        schedules; they are not continuous uptime monitoring. Enrollment is
        refused when capacity is reached.
      </div>
      <p className="footnote">
        No automatic remediation. No password automation. Notification settings
        are available in Account & Settings.
      </p>
      <Auth open={auth} onOpenChange={setAuth} />
    </>
  );
}
