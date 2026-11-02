"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Plus,
  ShieldCheck,
  Globe,
  Zap,
  TriangleAlert,
  ArrowUpRight,
} from "lucide-react";
import { request, download } from "@/lib/client";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { Auth } from "../auth";
import { Report } from "../tools/report";
import type { ScanResult } from "@/lib/types";
const Trend = dynamic(() => import("./trend"), {
  ssr: false,
  loading: () => <div className="skeleton">Loading trend…</div>,
});
export type Domain = {
  id: string;
  hostname: string;
  verified: boolean;
  verification_token: string;
  verified_at: string | null;
};
export type Monitor = {
  id: string;
  domain_id: string;
  frequency: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
};
type Saved = {
  status: string;
  id: string;
  tool: string;
  score: number | null;
  completed_at: string;
  result: ScanResult;
  domain_id: string | null;
};
type Alert = {
  id: string;
  message: string;
  severity: string;
  created_at: string;
  acknowledged_at: string | null;
};
type Data = {
  domains: Domain[];
  scans: Saved[];
  monitors: Monitor[];
  alerts: Alert[];
};
export function Center() {
  const [data, setData] = useState<Data>(),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [host, setHost] = useState(""),
    [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<Domain>(),
    [report, setReport] = useState<ScanResult>(),
    [busy, setBusy] = useState(""),
    [page, setPage] = useState(0),
    [history, setHistory] = useState<Saved[]>([]);
  async function load() {
    try {
      const d = await request<Data>("dashboard");
      setData(d);
      setHistory(await request<Saved[]>("scans"));
      setPage(0);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!data)
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">YOUR SECURITY WORKSPACE</span>
          <h1>Command Center.</h1>
          <p>Real observations. A clear view of your domains.</p>
        </div>
        <div className="card empty">
          {error ? (
            <>
              <ShieldCheck size={40} />
              <h2>Sign in to your workspace</h2>
              <p>{error}</p>
              <Button onClick={() => setAuth(true)}>Sign in / Register</Button>
              <Button variant="ghost" onClick={load}>
                Retry
              </Button>
            </>
          ) : (
            <p role="status">Loading your saved security data…</p>
          )}
        </div>
        <Auth open={auth} onOpenChange={setAuth} />
      </>
    );
  const latest = new Map<string, Saved>();
  for (const s of data.scans) {
    const k = `${s.result.hostname}:${s.tool}`;
    if (!latest.has(k)) latest.set(k, s);
  }
  const scored = [...latest.values()].filter((s) => s.score !== null);
  const posture = scored.length
    ? Math.round(scored.reduce((n, s) => n + s.score!, 0) / scored.length)
    : null;
  const openFindings = [...latest.values()].reduce(
    (n, s) =>
      n +
      s.result.findings.filter((f) =>
        ["Missing", "Needs Review"].includes(f.status),
      ).length,
    0,
  );
  return (
    <>
      <div className="page-heading row between wrap">
        <div>
          <span className="eyebrow">YOUR SECURITY WORKSPACE</span>
          <h1>
            Command Center<span className="title-dot">.</span>
          </h1>
          <p>A clear view of your digital perimeter.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus size={18} /> Add domain
        </Button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid four metrics">
        {[
          [
            ShieldCheck,
            "Configuration posture",
            posture === null ? "—" : `${posture}/100`,
          ],
          [
            Globe,
            "Verified domains",
            data.domains.filter(
              (d) =>
                d.verified &&
                d.verified_at &&
                Date.parse(d.verified_at) > Date.now() - 90 * 86400000,
            ).length,
          ],
          [
            Zap,
            "Active monitors",
            data.monitors.filter(
              (m) =>
                m.enabled &&
                data.domains.some(
                  (d) =>
                    d.id === m.domain_id &&
                    d.verified &&
                    d.verified_at &&
                    Date.parse(d.verified_at) > Date.now() - 90 * 86400000,
                ),
            ).length,
          ],
          [TriangleAlert, "Open findings", openFindings],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Globe;
          return (
            <div className="card metric" key={String(label)}>
              <div className="row between">
                <span>{String(label)}</span>
                <I size={18} />
              </div>
              <strong>{String(value)}</strong>
              <small>From persisted records</small>
            </div>
          );
        })}
      </div>
      <p className="footnote">
        Posture averages the latest observed tool score per hostname within the
        most recent 100 scans. Open findings use the same window.
      </p>
      <div className="grid dashboard-grid">
        <section className="card">
          <div className="row between">
            <h2>Configuration trend</h2>
            <span className="chip">LATEST 20 SCORED SCANS</span>
          </div>
          <Trend
            data={data.scans
              .filter((s) => s.score !== null)
              .slice(0, 20)
              .reverse()
              .map((s) => ({
                date: new Date(s.completed_at).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                }),
                score: s.score!,
              }))}
          />
        </section>
        <section className="card">
          <h2>Latest alerts</h2>
          {data.alerts.length ? (
            data.alerts.slice(0, 5).map((a) => (
              <article className="alert-item" key={a.id}>
                <span className={`badge ${a.severity}`}>{a.severity}</span>
                <p>{a.message}</p>
                <small className="muted">
                  {new Date(a.created_at).toLocaleString("en-GB", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </small>
                {!a.acknowledged_at ? (
                  <Button
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() =>
                      act(a.id, () => request(`alerts/${a.id}`, "PATCH", {}))
                    }
                  >
                    Acknowledge
                  </Button>
                ) : (
                  <small> Acknowledged</small>
                )}
              </article>
            ))
          ) : (
            <p className="empty">
              No alerts recorded. Set up a verified-domain monitor to track
              changes.
            </p>
          )}
        </section>
      </div>
      <section className="card">
        <div className="row between">
          <h2>Your domains</h2>
          <Link className="text-link" href="/automation">
            Manage monitoring <ArrowUpRight size={16} />
          </Link>
        </div>
        {data.domains.length ? (
          <div className="domain-list">
            {data.domains.map((d) => (
              <article className="domain-row" key={d.id}>
                <div className="row">
                  <Globe size={20} />
                  <strong>{d.hostname}</strong>
                </div>
                <span
                  className={`badge ${d.verified && d.verified_at && Date.parse(d.verified_at) > Date.now() - 90 * 86400000 ? "success" : "warning"}`}
                >
                  {d.verified &&
                  d.verified_at &&
                  Date.parse(d.verified_at) > Date.now() - 90 * 86400000
                    ? "Verified"
                    : "Verification required"}
                </span>
                <div className="row wrap">
                  <Button variant="ghost" onClick={() => setSelected(d)}>
                    View / Verify
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() =>
                      act(d.id, async () => {
                        const r = await request<ScanResult>(
                          "tools/webshield",
                          "POST",
                          { url: d.hostname, save: true },
                        );
                        setReport(r);
                      })
                    }
                  >
                    {busy === d.id ? "Scanning…" : "Scan"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Globe size={32} />
            <h3>Your perimeter starts with one domain.</h3>
            <p>Add a domain, verify ownership, then enable monitoring.</p>
            <Button onClick={() => setAdding(true)}>
              Add your first domain
            </Button>
          </div>
        )}
      </section>
      <section className="card">
        <h2>Scan history</h2>
        {history.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Tool</th>
                  <th>Timestamp (UTC)</th>
                  <th>Score</th>
                  <th>Status / findings</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id}>
                    <td>{s.result.hostname}</td>
                    <td>{s.tool}</td>
                    <td>
                      {new Date(s.completed_at).toLocaleString("en-GB", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>{s.score ?? "Not tested"}</td>
                    <td>
                      {s.status} ·{" "}
                      {
                        s.result.findings.filter((f) =>
                          ["Missing", "Needs Review"].includes(f.status),
                        ).length
                      }{" "}
                      findings
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => setReport(s.result)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          download(s.result, `irongate-${s.id}.json`)
                        }
                      >
                        JSON
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            No saved scans. Run a check in the Security Lab with “Save result”
            enabled.
          </p>
        )}
        <div className="row">
          <Button
            variant="outline"
            disabled={page === 0 || !!busy}
            onClick={async () => {
              try {
                setHistory(await request<Saved[]>(`scans?page=${page - 1}`));
                setPage(page - 1);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Previous
          </Button>
          <span>Page {page + 1}</span>
          <Button
            variant="outline"
            disabled={history.length < 20 || !!busy}
            onClick={async () => {
              try {
                setHistory(await request<Saved[]>(`scans?page=${page + 1}`));
                setPage(page + 1);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Next
          </Button>
        </div>
      </section>
      <Modal open={adding} onOpenChange={setAdding} title="Add a domain">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("add", async () => {
              await request("domains", "POST", { hostname: host });
              setAdding(false);
              setHost("");
            });
          }}
        >
          <label>
            Domain hostname
            <input
              placeholder="example.co.uk"
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </label>
          <p className="muted">
            Add the DNS TXT challenge after saving. Up to 20 domains per
            account.
          </p>
          <Button disabled={!!busy}>Add domain</Button>
        </form>
        {error ? <p role="alert">{error}</p> : null}
      </Modal>
      <Modal
        open={!!selected}
        onOpenChange={() => setSelected(undefined)}
        title={selected?.hostname ?? "Domain"}
      >
        {selected ? (
          <>
            <p>Add this DNS TXT record at your DNS provider:</p>
            <label>
              Record name<pre>_irongate.{selected.hostname}</pre>
            </label>
            <label>
              Record value
              <pre>irongate-verification={selected.verification_token}</pre>
            </label>
            <p className="muted">
              Keep the record in place. Verification is valid for 90 days;
              verify again here to renew it. DNS propagation may take time.
            </p>
            <div className="row wrap">
              <Button
                disabled={!!busy}
                onClick={() =>
                  act("verify", async () => {
                    const d = await request<Domain>(
                      `domains/${selected.id}/verify`,
                      "POST",
                      {},
                    );
                    setSelected(d);
                  })
                }
              >
                {selected.verified ? "Reverify ownership" : "Verify ownership"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `irongate-verification=${selected.verification_token}`,
                  )
                }
              >
                Copy TXT value
              </Button>
              <Button
                variant="destructive"
                disabled={!!busy}
                onClick={() => {
                  if (
                    confirm(
                      `Remove ${selected.hostname}, its scans, alerts and monitor?`,
                    )
                  )
                    void act("delete", async () => {
                      await request(`domains/${selected.id}`, "DELETE");
                      setSelected(undefined);
                    });
                }}
              >
                Remove domain
              </Button>
            </div>
            {selected.verified ? (
              <p className="badge success">Verified {selected.verified_at}</p>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
          </>
        ) : null}
      </Modal>
      {report ? (
        <Modal
          open={!!report}
          onOpenChange={() => setReport(undefined)}
          title="Scan report"
        >
          <Report result={report} />
        </Modal>
      ) : null}
    </>
  );
}
