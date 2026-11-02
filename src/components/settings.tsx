"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { request } from "@/lib/client";
import { browserDb } from "@/lib/supabase/client";
import { Auth } from "./auth";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
type Prefs = {
  email_enabled: boolean;
  ssl_alerts: boolean;
  header_alerts: boolean;
  summary_enabled: boolean;
};
type Data = {
  email: string;
  created_at: string;
  preferences: Prefs;
  retention: string;
};
export function Settings() {
  const [data, setData] = useState<Data>(),
    [prefs, setPrefs] = useState<Prefs>(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState(""),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    request<Data>("settings")
      .then((d) => {
        setData(d);
        setPrefs(d.preferences);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">YOUR WORKSPACE, YOUR CONTROL</span>
        <h1>
          Account & Settings<span className="title-dot">.</span>
        </h1>
        <p>Manage access, notifications and your data.</p>
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <p role="status">{message}</p>
      {!data ? (
        <div className="card empty">
          <h2>Access your account</h2>
          <p>Sign in to manage your profile and notification preferences.</p>
          <Button onClick={() => setAuth(true)}>Sign in / Register</Button>
        </div>
      ) : (
        <>
          <div className="grid two">
            <section className="card">
              <span className="eyebrow">PROFILE</span>
              <h2>Your account</h2>
              <label>
                Confirmed email
                <input value={data.email} readOnly />
              </label>
              <p className="muted">
                Member since{" "}
                {new Date(data.created_at).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
                . Alert delivery uses this confirmed email.
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const r = await browserDb().auth.resetPasswordForEmail(
                      data.email,
                      {
                        redirectTo: `${location.origin}/auth/callback?recovery=1`,
                      },
                    );
                    if (r.error) throw r.error;
                  }, "Recovery email requested. Check your inbox.")
                }
              >
                Send password reset email
              </Button>
              <hr />
              <h3>Update password</h3>
              <p className="muted">
                Use this after following a recovery email, or while signed in.
              </p>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    const r = await browserDb().auth.updateUser({ password });
                    if (r.error) throw r.error;
                    setPassword("");
                  }, "Password updated.");
                }}
              >
                <label>
                  New password
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <Button variant="outline" disabled={busy}>
                  Update password
                </Button>
              </form>
              <hr />
              <Button
                variant="outline"
                onClick={() =>
                  act(async () => {
                    const r = await browserDb().auth.signOut({
                      scope: "global",
                    });
                    if (r.error) throw r.error;
                    location.assign("/");
                  }, "Signed out.")
                }
                disabled={busy}
              >
                Sign out of all sessions
              </Button>
            </section>
            <section className="card">
              <span className="eyebrow">NOTIFICATIONS</span>
              <h2>Keep the useful signals.</h2>
              <p className="muted">
                Email alerts are sent to {data.email}. No arbitrary destination
                addresses are accepted.
              </p>
              {prefs ? (
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(
                      () =>
                        request("settings", "PATCH", {
                          email_enabled: prefs.email_enabled,
                          ssl_alerts: prefs.ssl_alerts,
                          header_alerts: prefs.header_alerts,
                          summary_enabled: false,
                        }),
                      "Notification preferences saved.",
                    );
                  }}
                >
                  {(
                    ["email_enabled", "ssl_alerts", "header_alerts"] as const
                  ).map((k) => (
                    <label className="checkbox preference" key={k}>
                      <div>
                        <strong>
                          {
                            {
                              email_enabled: "Email notifications",
                              ssl_alerts: "TLS & certificate alerts",
                              header_alerts: "Header removal alerts",
                            }[k]
                          }
                        </strong>
                        <p>
                          {
                            {
                              email_enabled:
                                "Receive actionable configuration changes.",
                              ssl_alerts:
                                "Expiry at 30, 14 and 7 days, and invalid certificates.",
                              header_alerts:
                                "Know when previously configured protection is removed.",
                            }[k]
                          }
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs[k]}
                        onChange={(e) =>
                          setPrefs({ ...prefs, [k]: e.target.checked })
                        }
                      />
                    </label>
                  ))}
                  <Button disabled={busy}>Save preferences</Button>
                </form>
              ) : null}
              <hr />
              <h3>Verified domains</h3>
              <p className="muted">
                Manage your DNS challenges, current verification and saved scan
                history.
              </p>
              <Link href="/dashboard" className="button outline">
                Manage domains →
              </Link>
            </section>
          </div>
          <section className="card">
            <h2>Account security & data retention</h2>
            <p className="muted">
              {data.retention} Removing a domain also removes its associated
              scans, alerts and monitor. Account deletion removes the
              authentication account and associated data. Already issued access
              tokens can remain valid until expiry; deleted user records and
              ownership policies prevent further access to data.
            </p>
            <p className="muted">
              Passwords evaluated in KeyGuard never enter your account history.
            </p>
            <Button variant="destructive" onClick={() => setDeleting(true)}>
              Delete account
            </Button>
          </section>
        </>
      )}
      <section className="card">
        <h2>Support</h2>
        <p className="muted">
          Include the tool name, UTC timestamp and a description of the problem.
          Never send passwords or API keys.
        </p>
        {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
          <a
            className="text-link"
            href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
          >
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
          </a>
        ) : (
          <p>
            Operator contact is not configured for this installation. Deployment
            owners can set NEXT_PUBLIC_SUPPORT_EMAIL.
          </p>
        )}
      </section>
      <Auth open={auth} onOpenChange={setAuth} />
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="Permanently delete your account"
      >
        <p>
          This removes your domains, monitoring jobs, alerts and scan history.
          This cannot be undone.
        </p>
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <Button
          variant="destructive"
          disabled={busy || confirmation !== "DELETE"}
          onClick={() =>
            act(async () => {
              await request("settings", "DELETE", { confirmation });
              await browserDb().auth.signOut({ scope: "local" });
              location.assign("/");
            }, "Account deleted.")
          }
        >
          Permanently delete
        </Button>
        {error ? <p role="alert">{error}</p> : null}
      </Modal>
    </>
  );
}
