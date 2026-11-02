import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  CodeXml,
  ArrowUpRight,
  ArrowRight,
  LockKeyhole,
  Globe,
  ScanLine,
  Check,
  Workflow,
  Eye,
} from "lucide-react";
const tools = [
  {
    name: "WebShield",
    slug: "webshield",
    Icon: ShieldCheck,
    label: "WEBSITE CONFIGURATION",
    text: "See the signals that matter. Check HTTPS, certificates, redirects and transport configuration.",
  },
  {
    name: "KeyGuard",
    slug: "keyguard",
    Icon: KeyRound,
    label: "PASSWORD STRENGTH",
    text: "Build stronger credentials. Evaluate passwords privately, entirely inside your browser.",
  },
  {
    name: "HeaderGuard",
    slug: "headerguard",
    Icon: CodeXml,
    label: "HTTP SECURITY HEADERS",
    text: "Go beyond header presence. Understand your policies and get practical configuration guidance.",
  },
];
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> SECURITY, WITHOUT THE GUESSWORK
          </span>
          <h1>
            Your digital
            <br />
            <span>fortress.</span>
          </h1>
          <p>
            Website security checks, actionable findings,
            <br className="desktop" /> and continuous monitoring. One clear
            command center.
          </p>
          <div className="row wrap">
            <Link className="button primary" href="/tools">
              Run Security Check <ArrowUpRight size={18} />
            </Link>
            <Link className="button outline" href="#tools">
              Explore Tools <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-notes">
            <span>
              <Check size={14} /> No intrusive scanning
            </span>
            <span>
              <Check size={14} /> No password uploads
            </span>
          </div>
        </div>
        <div
          className="fortress"
          aria-label="IRONGATE passive security workflow"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="shield-emblem">
            <ShieldCheck size={112} strokeWidth={1} />
          </div>
          <div className="orbit-labels">
            <div className="orbit-label label-a">
              <Globe size={15} /> YOUR WEBSITE
            </div>
            <div className="orbit-label label-b">
              <LockKeyhole size={14} /> PRIVATE BY DESIGN
            </div>
            <div className="orbit-label label-c">
              <Eye size={14} /> PASSIVE ANALYSIS
            </div>
          </div>
          <div className="fortress-caption">
            <span className="dot" /> CLARITY IS YOUR FIRST LINE OF DEFENSE
          </div>
        </div>
      </section>
      <div className="principle-strip">
        <span>
          <LockKeyhole size={17} /> Privacy-first analysis
        </span>
        <span>
          <Globe size={17} /> Public configuration checks
        </span>
        <span>
          <ShieldCheck size={17} /> Verified-domain monitoring
        </span>
        <span>
          <Eye size={17} /> Transparent findings
        </span>
      </div>
      <section id="tools" className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">THE SECURITY LAB</span>
            <h2>Three tools. A stronger foundation.</h2>
          </div>
          <Link href="/tools" className="text-link">
            Open the lab <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="grid three">
          {tools.map((t) => (
            <article className="card tool-card" key={t.name}>
              <div className="row between">
                <span className="icon-box">
                  <t.Icon size={25} />
                </span>
                <span className="chip">PASSIVE / LOCAL</span>
              </div>
              <span className="mini-label">{t.label}</span>
              <h3>{t.name}</h3>
              <p>{t.text}</p>
              <Link href={`/tools?tool=${t.slug}`} className="tool-launch">
                Launch {t.name}
                <ArrowUpRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="automation-preview card">
        <div>
          <span className="eyebrow">
            <Workflow size={16} /> AUTODEFENSE
          </span>
          <h2>
            Stay a step ahead.
            <br />
            Even when you’re away.
          </h2>
          <p>
            Scheduled checks for domains you own. Get notified when
            <br className="desktop" /> certificates approach expiry or security
            configurations change.
          </p>
          <Link href="/automation" className="button outline">
            Explore AutoDefense <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="workflow">
          <div className="workflow-step">
            <span className="icon-box small">
              <Globe size={18} />
            </span>
            <div>
              <strong>Verify your domain</strong>
              <p>Prove ownership with a DNS TXT record</p>
            </div>
            <span className="step-number">01</span>
          </div>
          <div className="workflow-step">
            <span className="icon-box small">
              <ScanLine size={18} />
            </span>
            <div>
              <strong>Set your schedule</strong>
              <p>Daily, weekly or monthly checks</p>
            </div>
            <span className="step-number">02</span>
          </div>
          <div className="workflow-step">
            <span className="icon-box small">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Know what changed</strong>
              <p>Actionable alerts, delivered to your inbox</p>
            </div>
            <span className="step-number">03</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">A CLEAR PATH FORWARD</span>
            <h2>From insight to action.</h2>
          </div>
        </div>
        <div className="grid four">
          {[
            [
              "01",
              "Choose your check",
              "Enter a website URL or evaluate a password locally.",
            ],
            [
              "02",
              "Understand the findings",
              "See observed configurations, limitations and scoring.",
            ],
            [
              "03",
              "Strengthen your setup",
              "Follow practical, prioritized recommendations.",
            ],
            [
              "04",
              "Keep watch",
              "Monitor verified domains and track configuration changes.",
            ],
          ].map(([n, title, text]) => (
            <div className="how-step" key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="closing">
        <ShieldCheck size={22} />
        <p>
          Security begins with visibility.{" "}
          <strong>Make your first check.</strong>
        </p>
        <Link className="text-link" href="/tools">
          Enter Security Lab <ArrowRight size={17} />
        </Link>
      </div>
    </>
  );
}
