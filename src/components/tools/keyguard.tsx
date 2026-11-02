"use client";
import { useState, useEffect } from "react";
import type { ZXCVBNResult } from "zxcvbn";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { generate, passphrase, groups } from "@/lib/password";
import { Button } from "../ui/button";
export default function KeyGuard() {
  const [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [result, setResult] = useState<ZXCVBNResult>(),
    [length, setLength] = useState(20),
    [selected, setSelected] = useState<(keyof typeof groups)[]>([
      "upper",
      "lower",
      "numbers",
      "symbols",
    ]),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!password) {
      setResult(undefined);
      return;
    }
    import("zxcvbn").then(({ default: estimate }) => {
      if (active) setResult(estimate(password));
    });
    return () => {
      active = false;
    };
  }, [password]);
  function create(phrase = false) {
    try {
      setPassword(phrase ? passphrase() : generate(length, selected));
      setMessage("Generated locally with Web Crypto.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="grid two">
      <section className="card">
        <span className="eyebrow">
          <LockKeyhole size={15} /> STAYS ON THIS DEVICE
        </span>
        <h2>How strong is your password?</h2>
        <p className="muted">
          No requests, storage or analytics. Strength is an estimate, not a
          guarantee.
        </p>
        <label>
          Password
          <div className="input-with-button">
            <input
              autoComplete="off"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 256))}
              maxLength={256}
            />
            <Button
              variant="ghost"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
        </label>
        <div className="strength-track" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={result && n <= result.score ? "filled" : ""}
            />
          ))}
        </div>
        <div aria-live="polite">
          <h3>
            {result
              ? ["Very Weak", "Weak", "Moderate", "Strong", "Very Strong"][
                  result.score
                ]
              : "Enter a password to begin"}
          </h3>
          {result ? (
            <>
              <p>
                {password.length} characters · Estimated offline resistance:{" "}
                {String(
                  result.crack_times_display
                    .offline_slow_hashing_1e4_per_second,
                )}
              </p>
              <p className="muted">
                Assumes 10,000 guesses/second against a slow hash. Real
                resistance depends on storage, reuse, leaks and attacker
                resources.
              </p>
              {result.feedback.warning ? (
                <p className="notice">{result.feedback.warning}</p>
              ) : null}
              <ul>
                {result.feedback.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="muted">
                zxcvbn checks dictionary words, repetition, sequences, dates and
                keyboard patterns. Never reuse a password; enable MFA where
                available.
              </p>
            </>
          ) : null}
        </div>
        <div className="row wrap">
          <Button
            variant="outline"
            disabled={!password}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password);
                setMessage("Copied. Clear your clipboard after use.");
              } catch {
                setMessage(
                  "Clipboard unavailable. Select the password to copy.",
                );
              }
            }}
          >
            Copy password
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setPassword("");
              setMessage("");
            }}
          >
            Clear
          </Button>
        </div>
        <p role="status">{message}</p>
      </section>
      <section className="card">
        <h2>Generate something stronger.</h2>
        <p className="muted">
          Cryptographically secure randomness, with no server involved.
        </p>
        <label>
          Length: {length}
          <input
            type="range"
            min="12"
            max="64"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </label>
        <div className="stack">
          {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, key]
                      : selected.filter((k) => k !== key),
                  )
                }
              />
              {
                {
                  upper: "Uppercase letters",
                  lower: "Lowercase letters",
                  numbers: "Numbers",
                  symbols: "Symbols",
                }[key]
              }
            </label>
          ))}
        </div>
        <Button onClick={() => create()}>Generate password</Button>
        <hr />
        <h3>Prefer something memorable?</h3>
        <p className="muted">
          Generate eight independently sampled words from a compact word list.
          Keep all eight words; do not substitute a familiar phrase.
        </p>
        <Button variant="outline" onClick={() => create(true)}>
          Generate passphrase
        </Button>
      </section>
    </div>
  );
}
