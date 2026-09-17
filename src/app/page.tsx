"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleDemoSignIn = () => {
    window.location.href = "/dashboard";
  };

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font)", minHeight: "100vh", fontSize: "15px", lineHeight: "1.6", letterSpacing: "-0.011em", WebkitFontSmoothing: "antialiased" }}>
      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="container">
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "68px" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "var(--text)" }}>
              <div style={{ width: "32px", height: "32px", display: "grid", placeItems: "center", color: "var(--text)", flexShrink: 0 }}>
                <BrandLogo size={32} />
              </div>
              <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.025em" }}>OmniDesk</span>
            </a>

            <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
              <a href="#features" className="nav-link">Capabilities</a>
              <a href="#architecture" className="nav-link">Architecture</a>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <a href="/demo" className="btn btn-outline" style={{ fontSize: "13px", padding: "7px 14px" }}>
                Try Demos
              </a>
              <button
                type="button"
                onClick={() => { setAuthModalOpen(true); setMode("signin"); }}
                className="btn btn-primary"
                style={{ fontSize: "13px", padding: "7px 16px", cursor: "pointer" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" x2="19" y1="8" y2="14"/>
                  <line x1="22" x2="16" y1="11" y2="11"/>
                </svg>
                Sign In / Sign Up
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ padding: "80px 0 64px", textAlign: "center" }}>
        <div className="container">
          <div style={{ maxWidth: "820px", margin: "0 auto" }}>
            <div className="eyebrow-badge">
              <span className="live-dot" />
              AssemblyAI Voice Agent API &middot; Server-Side HTTP Tools
            </div>
            <h1 style={{ margin: "0 0 20px", fontSize: "52px", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.035em", color: "var(--text)" }}>
              The Voice Receptionist That Actually Books Appointments.
            </h1>
            <p className="lead" style={{ margin: "0 auto 32px", fontSize: "18px", lineHeight: 1.55, color: "var(--text-muted)", maxWidth: "620px" }}>
              Speaks with callers naturally, queries live practice calendars in real time, and books confirmed slots directly into your database.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginBottom: "48px", flexWrap: "wrap" }}>
              <a href="/dashboard" className="btn btn-primary btn-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M9 3v18"/>
                </svg>
                Open Owner Portal &rarr;
              </a>
              <a href="/demo" className="btn btn-outline btn-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
                Try Demos
              </a>
            </div>
          </div>

          {/* Hero Preview Card */}
          <div className="hero-preview">
            <div className="preview-bar">
              <div className="preview-tenant">
                <span className="live-dot" />
                OmniDesk Hair Salon &amp; Studio &mdash; Live Inbound Stream
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--text-muted)" }}>Latency: 280ms &middot; 24kHz PCM16</span>
            </div>
            <div className="preview-body">
              {/* Left: Conversation Stream */}
              <div className="preview-pane">
                <div className="preview-label">Live Caller &amp; Assistant Dialog</div>
                <div className="preview-bubble caller">
                  &quot;Hi, I want to book a haircut and blowout for tomorrow morning.&quot;
                </div>
                <div className="preview-bubble agent">
                  &quot;Tomorrow on Thursday September 17, we have openings at 9:00 am, 9:30 am, and 10:30 am. Which time works best for you?&quot;
                </div>
              </div>
              {/* Right: Tool Execution */}
              <div className="preview-pane">
                <div className="preview-label">AssemblyAI &rarr; Booking Engine Tool Call</div>
                <div className="preview-tool-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="tool-tag">POST /tools/check_availability</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--accent-text)" }}>200 OK</span>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--text-muted)", background: "#ffffff", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                    service: &quot;haircut&quot;<br />
                    date: &quot;2026-09-17&quot;<br />
                    slots: [&quot;09:00&quot;, &quot;09:30&quot;, &quot;10:30&quot;]
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TECH STRIP */}
      <div className="strip">
        <div className="container">
          <div className="strip-title">Powered by Foundational Voice &amp; Cloud Infrastructure</div>
          <div className="strip-logos">
            <div className="strip-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              AssemblyAI Voice Agent API
            </div>
            <div className="strip-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
              Next.js Server-Side HTTP Tools
            </div>
            <div className="strip-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              Resend Email (.ics Invites)
            </div>
            <div className="strip-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
              Real-Time Slot Engine
            </div>
          </div>
        </div>
      </div>

      {/* BENTO CAPABILITIES */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-head">
            <div className="section-tag">Key Capabilities</div>
            <h2>Architected For Zero Human Receptionist Burnout</h2>
            <p>Every call is handled like a veteran receptionist on the phone: natural cadence, immediate interruption recovery, and validated calendar bookings.</p>
          </div>

          <div className="bento-grid">
            <div className="bento-card">
              <div className="bento-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/>
                </svg>
              </div>
              <h3>Instant Barge-In &amp; Interruptibility</h3>
              <p>Callers never have to wait for the assistant to finish a monologue. Speak at any moment, and the agent pauses instantaneously with zero awkward delay.</p>
              <div className="bento-metric">&lt;300ms Voice Latency</div>
            </div>

            <div className="bento-card">
              <div className="bento-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <h3>Server-Side HTTP Tools</h3>
              <p>No browser dispatchers or fragile client scripting. AssemblyAI executes your tool endpoints directly against your booking API over secure HTTPS.</p>
              <div className="bento-metric">100% Server-Side Isolation</div>
            </div>

            <div className="bento-card">
              <div className="bento-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <h3>1-Tap Calendar Invites (.ics)</h3>
              <p>When an appointment is reserved, customers receive a confirmation email with native .ics calendar events for Apple, Google, and Outlook.</p>
              <div className="bento-metric">Resend Transactional Engine</div>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE FLOW */}
      <section className="section" id="architecture" style={{ background: "var(--surface-subtle)" }}>
        <div className="container">
          <div className="section-head">
            <div className="section-tag">End-To-End Architecture</div>
            <h2>From Voice Stream To Confirmed Calendar Event</h2>
            <p>A deterministic, hallucination-resistant pipeline designed specifically for clinical scheduling.</p>
          </div>

          <div className="arch-wrap">
            <div className="arch-steps">
              <div className="arch-step">
                <span className="step-num">Step 01</span>
                <h4>Caller Dials In</h4>
                <p>Bidirectional 24kHz PCM16 audio streams over WebSocket to AssemblyAI&apos;s speech-to-text pipeline.</p>
              </div>
              <div className="arch-step">
                <span className="step-num">Step 02</span>
                <h4>Agent Queries Clock</h4>
                <p>Assistant executes <code>POST /tools/get_today</code> to anchor system time and avoid date hallucinations.</p>
              </div>
              <div className="arch-step">
                <span className="step-num">Step 03</span>
                <h4>Availability &amp; Booking</h4>
                <p>Verifies real clinic slots, reserves appointment, and prevents double-bookings in SQLite.</p>
              </div>
              <div className="arch-step">
                <span className="step-num">Step 04</span>
                <h4>Dashboard &amp; Confirmation</h4>
                <p>Appointment immediately populates the Owner Console and dispatches an .ics calendar invite.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FLAGSHIP DEPLOYMENT */}
      <section className="section" id="flagship">
        <div className="container">
          <div className="featurette">
            <div>
              <div className="section-tag">Flagship Deployment</div>
              <h3>OmniDesk Hair Salon &amp; Studio</h3>
              <p>
                Experience OmniDesk configured as an autonomous salon receptionist managing four core styling services: signature haircuts, full color &amp; gloss, artisan balayage, and blowout treatments.
              </p>
              <div className="feature-list">
                <div className="feature-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  <span><strong>Multi-Service Slot Logic:</strong> 45m haircuts to 120m artisan balayage.</span>
                </div>
                <div className="feature-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  <span><strong>Resend Email &amp; .ics Invites:</strong> Sends instant booking confirmations with 1-tap calendar invites.</span>
                </div>
                <div className="feature-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  <span><strong>Phonetic Keyterm Boost:</strong> Transcribes salon terms (balayage, blowout, esthetician) with precision.</span>
                </div>
              </div>
              <div className="featurette-cta-row">
                <a href="/demo" className="btn btn-primary featurette-btn">Try Demos &rarr;</a>
                <a href="/dashboard" className="btn btn-outline featurette-btn">Build Custom Workflow &rarr;</a>
              </div>
            </div>

            {/* Sheet Preview Box */}
            <div className="sheet-preview-box">
              <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>OmniDesk SaaS Owner Portal</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--accent-text)" }}>Live Workspace</span>
              </div>
              <div className="sheet-kpi-row">
                <div className="sheet-mini-kpi">
                  <div className="sheet-mini-val">4</div>
                  <div className="sheet-mini-lbl">Bookings</div>
                </div>
                <div className="sheet-mini-kpi">
                  <div className="sheet-mini-val">$615</div>
                  <div className="sheet-mini-lbl">Revenue</div>
                </div>
                <div className="sheet-mini-kpi">
                  <div className="sheet-mini-val">100%</div>
                  <div className="sheet-mini-lbl">Confirmed</div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <strong>Eleanor Vance</strong>
                  <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>Signature Haircut &amp; Styling</span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "11.5px", fontFamily: "var(--mono)" }}>
                  Thursday Sep 17 &middot; 10:00 AM &middot; Code #7JFREK
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-banner">
            <h2>Ready To Hear It Speak?</h2>
            <p>Test the live voice receptionist directly in your browser. Experience instantaneous barge-in and real-time tool execution.</p>
            <a href="/demo" className="btn btn-cta-white btn-lg">
              Try Demos &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="footer-row">
            <div className="footer-copy">
              &copy; 2026 OmniDesk. Powered by AssemblyAI Voice Agent API.
            </div>
            <div className="footer-badge">
              HTTP Tools &middot; Resend Engine &middot; Light Mode UI
            </div>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {authModalOpen && (
        <div
          className="auth-modal is-open"
          onClick={(e) => { if (e.target === e.currentTarget) setAuthModalOpen(false); }}
        >
          <div className="auth-modal-box">
            <div className="auth-head">
              <div>
                <h3 className="auth-title">OmniDesk Portal Access</h3>
                <p className="auth-sub">Manage your AI voice receptionist, customize prompts, and inspect live customer call logs.</p>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setAuthModalOpen(false)}>
                &times;
              </button>
            </div>

            {/* Demo Account Card */}
            <div className="demo-bypass-card">
              <div className="demo-bypass-title" style={{ marginBottom: "10px" }}>Don&apos;t want to sign in? Use Demo Account</div>
              <button type="button" className="btn-demo-signin" onClick={handleDemoSignIn}>
                <span>Enter as Demo Account</span>
              </button>
            </div>

            {/* Divider */}
            <div className="auth-divider"><span>Or Continue with Email</span></div>

            {/* Tabs */}
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab-btn${mode === "signin" ? " active" : ""}`}
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn${mode === "signup" ? " active" : ""}`}
                onClick={() => setMode("signup")}
              >
                Create Account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleDemoSignIn(); }}>
              {mode === "signup" && (
                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="auth-fullname">Full Name</label>
                  <input type="text" id="auth-fullname" className="auth-input" placeholder="e.g. Eleanor Vance" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </div>
              )}
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="auth-email">Email Address</label>
                <input type="email" id="auth-email" className="auth-input" placeholder="you@business.com" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="auth-password">Password</label>
                <input type="password" id="auth-password" className="auth-input" placeholder="At least 6 characters" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button type="submit" className="btn-submit-auth">
                <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .container { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .nav-link { font-size: 13.5px; font-weight: 500; color: var(--text-muted); text-decoration: none; transition: color 0.15s ease; }
        .nav-link:hover { color: var(--text); }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-family: var(--font); font-size: 13.5px; font-weight: 600; padding: 9px 18px; border-radius: var(--radius-md); text-decoration: none; cursor: pointer; transition: all 0.15s cubic-bezier(0.16,1,0.3,1); border: 1px solid transparent; white-space: nowrap; }
        .btn:active { transform: translateY(1px) scale(0.98); }
        .btn-primary { background: #000000; color: #ffffff; border-color: #000000; box-shadow: 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15); }
        .btn-primary:hover { background: #262626; border-color: #262626; box-shadow: 0 3px 8px rgba(0,0,0,0.3); }
        .btn-outline { background: var(--surface); color: var(--text-secondary); border-color: var(--border); box-shadow: var(--shadow-xs); }
        .btn-outline:hover { background: var(--surface-subtle); border-color: var(--border-hover); color: var(--text); }
        .btn-lg { font-size: 14.5px; padding: 12px 24px; border-radius: var(--radius-lg); }
        .eyebrow-badge { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: var(--accent-soft); color: var(--accent-text); border: 1px solid var(--accent-border); padding: 4px 12px; border-radius: 999px; margin-bottom: 24px; }
        .live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #000000; box-shadow: 0 0 0 3px rgba(0,0,0,0.15); animation: pulseDot 2s infinite; flex-shrink: 0; }
        @keyframes pulseDot { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.3); opacity: 1; } }
        .lead { margin: 0 auto 32px; font-size: 18px; line-height: 1.55; color: var(--text-muted); max-width: 620px; }
        .hero-preview { max-width: 920px; margin: 0 auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); overflow: hidden; text-align: left; }
        .preview-bar { background: var(--surface-subtle); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
        .preview-tenant { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; }
        .preview-body { display: grid; grid-template-columns: 1.1fr 1fr; gap: 1px; background: var(--border-subtle); }
        @media (max-width: 768px) { .preview-body { grid-template-columns: 1fr; } }
        .preview-pane { background: var(--surface); padding: 24px; display: flex; flex-direction: column; gap: 14px; }
        .preview-label { font-family: var(--mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 4px; }
        .preview-bubble { padding: 12px 16px; border-radius: var(--radius-lg); font-size: 13.5px; line-height: 1.5; }
        .preview-bubble.caller { background: #000000; color: #ffffff; align-self: flex-end; border-top-right-radius: 4px; }
        .preview-bubble.agent { background: var(--surface-subtle); border: 1px solid var(--border); color: var(--text); align-self: flex-start; border-top-left-radius: 4px; }
        .preview-tool-card { background: var(--surface-subtle); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; }
        .tool-tag { font-family: var(--mono); font-size: 11px; font-weight: 600; background: #f5f5f5; color: #000000; border: 1px solid #e5e5e5; padding: 2px 6px; border-radius: 4px; }
        .strip { padding: 40px 0; border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); background: var(--surface-subtle); }
        .strip-title { text-align: center; font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 20px; }
        .strip-logos { display: flex; align-items: center; justify-content: center; gap: 36px; flex-wrap: wrap; }
        .strip-item { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--text-secondary); }
        .section { padding: 96px 0; }
        .section-head { text-align: center; max-width: 680px; margin: 0 auto 56px; }
        .section-tag { font-family: var(--mono); font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-text); margin-bottom: 10px; }
        .section-head h2 { margin: 0 0 16px; font-size: 34px; font-weight: 700; letter-spacing: -0.025em; color: var(--text); }
        .section-head p { margin: 0; font-size: 16px; color: var(--text-muted); }
        .bento-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
        @media (max-width: 900px) { .bento-grid { grid-template-columns: 1fr; } }
        .bento-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 30px; box-shadow: var(--shadow-xs); transition: all 0.2s ease; display: flex; flex-direction: column; }
        .bento-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .bento-icon { width: 42px; height: 42px; border-radius: var(--radius-md); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent-text); display: grid; place-items: center; margin-bottom: 20px; }
        .bento-card h3 { margin: 0 0 10px; font-size: 18px; font-weight: 600; letter-spacing: -0.015em; color: var(--text); }
        .bento-card p { margin: 0 0 18px; font-size: 14px; color: var(--text-muted); line-height: 1.6; }
        .bento-metric { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-subtle); font-family: var(--mono); font-size: 12.5px; font-weight: 600; color: var(--accent-text); }
        .arch-wrap { background: var(--surface-subtle); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 40px; }
        .arch-steps { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; }
        @media (max-width: 900px) { .arch-steps { grid-template-columns: 1fr; } }
        .arch-step { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-xs); }
        .step-num { font-family: var(--mono); font-size: 11px; font-weight: 700; background: var(--accent-soft); color: var(--accent-text); border: 1px solid var(--accent-border); padding: 2px 7px; border-radius: 4px; display: inline-block; margin-bottom: 12px; }
        .arch-step h4 { margin: 0 0 8px; font-size: 15px; font-weight: 600; color: var(--text); }
        .arch-step p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
        .arch-step code { font-family: var(--mono); font-size: 11px; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
        .featurette { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 48px; box-shadow: var(--shadow-sm); }
        @media (max-width: 900px) { .featurette { grid-template-columns: 1fr; padding: 28px; } }
        .featurette h3 { margin: 0 0 14px; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
        .featurette p { font-size: 15px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
        .feature-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; }
        .feature-item { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text-secondary); }
        .feature-item svg { flex: none; color: var(--accent); margin-top: 3px; }
        .featurette-cta-row { display: flex; gap: 12px; align-items: center; }
        .featurette-btn { flex: 1; padding: 11px 14px; font-size: 13px; font-weight: 600; text-align: center; justify-content: center; white-space: nowrap; border-radius: var(--radius-lg); }
        @media (max-width: 540px) { .featurette-cta-row { flex-direction: column; } .featurette-btn { width: 100%; } }
        .sheet-preview-box { background: var(--surface-subtle); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; }
        .sheet-kpi-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
        .sheet-mini-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; text-align: center; }
        .sheet-mini-val { font-size: 18px; font-weight: 700; color: var(--text); }
        .sheet-mini-lbl { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
        .cta-banner { background: #000000; border: 1px solid #262626; border-radius: var(--radius-xl); padding: 64px 40px; text-align: center; color: #ffffff; box-shadow: var(--shadow-lg); }
        .cta-banner h2 { margin: 0 0 16px; font-size: 36px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff; }
        .cta-banner p { margin: 0 auto 32px; font-size: 17px; max-width: 580px; color: #a3a3a3; line-height: 1.55; }
        .btn-cta-white { background: #ffffff; color: #000000; font-weight: 700; border: 1px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
        .btn-cta-white:hover { background: #f0f0f0; border-color: #f0f0f0; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
        footer { border-top: 1px solid var(--border); padding: 40px 0; background: var(--surface-subtle); }
        .footer-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .footer-copy { font-size: 13px; color: var(--text-muted); }
        .footer-badge { font-family: var(--mono); font-size: 12px; color: var(--text-muted); }
        /* Auth Modal */
        .auth-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: grid; place-items: center; z-index: 1000; padding: 16px; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
        .auth-modal.is-open { opacity: 1; pointer-events: auto; }
        .auth-modal-box { background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-xl); max-width: 480px; width: 100%; padding: 32px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.25); transform: translateY(12px) scale(0.98); transition: transform 0.2s cubic-bezier(0.16,1,0.3,1); max-height: 90vh; overflow-y: auto; }
        .auth-modal.is-open .auth-modal-box { transform: translateY(0) scale(1); }
        .auth-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .auth-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--text); }
        .auth-sub { font-size: 13.5px; color: var(--text-muted); margin: 0; line-height: 1.45; }
        .btn-close-modal { background: transparent; border: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: var(--text-muted); font-size: 20px; line-height: 1; transition: all 0.15s; flex: none; }
        .btn-close-modal:hover { background: var(--surface-card); color: var(--text); }
        .demo-bypass-card { background: #fafafa; border: 1.5px solid #000000; border-radius: var(--radius-lg); padding: 18px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .demo-bypass-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; color: var(--text); }
        .btn-demo-signin { width: 100%; background: #000000; color: #ffffff; border: 1px solid #000000; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; padding: 9px 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; }
        .btn-demo-signin:hover { background: #262626; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.15); }
        .auth-divider { display: flex; align-items: center; text-align: center; margin: 20px 0; color: var(--text-dimmer); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
        .auth-divider::before,.auth-divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--border); }
        .auth-divider span { padding: 0 12px; }
        .auth-tabs { display: flex; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 3px; margin-bottom: 18px; }
        .auth-tab-btn { flex: 1; padding: 8px 12px; border-radius: var(--radius-sm); border: none; background: transparent; font-family: var(--font); font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
        .auth-tab-btn.active { background: #ffffff; color: var(--text); box-shadow: var(--shadow-xs); }
        .auth-form-group { margin-bottom: 14px; }
        .auth-label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 5px; color: var(--text); }
        .auth-input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); font-family: var(--font); font-size: 13.5px; background: #ffffff; color: var(--text); outline: none; transition: all 0.15s; box-sizing: border-box; }
        .auth-input:focus { border-color: #000000; box-shadow: 0 0 0 3px rgba(0,0,0,0.06); }
        .btn-submit-auth { width: 100%; background: #000000; color: #ffffff; border: 1px solid #000000; border-radius: var(--radius-md); font-size: 13.5px; font-weight: 600; padding: 11px 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .btn-submit-auth:hover { background: #262626; }
        /* Surface card var fallback */
        :root { --surface-card: #f5f5f5; --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; --mono: "JetBrains Mono", monospace; }
      `}</style>
    </div>
  );
}
