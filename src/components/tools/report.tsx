"use client";
import { useState } from "react";
import { reportHTML } from "@/lib/reports";
import type { ScanResult } from "@/lib/types";
import { Button } from "../ui/button";
import { download } from "@/lib/client";
export function Report({
  result,
  previous,
}: {
  result: ScanResult;
  previous?: ScanResult;
}) {
  const [message, setMessage] = useState("");
  return (
    <section className="report card" aria-live="polite">
      <div className="row between wrap">
        <div>
          <span className="eyebrow">
            {result.tool.toUpperCase()} · CONFIGURATION REPORT
          </span>
          <h2>{result.hostname}</h2>
          <p className="mono muted">
            {new Date(result.completed_at).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC · {result.duration_ms} ms · v{result.scoring_version}
          </p>
        </div>
        <div className="score">
          <strong>{result.score ?? "—"}</strong>
          <span>/ 100 · {result.grade ?? "Not tested"}</span>
        </div>
      </div>
      {previous ? (
        <>
          <p className="notice">
            Previous saved score: {previous.score ?? "Not tested"}/100 → current{" "}
            {result.score ?? "Not tested"}/100. Matched by hostname and tool.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Previous observation</th>
                  <th>Current observation</th>
                </tr>
              </thead>
              <tbody>
                {result.findings.map((f) => {
                  const old = previous.findings.find(
                    (x) => x.id === f.id || x.name === f.name,
                  );
                  return (
                    <tr key={f.id}>
                      <td>{f.name}</td>
                      <td>
                        {old?.status ?? "Not Tested"}
                        {old?.value ? <pre>{old.value}</pre> : null}
                      </td>
                      <td>
                        {f.status}
                        {f.value ? <pre>{f.value}</pre> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <div className="row wrap no-print">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify(result, null, 2),
              );
              setMessage("Results copied.");
            } catch {
              setMessage("Clipboard unavailable. Download the report instead.");
            }
          }}
        >
          Copy results
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            download(result, `irongate-${result.tool}-${result.hostname}.json`)
          }
        >
          Download JSON
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([reportHTML(result)], { type: "text/html" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `irongate-${result.hostname}.html`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 500);
          }}
        >
          Download HTML
        </Button>
        <span role="status">{message}</span>
      </div>
      <div className="findings">
        {result.findings.map((f) => (
          <article className="finding" key={f.id}>
            <div className="row between wrap">
              <h3>{f.name}</h3>
              <span className={`badge ${f.severity}`}>
                {f.status} · {f.severity}
              </span>
            </div>
            {f.value ? <pre>{f.value}</pre> : null}
            <p>{f.explanation}</p>
            <p className="recommendation">
              <strong>Recommended action</strong> {f.recommendation}
            </p>
          </article>
        ))}
      </div>
      <h4>Methodology & limitations</h4>
      <ul className="muted">
        {result.limitations.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="muted">
        Weighted scoring v{result.scoring_version}: configured checks earn full
        weight; policies needing review earn half; missing checks earn zero. Not
        Tested and Not Applicable checks are excluded. A ≥90, B ≥80, C ≥70, D
        ≥60, otherwise F.
      </p>
    </section>
  );
}
