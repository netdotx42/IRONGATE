"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ShieldCheck, CodeXml, KeyRound, ArrowUpRight } from "lucide-react";
import { request } from "@/lib/client";
import type { ScanResult } from "@/lib/types";
import { Report } from "./report";
import { Button } from "../ui/button";
const KeyGuard = dynamic(() => import("./keyguard"), {
  loading: () => (
    <div className="skeleton">Loading private password tools…</div>
  ),
});
export function Lab() {
  const [tool, setTool] = useState("webshield"),
    [url, setURL] = useState(""),
    [busy, setBusy] = useState(false),
    [save, setSave] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<ScanResult>(),
    [previous, setPrevious] = useState<ScanResult>();
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("tool");
    if (value && ["webshield", "keyguard", "headerguard"].includes(value))
      setTool(value);
  }, []);
  async function run() {
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const data = await request<ScanResult>(`tools/${tool}`, "POST", {
        url,
        save,
      });
      setResult(data);
      if (save) {
        const history = await request<{ result: ScanResult; id: string }[]>(
          `scans?hostname=${encodeURIComponent(data.hostname)}&tool=${data.tool}`,
        );
        setPrevious(
          history.find(
            (s) =>
              s.id !== data.id &&
              s.result.tool === data.tool &&
              s.result.hostname === data.hostname,
          )?.result,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">OBSERVE. UNDERSTAND. STRENGTHEN.</span>
        <h1>
          Security Lab<span className="title-dot">.</span>
        </h1>
        <p>Three focused tools. Real observations. Practical next steps.</p>
      </div>
      <div className="tabs" role="tablist" aria-label="Security tools">
        {[
          ["webshield", "WebShield", ShieldCheck],
          ["keyguard", "KeyGuard", KeyRound],
          ["headerguard", "HeaderGuard", CodeXml],
        ].map(([id, name, Icon]) => {
          const I = Icon as typeof ShieldCheck;
          return (
            <button
              role="tab"
              id={`tab-${id}`}
              aria-controls="tool-panel"
              tabIndex={tool === id ? 0 : -1}
              disabled={busy}
              onKeyDown={(e) => {
                const ids = ["webshield", "keyguard", "headerguard"];
                const current = ids.indexOf(tool);
                const next =
                  e.key === "ArrowRight"
                    ? (current + 1) % 3
                    : e.key === "ArrowLeft"
                      ? (current + 2) % 3
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 2
                          : -1;
                if (next >= 0) {
                  e.preventDefault();
                  setTool(ids[next]);
                  setResult(undefined);
                  setPrevious(undefined);
                  setError("");
                  document.getElementById(`tab-${ids[next]}`)?.focus();
                }
              }}
              aria-selected={tool === id}
              className={tool === id ? "tab selected" : "tab"}
              key={String(id)}
              onClick={() => {
                setTool(String(id));
                setResult(undefined);
                setPrevious(undefined);
                setError("");
              }}
            >
              <I size={20} />
              {String(name)}
            </button>
          );
        })}
      </div>
      <div id="tool-panel" role="tabpanel" aria-labelledby={`tab-${tool}`}>
        {tool === "keyguard" ? (
          <KeyGuard />
        ) : (
          <>
            <section className="card scan-card">
              <div>
                <span className="eyebrow">
                  {tool === "webshield"
                    ? "PASSIVE WEBSITE ANALYSIS"
                    : "HTTP POLICY ANALYSIS"}
                </span>
                <h2>
                  {tool === "webshield"
                    ? "Check your website’s foundation."
                    : "Understand your security headers."}
                </h2>
                <p className="muted">
                  {tool === "webshield"
                    ? "Observe HTTPS, certificate validity, redirects and cookie attributes."
                    : "Inspect enforcing security headers and conservative configuration checks."}{" "}
                  No crawling or exploit testing.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run();
                }}
              >
                <label>
                  Website URL
                  <div className="scan-input">
                    <span className="mono">https://</span>
                    <input
                      required
                      aria-label="Website URL"
                      placeholder="your-domain.co.uk"
                      value={url}
                      onChange={(e) => setURL(e.target.value)}
                      maxLength={2048}
                    />
                    <Button disabled={busy}>
                      {busy
                        ? "Checking…"
                        : tool === "webshield"
                          ? "Run WebShield"
                          : "Analyze headers"}
                      <ArrowUpRight size={17} />
                    </Button>
                  </div>
                </label>
                <div className="row between wrap">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={save}
                      onChange={(e) => setSave(e.target.checked)}
                    />
                    Save result to my account (sign-in required)
                  </label>
                  <Button
                    type="button"
                    disabled={busy}
                    variant="ghost"
                    onClick={() => {
                      setURL("");
                      setResult(undefined);
                      setPrevious(undefined);
                      setError("");
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </form>
              <p className="mini-label">
                PUBLIC HOSTNAMES ONLY · STANDARD PORTS · SAFE REQUEST LIMITS
              </p>
            </section>
            {busy ? (
              <div className="card loading" role="status">
                <span className="spinner" /> Resolving public DNS, validating
                transport and inspecting the response…
              </div>
            ) : null}
            {error ? (
              <div className="error" role="alert">
                {error}. Check your input and service configuration, then try
                again.
              </div>
            ) : null}
            {result ? (
              <Report result={result} previous={previous} />
            ) : (
              <div className="empty">
                <ShieldCheck size={38} />
                <h3>Visibility starts here.</h3>
                <p>
                  Run a check to see observed findings. Scores appear only after
                  a real analysis.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <p className="footnote">
        IRONGATE checks public configuration. A high score does not guarantee
        that a website is secure.
      </p>
    </>
  );
}
