"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Shield,
  LayoutDashboard,
  FlaskConical,
  Settings,
  Zap,
  ArrowUpRight,
  Menu,
  Home,
  LockKeyhole,
} from "lucide-react";
import { Auth } from "./auth";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { browserDb } from "@/lib/supabase/client";
const links = [
  ["/", "Overview", Home],
  ["/tools", "Security Lab", FlaskConical],
  ["/dashboard", "Command Center", LayoutDashboard],
  ["/automation", "AutoDefense", Zap],
  ["/settings", "Account & Settings", Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [auth, setAuth] = useState(false),
    [menu, setMenu] = useState(false),
    [email, setEmail] = useState<string>(),
    [legal, setLegal] = useState("");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("auth_error")) setAuth(true);
    try {
      const db = browserDb();
      db.auth.getUser().then(({ data }) => setEmail(data.user?.email));
      const { data } = db.auth.onAuthStateChange((_event, session) =>
        setEmail(session?.user.email),
      );
      return () => data.subscription.unsubscribe();
    } catch {}
  }, []);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside id="primary-sidebar" className={menu ? "sidebar open" : "sidebar"}>
        <Link href="/" className="brand">
          <Shield size={32} fill="currentColor" stroke="#0B1220" />
          <span>
            IRONGATE<small>YOUR DIGITAL FORTRESS</small>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Primary navigation">
          {links.map(([href, title, Icon]) => (
            <Link
              className={path === href ? "nav-link active" : "nav-link"}
              href={href}
              key={href}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {title}
              {path === href ? <span className="nav-dot" /> : null}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="privacy-note">
            <LockKeyhole size={18} />
            <strong>Built on trust.</strong>
            <p>Passive checks. Private passwords. Transparent results.</p>
          </div>
          <div className="side-account">
            <span className="avatar">
              {email ? email[0].toUpperCase() : "IG"}
            </span>
            <div>
              <strong>{email ? "Your workspace" : "Personal security"}</strong>
              <small>{email ?? "Get started for free"}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="row">
            <Button
              variant="ghost"
              className="mobile-toggle"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
              aria-expanded={menu}
              aria-controls="primary-sidebar"
            >
              <Menu size={22} />
            </Button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {links.find(([href]) => href === path)?.[1] ?? "IRONGATE"}
              </strong>
            </span>
          </div>
          <div className="row">
            <span className="local-badge">
              <span />
              Non-invasive by design
            </span>
            {email ? (
              <Link className="button outline" href="/settings">
                Account <ArrowUpRight size={15} />
              </Link>
            ) : (
              <Button variant="outline" onClick={() => setAuth(true)}>
                Log in <ArrowUpRight size={15} />
              </Button>
            )}
          </div>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>© {new Date().getFullYear()} IRONGATE</span>
          <div className="row">
            <Button variant="ghost" onClick={() => setLegal("Privacy")}>
              Privacy
            </Button>
            <Button variant="ghost" onClick={() => setLegal("Terms")}>
              Terms
            </Button>
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}>
                Support
              </a>
            ) : (
              <Link href="/settings">Support & setup</Link>
            )}
          </div>
          <span className="mono">PASSIVE. PRIVATE. PRECISE.</span>
        </footer>
      </div>
      <Auth open={auth} onOpenChange={setAuth} />
      <Modal open={!!legal} onOpenChange={() => setLegal("")} title={legal}>
        <p>
          {legal === "Privacy"
            ? "Passwords are evaluated in your browser and are never transmitted or stored. Website scans send the target to our server. Signed-in saved scans, domains, monitoring jobs, and alerts are stored in Supabase until you delete your account or domain. Email alerts are delivered through Resend. Rate limits use a keyed IP hash; expired buckets are removed by the daily dispatcher. No password analytics or tracking is used."
            : "Use IRONGATE only for lawful, passive configuration checks. Monitoring requires domain ownership verification. Results describe observations at one point in time and do not guarantee security or replace a professional assessment. No exploitation or automatic remediation is performed. These MVP terms require operator review before public launch."}
        </p>
      </Modal>
    </>
  );
}
