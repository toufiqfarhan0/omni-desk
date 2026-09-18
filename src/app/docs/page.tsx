"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

type DocSection =
  | "overview"
  | "quickstart"
  | "architecture"
  | "api-reference"
  | "integrations"
  | "deployment"
  | "supabase"
  | "customization"
  | "faq";

const NAV_ITEMS: { id: DocSection; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "" },
  { id: "quickstart", label: "Quick Start", icon: "" },
  { id: "architecture", label: "Architecture", icon: "" },
  { id: "api-reference", label: "API Reference", icon: "" },
  { id: "integrations", label: "Integrations", icon: "" },
  { id: "supabase", label: "Supabase Setup", icon: "" },
  { id: "deployment", label: "Deployment", icon: "" },
  { id: "customization", label: "Customization", icon: "" },
  { id: "faq", label: "FAQ", icon: "" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div style={{ background: "#fafafa", color: "#09090b", minHeight: "100vh", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* TOP NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e4e4e7" }}>
        <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#09090b" }}>
              <BrandLogo size={28} />
              <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.02em" }}>OmniDesk</span>
            </Link>
            <span style={{ color: "#d4d4d8", fontSize: "18px", fontWeight: 300 }}>/</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#71717a" }}>Documentation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/demo" style={{ fontSize: "13px", fontWeight: 600, color: "#71717a", textDecoration: "none", padding: "6px 14px", border: "1px solid #e4e4e7", borderRadius: "8px", background: "#fff" }}>
              Try Demo
            </Link>
            <Link href="/dashboard" style={{ fontSize: "13px", fontWeight: 600, color: "#fff", textDecoration: "none", padding: "6px 14px", borderRadius: "8px", background: "#09090b" }}>
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "240px 1fr", gap: "0", minHeight: "calc(100vh - 60px)" }}>
        {/* SIDEBAR */}
        <aside style={{ position: "sticky", top: "60px", height: "calc(100vh - 60px)", overflowY: "auto", borderRight: "1px solid #e4e4e7", padding: "24px 0", background: "#fff" }}>
          <div style={{ padding: "0 16px", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a1a1aa", marginBottom: "8px" }}>On This Page</div>
          </div>
          <nav>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "9px 16px",
                  border: "none",
                  background: activeSection === item.id ? "#f4f4f5" : "transparent",
                  color: activeSection === item.id ? "#09090b" : "#52525b",
                  fontFamily: "inherit",
                  fontSize: "13.5px",
                  fontWeight: activeSection === item.id ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  borderLeft: activeSection === item.id ? "2px solid #09090b" : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Quick Links */}
          <div style={{ padding: "24px 16px 0", borderTop: "1px solid #f4f4f5", marginTop: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a1a1aa", marginBottom: "10px" }}>External Links</div>
            <a href="https://www.assemblyai.com/docs" target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "13px", color: "#2563eb", textDecoration: "none", marginBottom: "6px", fontWeight: 500 }}>
              AssemblyAI Docs ↗
            </a>
            <a href="https://omni-desk-rho.vercel.app/demo/salon" target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "13px", color: "#2563eb", textDecoration: "none", marginBottom: "6px", fontWeight: 500 }}>
              Salon Demo ↗
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "13px", color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
              GitHub Repo ↗
            </a>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ padding: "40px 48px 80px", maxWidth: "860px" }}>
          {activeSection === "overview" && <OverviewSection />}
          {activeSection === "quickstart" && <QuickStartSection />}
          {activeSection === "architecture" && <ArchitectureSection />}
          {activeSection === "api-reference" && <ApiReferenceSection />}
          {activeSection === "integrations" && <IntegrationsSection />}
          {activeSection === "supabase" && <SupabaseSection />}
          {activeSection === "deployment" && <DeploymentSection />}
          {activeSection === "customization" && <CustomizationSection />}
          {activeSection === "faq" && <FaqSection />}
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .doc-h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #09090b; margin: 0 0 12px; line-height: 1.15; }
        .doc-h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; margin: 40px 0 14px; padding-top: 40px; border-top: 1px solid #f4f4f5; }
        .doc-h2:first-of-type { margin-top: 28px; padding-top: 0; border-top: none; }
        .doc-h3 { font-size: 17px; font-weight: 600; color: #09090b; margin: 28px 0 10px; }
        .doc-p { font-size: 15px; line-height: 1.7; color: #3f3f46; margin: 0 0 16px; }
        .doc-lead { font-size: 16.5px; line-height: 1.65; color: #52525b; margin-bottom: 28px; }
        .doc-code { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 14px 18px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #09090b; overflow-x: auto; margin: 14px 0; white-space: pre; line-height: 1.6; }
        .doc-inline-code { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 4px; padding: 1.5px 5px; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #09090b; }
        .doc-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 10px; border-radius: 999px; margin-right: 8px; }
        .badge-get { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .badge-post { background: rgba(59,130,246,0.1); color: #2563eb; border: 1px solid rgba(59,130,246,0.2); }
        .badge-new { background: rgba(139,92,246,0.1); color: #7c3aed; border: 1px solid rgba(139,92,246,0.2); }
        .doc-table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 16px 0; }
        .doc-table th { background: #f4f4f5; padding: 10px 14px; text-align: left; font-weight: 600; color: #09090b; border: 1px solid #e4e4e7; }
        .doc-table td { padding: 10px 14px; border: 1px solid #e4e4e7; color: #3f3f46; vertical-align: top; }
        .doc-table tr:nth-child(even) td { background: #fafafa; }
        .doc-callout { border-left: 3px solid; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        .callout-info { background: rgba(59,130,246,0.06); border-color: #3b82f6; }
        .callout-warn { background: rgba(245,158,11,0.07); border-color: #f59e0b; }
        .callout-tip { background: rgba(16,185,129,0.06); border-color: #10b981; }
        .callout-danger { background: rgba(239,68,68,0.06); border-color: #ef4444; }
        .callout-title { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .callout-info .callout-title { color: #2563eb; }
        .callout-warn .callout-title { color: #d97706; }
        .callout-tip .callout-title { color: #059669; }
        .callout-danger .callout-title { color: #dc2626; }
        .endpoint-row { display: flex; align-items: flex-start; gap: 12px; padding: 16px; background: #fff; border: 1px solid #e4e4e7; border-radius: 10px; margin-bottom: 12px; }
        .doc-step { display: flex; gap: 16px; margin-bottom: 24px; }
        .step-num-circle { width: 28px; height: 28px; border-radius: 50%; background: #09090b; color: #fff; font-size: 12px; font-weight: 700; display: grid; place-items: center; flex-shrink: 0; margin-top: 3px; }
        .step-content {}
      `}</style>
    </div>
  );
}

// ===========================================================================
// SECTIONS
// ===========================================================================

function OverviewSection() {
  return (
    <div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "999px", padding: "4px 12px", fontSize: "12px", fontWeight: 600, color: "#52525b", marginBottom: "16px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
        AssemblyAI Voice Agent API · Server-Side HTTP Tools
      </div>
      <h1 className="doc-h1">OmniDesk Documentation</h1>
      <p className="doc-lead">
        OmniDesk is a full-stack AI voice receptionist platform. It uses the AssemblyAI Voice Agent API with server-side HTTP tools to handle inbound calls, check real calendar availability, and book confirmed appointments — all without human intervention.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "36px" }}>
        {[
          { title: "Voice Agent API", desc: "Built on AssemblyAI's real-time bidirectional WebSocket pipeline.", color: "#3b82f6" },
          { title: "Dual-Mode Database", desc: "SQLite for local development, Supabase PostgreSQL for production.", color: "#10b981" },
          { title: "Multi-Tenant SaaS", desc: "Each owner gets their own business, bookings, and agent config.", color: "#8b5cf6" },
        ].map((c) => (
          <div key={c.title} style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: "12px", padding: "20px", borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#09090b", marginBottom: "6px" }}>{c.title}</div>
            <div style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="doc-h2">What OmniDesk Does</h2>
      <p className="doc-p">When a caller dials in, OmniDesk's voice agent:</p>
      <ul style={{ paddingLeft: "20px", margin: "0 0 16px" }}>
        {[
          "Greets the caller in a natural, conversational tone",
          "Answers questions about available services and pricing",
          "Checks real-time availability from the booking database",
          "Collects caller name, email, and preferred appointment slot",
          "Creates a booking record and sends a confirmation + .ics calendar invite",
          "Logs the full conversation transcript to your Owner Portal",
        ].map((item) => (
          <li key={item} style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7, marginBottom: "4px" }}>{item}</li>
        ))}
      </ul>

      <h2 className="doc-h2">Live Demo</h2>
      <p className="doc-p">Experience OmniDesk deployed on a real business website:</p>
      <div style={{ maxWidth: "540px" }}>
        {[
          { name: "Luxe & Mane Hair Studio", desc: "High-end salon with precision haircuts, coloring & balayage booking.", url: "https://omni-desk-rho.vercel.app/demo/salon", color: "#10b981", label: "Open Salon Demo" },
        ].map((demo) => (
          <a key={demo.name} href={demo.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "20px", background: "#fff", border: "1px solid #e4e4e7", borderRadius: "12px", textDecoration: "none", transition: "all 0.2s" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#09090b", marginBottom: "6px" }}>{demo.name}</div>
            <div style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5, marginBottom: "14px" }}>{demo.desc}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: demo.color, color: "#fff", fontSize: "12.5px", fontWeight: 600, padding: "6px 14px", borderRadius: "8px" }}>
              {demo.label} ↗
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function QuickStartSection() {
  return (
    <div>
      <h1 className="doc-h1">Quick Start</h1>
      <p className="doc-lead">Get OmniDesk running locally in under 5 minutes. No external accounts needed for the SQLite (zero-config) mode.</p>

      <div className="doc-callout callout-tip">
        <div className="callout-title">Zero-Config Mode</div>
        <p style={{ fontSize: "14px", color: "#3f3f46", margin: 0, lineHeight: 1.6 }}>
          Without any environment variables, OmniDesk uses local SQLite and pre-seeds demo data. Perfect for judges and evaluators.
        </p>
      </div>

      <h2 className="doc-h2">1. Clone & Install</h2>
      <div className="doc-step">
        <div className="step-num-circle">1</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Clone the repository and install dependencies:</p>
          <div className="doc-code">{`git clone https://github.com/your-org/omnidesk.git
cd omnidesk
pnpm install`}</div>
        </div>
      </div>

      <h2 className="doc-h2">2. Configure Environment</h2>
      <div className="doc-step">
        <div className="step-num-circle">2</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Copy the example env file and fill in your keys:</p>
          <div className="doc-code">{`cp .env.example .env`}</div>
          <p className="doc-p">Minimum required for the voice agent to work:</p>
          <div className="doc-code">{`# Required — AssemblyAI
NEXT_ASSEMBLYAI_API_KEY=your_assemblyai_key
AGENT_ID=your_assemblyai_agent_id

# Optional — Supabase (for production persistence)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Optional — Gmail SMTP (for booking confirmation emails)
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Optional — Force database mode
DB_MODE=sqlite   # or: dual | supabase`}</div>
        </div>
      </div>

      <h2 className="doc-h2">3. Run Locally</h2>
      <div className="doc-step">
        <div className="step-num-circle">3</div>
        <div className="step-content" style={{ flex: 1 }}>
          <div className="doc-code">{`pnpm dev`}</div>
          <p className="doc-p">Open <span className="doc-inline-code">http://localhost:3000</span> in your browser. The demo account is pre-seeded automatically.</p>
        </div>
      </div>

      <h2 className="doc-h2">4. Sign In or Use Demo</h2>
      <div className="doc-step">
        <div className="step-num-circle">4</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">On the landing page, click <strong>Sign In / Sign Up</strong>. You can create a real account with email + password, or click <strong>Enter as Demo Account</strong> to bypass auth.</p>
        </div>
      </div>

      <div className="doc-callout callout-info">
        <div className="callout-title">AssemblyAI Agent Setup</div>
        <p style={{ fontSize: "14px", color: "#3f3f46", margin: 0, lineHeight: 1.6 }}>
          To use the live voice widget, you need to create an AssemblyAI Voice Agent and set <span className="doc-inline-code">ASSEMBLYAI_AGENT_ID</span> in your <span className="doc-inline-code">.env</span>. See the <strong>Integrations</strong> section for details.
        </p>
      </div>
    </div>
  );
}

function ArchitectureSection() {
  return (
    <div>
      <h1 className="doc-h1">Architecture</h1>
      <p className="doc-lead">OmniDesk follows a clean, layered architecture where the AssemblyAI Voice Agent executes server-side HTTP tools to interact with your booking database.</p>

      <h2 className="doc-h2">Call Flow</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "28px" }}>
        {[
          { step: "01", title: "Caller Dials", desc: "Bidirectional 24kHz PCM16 audio over WebSocket to AssemblyAI's STT pipeline." },
          { step: "02", title: "Agent Queries Clock", desc: "Executes POST /tools/get_today to anchor time and prevent date hallucination." },
          { step: "03", title: "Check & Book", desc: "Verifies real slots, reserves appointment, prevents double-bookings in DB." },
          { step: "04", title: "Confirmation", desc: "Booking appears in Owner Portal instantly; .ics calendar invite emailed to customer." },
        ].map((s) => (
          <div key={s.step} style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: "10px", padding: "18px" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 700, background: "#f4f4f5", color: "#52525b", padding: "2px 7px", borderRadius: "4px", display: "inline-block", marginBottom: "10px" }}>Step {s.step}</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#09090b", marginBottom: "6px" }}>{s.title}</div>
            <div style={{ fontSize: "12.5px", color: "#71717a", lineHeight: 1.55 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="doc-h2">Database Architecture</h2>
      <p className="doc-p">OmniDesk uses a dual-mode database system that automatically selects the right engine:</p>
      <table className="doc-table">
        <thead>
          <tr><th>Mode</th><th>When Active</th><th>Engine</th><th>Persistence</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>sqlite</strong></td><td>No Supabase keys, local dev</td><td>better-sqlite3</td><td>Local <code>data/omnidesk.db</code></td></tr>
          <tr><td><strong>dual</strong></td><td>Local + Supabase keys present</td><td>SQLite primary, Supabase sync</td><td>Both</td></tr>
          <tr><td><strong>supabase</strong></td><td>Production / Vercel</td><td>Supabase PostgreSQL</td><td>Cloud</td></tr>
        </tbody>
      </table>

      <p className="doc-p">The mode is auto-detected at runtime. Set <span className="doc-inline-code">DB_MODE=sqlite</span> to force SQLite locally even if Supabase keys are present.</p>

      <h2 className="doc-h2">Key Directories</h2>
      <div className="doc-code">{`src/
├── app/
│   ├── api/
│   │   ├── auth/owner/       ← Sign in / Sign up endpoint
│   │   ├── tools/            ← HTTP tools called by AssemblyAI agent
│   │   ├── token/            ← Mints AssemblyAI session tokens
│   │   └── owner/            ← Business & stats APIs
│   ├── dashboard/            ← Owner Portal UI
│   ├── demo/                 ← Live voice demo sandbox
│   └── docs/                 ← This documentation page
├── lib/
│   ├── db.ts                 ← Unified DB layer (SQLite + Supabase)
│   ├── supabase-db.ts        ← Supabase-specific queries
│   ├── calendar.ts           ← Gmail SMTP + .ics invite engine
│   └── audio.ts              ← AssemblyAI WebSocket client
└── components/
    └── dashboard/            ← Sidebar, AgentBuilder, BookingsCRM, etc.`}</div>
    </div>
  );
}

function ApiReferenceSection() {
  return (
    <div>
      <h1 className="doc-h1">API Reference</h1>
      <p className="doc-lead">All HTTP endpoints exposed by OmniDesk. The <code>/tools/*</code> endpoints are executed directly by the AssemblyAI Voice Agent during live calls.</p>

      <h2 className="doc-h2">Authentication</h2>
      <div className="endpoint-row">
        <span className="doc-badge badge-post">POST</span>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#09090b", marginBottom: "4px" }}>/api/auth/owner</div>
          <div style={{ fontSize: "13px", color: "#52525b", marginBottom: "10px" }}>Sign in or sign up an owner account with email + password.</div>
          <div className="doc-code" style={{ margin: 0 }}>{`// Request body
{
  "email": "you@business.com",
  "password": "mysecretpass",
  "mode": "signup",         // or "signin"
  "name": "Jane Smith"      // required for signup only
}

// Success response
{
  "ok": true,
  "owner": { "id": "owner_...", "email": "...", "name": "..." },
  "businesses": [{ "id": "biz_...", "name": "..." }]
}`}</div>
        </div>
      </div>

      <h2 className="doc-h2">Voice Agent Tools</h2>
      <p className="doc-p">These endpoints are called by the AssemblyAI agent over HTTPS during a live call. They are stateless and return JSON.</p>

      {[
        { method: "POST", path: "/api/tools/get_today", desc: "Returns today's date, current time, and day-of-week. Used to anchor the agent's temporal awareness." },
        { method: "POST", path: "/api/tools/check_availability", desc: "Returns available appointment slots for a given service on a specific date." },
        { method: "POST", path: "/api/tools/book_appointment", desc: "Creates a confirmed booking record and dispatches an email + .ics invite to the customer." },
        { method: "POST", path: "/api/tools/get_services", desc: "Returns all available services for the business with pricing and duration." },
      ].map((ep) => (
        <div key={ep.path} className="endpoint-row">
          <span className={`doc-badge ${ep.method === "GET" ? "badge-get" : "badge-post"}`}>{ep.method}</span>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#09090b", marginBottom: "4px" }}>{ep.path}</div>
            <div style={{ fontSize: "13px", color: "#52525b" }}>{ep.desc}</div>
          </div>
        </div>
      ))}

      <h2 className="doc-h2">Owner Portal APIs</h2>
      {[
        { method: "GET", path: "/api/owner/businesses?ownerId=...", desc: "Lists all businesses belonging to a specific owner ID." },
        { method: "GET", path: "/api/owner-stats", desc: "Returns aggregate booking and revenue stats for the dashboard." },
        { method: "GET", path: "/api/token", desc: "Mints a short-lived AssemblyAI session token for the voice widget." },
        { method: "GET", path: "/api/config", desc: "Returns the current AssemblyAI agent ID and public config." },
      ].map((ep) => (
        <div key={ep.path} className="endpoint-row">
          <span className={`doc-badge ${ep.method === "GET" ? "badge-get" : "badge-post"}`}>{ep.method}</span>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#09090b", marginBottom: "4px" }}>{ep.path}</div>
            <div style={{ fontSize: "13px", color: "#52525b" }}>{ep.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IntegrationsSection() {
  return (
    <div>
      <h1 className="doc-h1">Integrations</h1>
      <p className="doc-lead">OmniDesk integrates with AssemblyAI for voice, Supabase for data, and Gmail for email delivery.</p>

      <h2 className="doc-h2">AssemblyAI Voice Agent</h2>
      <p className="doc-p">OmniDesk is built on top of the AssemblyAI Voice Agent API. You need to:</p>
      <div className="doc-step">
        <div className="step-num-circle">1</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Create an account at <a href="https://assemblyai.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>assemblyai.com</a> and get your API key.</p>
          <div className="doc-code">{`ASSEMBLYAI_API_KEY=your_api_key_here`}</div>
        </div>
      </div>
      <div className="doc-step">
        <div className="step-num-circle">2</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">In the AssemblyAI dashboard, create a Voice Agent. Configure it with the following HTTP tool URLs pointing to your deployed domain:</p>
          <div className="doc-code">{`https://your-domain.com/api/tools/get_today
https://your-domain.com/api/tools/get_services
https://your-domain.com/api/tools/check_availability
https://your-domain.com/api/tools/book_appointment`}</div>
        </div>
      </div>
      <div className="doc-step">
        <div className="step-num-circle">3</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Copy your Agent ID and add it to your environment:</p>
          <div className="doc-code">{`ASSEMBLYAI_AGENT_ID=agent_xxxxxxxxxxxxxxxx`}</div>
        </div>
      </div>

      <h2 className="doc-h2">Gmail SMTP (Email Confirmations)</h2>
      <p className="doc-p">OmniDesk uses Gmail's free SMTP server to send booking confirmation emails with .ics calendar attachments.</p>

      <div className="doc-callout callout-warn">
        <div className="callout-title">App Password Required</div>
        <p style={{ fontSize: "14px", color: "#3f3f46", margin: 0, lineHeight: 1.6 }}>
          You must use a Gmail <strong>App Password</strong> — not your regular password. Enable 2FA on your Google account, then generate an App Password under <em>Security → App passwords</em>.
        </p>
      </div>

      <div className="doc-code">{`GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop   # 16-char app password`}</div>

      <h2 className="doc-h2">Supabase (Production Database)</h2>
      <p className="doc-p">For production, configure Supabase to store bookings, conversations, and owner accounts persistently in the cloud.</p>
      <div className="doc-code">{`SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key`}</div>
      <p className="doc-p">See the <strong>Supabase Setup</strong> section for the full SQL schema to run in your Supabase project.</p>
    </div>
  );
}

function SupabaseSection() {
  return (
    <div>
      <h1 className="doc-h1">Supabase Setup</h1>
      <p className="doc-lead">To enable production persistence, run the following SQL in your Supabase project's SQL Editor to create all required tables.</p>

      <div className="doc-callout callout-info">
        <div className="callout-title">When To Do This</div>
        <p style={{ fontSize: "14px", color: "#3f3f46", margin: 0, lineHeight: 1.6 }}>
          Only required if you want production/cloud persistence. For local development and demo, SQLite is automatically used and requires zero setup.
        </p>
      </div>

      <h2 className="doc-h2">Step 1 — Create Supabase Project</h2>
      <p className="doc-p">Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>supabase.com</a>, create a new project, and copy your <strong>Project URL</strong> and <strong>Service Role Key</strong> from <em>Settings → API</em>.</p>

      <h2 className="doc-h2">Step 2 — Run the Schema SQL</h2>
      <p className="doc-p">In Supabase <em>SQL Editor</em>, paste and run the following:</p>
      <div className="doc-code">{`-- Owners table
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'salon',
  tone TEXT NOT NULL DEFAULT 'warm',
  greeting TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  voice_id TEXT NOT NULL DEFAULT 'alba',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  open_hour INTEGER NOT NULL DEFAULT 9,
  close_hour INTEGER NOT NULL DEFAULT 17,
  operating_days TEXT NOT NULL DEFAULT 'mon-fri',
  keyterms JSONB NOT NULL DEFAULT '[]',
  assemblyai_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  UNIQUE(business_id, key)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  confirmation_code TEXT UNIQUE NOT NULL,
  service_key TEXT NOT NULL,
  service_label TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  confirmation_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  caller_name TEXT,
  caller_email TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  outcome TEXT DEFAULT 'inquiry',
  transcript JSONB NOT NULL DEFAULT '[]',
  tool_calls JSONB NOT NULL DEFAULT '[]'
);

-- Session store (for verified email flow)
CREATE TABLE IF NOT EXISTS session_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`}</div>

      <h2 className="doc-h2">Step 3 — Disable Row Level Security (Development)</h2>
      <div className="doc-callout callout-warn">
        <div className="callout-title">For Development Only</div>
        <p style={{ fontSize: "14px", color: "#3f3f46", margin: 0, lineHeight: 1.6 }}>
          Since OmniDesk uses the <strong>Service Role Key</strong> (which bypasses RLS), you can leave RLS enabled or disabled. For simplicity during development, you may disable it:
        </p>
      </div>
      <div className="doc-code">{`ALTER TABLE owners DISABLE ROW LEVEL SECURITY;
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_store DISABLE ROW LEVEL SECURITY;`}</div>

      <h2 className="doc-h2">Step 4 — Add Environment Variables</h2>
      <div className="doc-code">{`SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}</div>
      <p className="doc-p">Restart your dev server. OmniDesk will automatically detect Supabase keys and switch to <span className="doc-inline-code">dual</span> mode (SQLite primary + Supabase sync) locally, or <span className="doc-inline-code">supabase</span> mode on Vercel.</p>
    </div>
  );
}

function DeploymentSection() {
  return (
    <div>
      <h1 className="doc-h1">Deployment</h1>
      <p className="doc-lead">OmniDesk is designed for one-click Vercel deployment. SQLite is disabled automatically in production; all data goes to Supabase.</p>

      <h2 className="doc-h2">Deploy to Vercel</h2>
      <div className="doc-step">
        <div className="step-num-circle">1</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Push your repo to GitHub, then import it in <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Vercel</a>.</p>
        </div>
      </div>
      <div className="doc-step">
        <div className="step-num-circle">2</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Add the following environment variables in Vercel's project settings:</p>
          <table className="doc-table">
            <thead>
              <tr><th>Variable</th><th>Required?</th><th>Description</th></tr>
            </thead>
            <tbody>
              {[
                ["NEXT_ASSEMBLYAI_API_KEY", "Required", "Your AssemblyAI API key"],
                ["AGENT_ID", "Required", "Your AssemblyAI Voice Agent ID"],
                ["SUPABASE_URL", "Required", "Supabase project URL"],
                ["SUPABASE_ANON_KEY", "Required", "Supabase Anon Key"],
                ["GMAIL_USER", "Optional", "Gmail address for confirmations"],
                ["GMAIL_APP_PASSWORD", "Optional", "Gmail 16-char app password"],
                ["PUBLIC_API_BASE_URL", "Optional", "Your production domain URL"],
              ].map(([k, r, d]) => (
                <tr key={k}>
                  <td><code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{k}</code></td>
                  <td style={{ color: r.includes("Yes") ? "#059669" : "#71717a" }}>{r}</td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="doc-step">
        <div className="step-num-circle">3</div>
        <div className="step-content" style={{ flex: 1 }}>
          <p className="doc-p">Deploy. Vercel automatically detects it's a Next.js app. The build command is <span className="doc-inline-code">next build</span>.</p>
          <div className="doc-callout callout-tip" style={{ margin: "0" }}>
            <div className="callout-title">Database Auto-Switch</div>
            <p style={{ fontSize: "14px", color: "#3f3f46", margin: 0, lineHeight: 1.6 }}>
              When deployed on Vercel, the presence of the <span className="doc-inline-code">VERCEL</span> environment variable automatically sets the DB mode to <strong>supabase</strong>. No manual configuration needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomizationSection() {
  return (
    <div>
      <h1 className="doc-h1">Customization</h1>
      <p className="doc-lead">Every aspect of OmniDesk is configurable per business — from voice and tone to working hours and service catalog.</p>

      <h2 className="doc-h2">Agent Builder</h2>
      <p className="doc-p">In the Owner Portal (dashboard), use the <strong>AI Agent Builder</strong> tab to customize:</p>
      <table className="doc-table">
        <thead>
          <tr><th>Setting</th><th>Description</th></tr>
        </thead>
        <tbody>
          {[
            ["Business Name", "Name of the business the agent represents."],
            ["Industry", "Determines the default services and language style (salon, real estate, etc.)."],
            ["Greeting", "The opening message the agent says when a call starts."],
            ["System Prompt", "Custom instructions that define the agent's personality and scope."],
            ["Voice", "Select from available AssemblyAI voices (alba, michael, etc.)."],
            ["Slot Duration", "Duration in minutes of each appointment slot."],
            ["Working Hours", "Open hour, close hour, and operating days (e.g., mon-fri)."],
            ["Phonetic Boost", "Custom words to improve transcription accuracy (service names, brand names)."],
          ].map(([k, v]) => (
            <tr key={k}><td><strong>{k}</strong></td><td>{v}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="doc-h2">Service Catalog</h2>
      <p className="doc-p">Each business has a list of services with:</p>
      <ul style={{ paddingLeft: "20px", margin: "0 0 16px" }}>
        <li style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7 }}><strong>key</strong> — Unique identifier (e.g., <code>haircut</code>)</li>
        <li style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7 }}><strong>label</strong> — Display name (e.g., <code>Signature Haircut & Styling</code>)</li>
        <li style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7 }}><strong>minutes</strong> — Duration of the appointment slot</li>
        <li style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7 }}><strong>price</strong> — Price in USD</li>
        <li style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7 }}><strong>description</strong> — What's included</li>
      </ul>

      <h2 className="doc-h2">Multi-Business Support</h2>
      <p className="doc-p">Each owner account can manage multiple businesses. Use the business selector dropdown in the dashboard to switch between them. Each business has its own:</p>
      <ul style={{ paddingLeft: "20px", margin: "0 0 16px" }}>
        {["Booking database", "Agent configuration", "Service catalog", "Call history & transcript logs", "Revenue & booking stats"].map((i) => (
          <li key={i} style={{ fontSize: "15px", color: "#3f3f46", lineHeight: 1.7 }}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function FaqSection() {
  const faqs = [
    { q: "Does OmniDesk work without any API keys?", a: "Yes! In zero-config mode (no env vars), OmniDesk uses SQLite with pre-seeded demo data. You can browse the dashboard and test the UI without any external accounts." },
    { q: "What happens when someone clones the repo?", a: "They get a fully functional local instance immediately — SQLite is auto-initialized with the demo hair salon and real estate businesses. They only need an AssemblyAI key to activate the live voice widget." },
    { q: "Is auth secure?", a: "Yes. Passwords are hashed with bcrypt (cost factor 10) before storage. Plain-text passwords are never stored in the database. The demo account has no password." },
    { q: "Can I use this without Supabase?", a: "Absolutely. For local development and demos, SQLite is used. Supabase is only needed when you want cloud persistence across deployments (e.g., production on Vercel)." },
    { q: "How does the dual-mode database work?", a: "When both local and Supabase keys are present, SQLite is the primary store and writes are asynchronously synced to Supabase in the background. On Vercel, only Supabase is used." },
    { q: "Can I add my own industry type?", a: "Yes. The industry field is a free-form string. You can customize the system_prompt and services to fit any business type — medical clinic, law firm, restaurant, etc." },
    { q: "How do I get email confirmations working?", a: "Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file. You need a Gmail App Password (not your regular password). The booking confirmation email includes a .ics calendar attachment." },
    { q: "What AssemblyAI features are used?", a: "The Voice Agent API (bidirectional WebSocket streaming), server-side HTTP tool calling, phonetic keyword boosting (KeyTerms), and the real-time transcription pipeline." },
  ];

  return (
    <div>
      <h1 className="doc-h1">FAQ</h1>
      <p className="doc-lead">Frequently asked questions about OmniDesk.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {faqs.map((faq) => (
          <FaqItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: "10px", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", textAlign: "left", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: "15px", fontWeight: 600, color: "#09090b" }}>{q}</span>
        <span style={{ fontSize: "18px", color: "#a1a1aa", flex: "none", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 16px", fontSize: "14.5px", color: "#52525b", lineHeight: 1.65, borderTop: "1px solid #f4f4f5" }}>
          {a}
        </div>
      )}
    </div>
  );
}
