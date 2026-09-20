"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { AssemblyAIVoiceClient } from "@/lib/audio";
import { UnderTheHoodPlayground } from "@/components/demo/under-the-hood";
import { UserNav } from "@/components/user-nav";
import { Navbar } from "@/components/navbar";
import { toast } from "sonner";

interface TemplateInfo {
  id: string;
  name: string;
  greeting: string;
  agentRole: string;
}

const TEMPLATES: Record<string, TemplateInfo> = {
  salon: {
    id: "salon-demo",
    name: "OmniDesk Hair Salon & Studio",
    greeting:
      "Thanks for calling OmniDesk Hair Salon & Studio! Are you looking to book a haircut, styling, or coloring session?",
    agentRole: "Hair Salon Voice Receptionist",
  },
};

interface MessageBubble {
  id: string;
  who: "user" | "agent";
  text: string;
}

export default function DemoPage() {
  const [templateKey] = useState<"salon">("salon");
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [callStatus, setCallStatus] = useState<"idle" | "busy" | "live" | "error">("idle");
  const [callDuration, setCallDuration] = useState("0:00");
  const [isExpanded, setIsExpanded] = useState(false);

  // Email input bar states
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  // Auth modal
  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  const activeTemplate = TEMPLATES[templateKey];

  // Initialize transcript when template changes
  useEffect(() => {
    setMessages([]);
  }, [templateKey]);

  useEffect(() => {
    if (messages.length > 0) {
      transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleReset = () => {
    if (callStatus !== "idle") {
      handleEndCall();
    }
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
    setMessages([]);
  };

  // Timer helpers
  const startTimer = () => {
    timerStartRef.current = Date.now();
    setCallDuration("0:00");
    timerRef.current = setInterval(() => {
      const ms = Date.now() - timerStartRef.current;
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setCallDuration(`${m}:${String(s).padStart(2, "0")}`);
    }, 250);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Voice call toggle
  const handleToggleCall = async () => {
    if (callStatus === "live" || callStatus === "busy") {
      handleEndCall();
    } else {
      await handleStartCall();
    }
  };

  const handleStartCall = async () => {
    try {
      setCallStatus("busy");
      startTimer();

      const res = await fetch("/api/token");
      if (!res.ok) {
        throw new Error("Could not mint session token");
      }
      const data = await res.json();
      const token = data.token;
      const agentId = data.agent_id || "";

      const client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          if (status === "connected") {
            setCallStatus("live");
          } else if (status === "idle") {
            setCallStatus("idle");
            stopTimer();
          } else if (status === "error") {
            setCallStatus("error");
            stopTimer();
          }
        },
        onTranscript: (event) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              who: event.who,
              text: event.text,
            },
          ]);
          if (event.who === "agent") {
            const lower = event.text.toLowerCase();
            const normalized = lower.replace(/[\s\-_]/g, "");
            if (
              normalized.includes("email") ||
              lower.includes("e-mail") ||
              lower.includes("email") ||
              lower.includes("mail address") ||
              lower.includes("your mail") ||
              lower.includes("send your confirmation") ||
              lower.includes("send the confirmation") ||
              lower.includes("calendar invite") ||
              lower.includes("where should i send") ||
              lower.includes("where can i send") ||
              lower.includes("what is your address") ||
              lower.includes("spell your") ||
              lower.includes("provide your") ||
              lower.includes("type your")
            ) {
              setShowEmailBar(true);
            }
          }
        },
        onError: (err) => {
          console.warn("Voice error:", err);
          setCallStatus("error");
          stopTimer();
        },
      });

      voiceClientRef.current = client;
      await client.start(token, agentId);
    } catch (err: any) {
      console.error(err);
      setCallStatus("error");
      stopTimer();
    }
  };

  const handleEndCall = () => {
    if (voiceClientRef.current) {
      voiceClientRef.current.stop();
      voiceClientRef.current = null;
    }
    setCallStatus("idle");
    stopTimer();
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed) return;

    setIsVerifyingEmail(true);
    setEmailError("");
    setEmailSuccess("");

    try {
      const res = await fetch("/api/tools/biz_demo_dental/verify_customer_email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid || !data.email) {
        setEmailError(data.message || "Invalid email or domain has no active mail server.");
        setIsVerifyingEmail(false);
        return;
      }

      const verifiedEmail = data.email;
      setEmailSuccess(`Verified: ${verifiedEmail}. Sent to agent.`);

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          who: "user",
          text: `My email is ${verifiedEmail}`,
        },
      ]);

      if (voiceClientRef.current) {
        voiceClientRef.current.sendEmailInput(verifiedEmail);
      }

      setEmailInput("");
      setTimeout(() => {
        setShowEmailBar(false);
        setEmailSuccess("");
      }, 2500);
    } catch (err: any) {
      setEmailError(err.message || "Failed to verify email with mail server.");
    } finally {
      setIsVerifyingEmail(false);
    }
  };


  return (
    <div style={{ background: "#ffffff", color: "#09090b", minHeight: "100vh", fontFamily: "var(--font)" }}>
      {/* ----------------- TOP STICKY HEADER (REUSABLE COMPONENT) ----------------- */}
      <Navbar activeSection="demo" />

      {/* ----------------- PAGE CONTAINER ----------------- */}
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 24px 60px" }}>
        {/* CREATOR CALLOUT BANNER */}
        <section
          style={{
            background: "#09090b",
            color: "#ffffff",
            borderRadius: "18px",
            padding: "22px 28px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px", letterSpacing: "-0.015em" }}>
              Want to create an AI voice agent that works 24/7 for your business?
            </div>
            <p style={{ fontSize: "13px", color: "#a1a1aa", margin: 0, maxWidth: "680px", lineHeight: 1.5 }}>
              Speaks naturally with callers, checks live practice calendars, and books confirmed slots directly into your database.
            </p>
          </div>
          <Link
            href="/dashboard"
            style={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "#ffffff",
              color: "#09090b",
              fontFamily: "var(--font)",
              fontSize: "13.5px",
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: "10px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
          >
            <span>Explore Demo Dashboard &rarr;</span>
          </Link>
        </section>

        {/* DEMO SHOWCASE CARD (LIVE CLIENT SITE) */}
        <section style={{ marginBottom: "36px" }}>
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#71717a",
              marginBottom: "14px",
            }}
          >
            Live Client Website Showcase (Real-World Embedded Widget)
          </div>

          <div
            style={{
              maxWidth: "840px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: "18px",
            }}
          >
            {/* CARD 1: SCRIPT EMBED (AURA STUDIO) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span
                    style={{
                      background: "#f4f4f5",
                      color: "#09090b",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      border: "1px solid #e4e4e7",
                      letterSpacing: "0.04em",
                    }}
                  >
                    UNIVERSAL &lt;SCRIPT&gt; EMBED
                  </span>
                  <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                    ● Live on Vercel
                  </span>
                </div>

                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px", color: "#09090b" }}>
                  AURA Hair &amp; Beauty Studio
                </h3>
                <p style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Vanilla HTML/JS luxury salon site. Embeds the voice receptionist using a single published CDN script tag without any framework build tools.
                </p>
              </div>

              <div style={{ paddingTop: "8px" }}>
                <a
                  href="https://salon-demo-script.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: "#000000",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "10px 16px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>Visit Script Demo (AURA)</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* CARD 2: REACT NPM PACKAGE (LUMIÈRE STUDIO) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span
                    style={{
                      background: "#f4f4f5",
                      color: "#09090b",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      border: "1px solid #e4e4e7",
                      letterSpacing: "0.04em",
                    }}
                  >
                    REACT &bull; NPM COMPONENT
                  </span>
                  <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                    ● Live on Vercel
                  </span>
                </div>

                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px", color: "#09090b" }}>
                  Lumière Studio
                </h3>
                <p style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Modern React 19 + Vite + TypeScript application installing <code>omnidesk-voice</code> from npm with typed props and direct AssemblyAI streaming.
                </p>
              </div>

              <div style={{ paddingTop: "8px" }}>
                <a
                  href="https://salon-demo-react.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: "#000000",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "10px 16px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>Visit React Demo (Lumière)</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SHOWCASE GRID */}
        <section style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto", maxWidth: "520px" }}>
          {/* Backdrop when expanded to fullscreen */}
          {isExpanded && (
            <div
              onClick={() => setIsExpanded(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                zIndex: 190,
              }}
            />
          )}

          {/* INTERACTIVE VOICE WIDGET CARD */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: "22px",
              boxShadow: isExpanded
                ? "0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                : "0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              height: isExpanded ? "calc(100vh - 56px)" : "640px",
              maxHeight: isExpanded ? "900px" : "640px",
              width: isExpanded ? "calc(100vw - 64px)" : "100%",
              maxWidth: isExpanded ? "1140px" : "520px",
              position: isExpanded ? "fixed" : "relative",
              top: isExpanded ? "50%" : "auto",
              left: isExpanded ? "50%" : "auto",
              transform: isExpanded ? "translate(-50%, -50%)" : "none",
              zIndex: isExpanded ? 200 : "auto",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Widget Topbar */}
            <div
              style={{
                background: "#18181b",
                color: "#ffffff",
                padding: isExpanded ? "16px 24px" : "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div style={{ color: "rgba(255,255,255,0.7)", display: "grid", placeItems: "center" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </div>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "13.5px", fontWeight: 600, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {activeTemplate.name}
                  </h3>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: callStatus === "live" ? "#22c55e" : callStatus === "busy" ? "#eab308" : "rgba(255,255,255,0.4)",
                      }}
                    />
                    <span>
                      {callStatus === "live"
                        ? "Live · Speaking"
                        : callStatus === "busy"
                        ? "Connecting..."
                        : callStatus === "error"
                        ? "Error"
                        : "Idle · Ready"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.85)" }}>
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Exit Fullscreen" : "Open Full"}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "7px",
                    color: "#ffffff",
                    width: "30px",
                    height: "30px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                >
                  {isExpanded ? (
                    /* Minimize / collapse icon (arrows pointing inward) */
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  ) : (
                    /* Maximize / expand icon (arrows pointing outward - matching design) */
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset Conversation"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "7px",
                    color: "#ffffff",
                    width: "30px",
                    height: "30px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Widget Conversation Feed */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "18px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                background: "#ffffff",
              }}
            >
              {/* Placeholder in Gray Background */}
              {messages.length === 0 && (
                <div
                  style={{
                    margin: "auto",
                    textAlign: "center",
                    padding: "10px 18px",
                    background: "#f4f4f5",
                    border: "1px solid #e4e4e7",
                    color: "#52525b",
                    borderRadius: "12px",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    alignSelf: "center",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: callStatus === "live" ? "#22c55e" : "#a1a1aa",
                      display: "inline-block",
                    }}
                  />
                  <span>
                    {callStatus === "live"
                      ? "Connected · Speak to our receptionist"
                      : callStatus === "busy"
                      ? "Connecting to receptionist..."
                      : "Start a call to talk to our receptionist"}
                  </span>
                </div>
              )}

              {messages.map((m, idx) => (
                <div
                  key={m.id || idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    maxWidth: "88%",
                    alignSelf: m.who === "agent" ? "flex-start" : "flex-end",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    {m.who === "agent" && (
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "#18181b",
                          display: "grid",
                          placeItems: "center",
                          color: "#ffffff",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      </div>
                    )}
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: m.who === "agent" ? "14px 14px 14px 2px" : "14px 14px 2px 14px",
                        fontSize: "13.5px",
                        lineHeight: "1.45",
                        background: m.who === "agent" ? "#f4f4f5" : "#18181b",
                        color: m.who === "agent" ? "#09090b" : "#ffffff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={transcriptBottomRef} />
            </div>

            {/* Live email entry bar */}
            {showEmailBar && callStatus === "live" && (
              <div
                style={{
                  padding: "12px 18px",
                  background: "#f0fdf4",
                  borderTop: "1px solid #bbf7d0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#15803d",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
                        boxShadow: "0 0 6px #22c55e",
                      }}
                    />
                    Agent Requesting Email • Verified Mailbox Entry
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEmailBar(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#15803d",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleEmailSubmit} style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="email"
                    autoFocus
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError("");
                    }}
                    placeholder="Enter your real email (e.g. name@gmail.com)"
                    disabled={isVerifyingEmail}
                    required
                    style={{
                      flex: 1,
                      fontFamily: "var(--font)",
                      fontSize: "13px",
                      padding: "9px 13px",
                      borderRadius: "8px",
                      border: emailError ? "1.5px solid #ef4444" : "1px solid #86efac",
                      background: "#ffffff",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isVerifyingEmail || !emailInput.trim()}
                    style={{
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      padding: "9px 18px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: isVerifyingEmail ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                      opacity: isVerifyingEmail ? 0.7 : 1,
                    }}
                  >
                    {isVerifyingEmail ? "Verifying..." : "Verify & Send"}
                  </button>
                </form>

                {emailError && (
                  <div style={{ fontSize: "11.5px", color: "#dc2626", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>⚠️</span> {emailError}
                  </div>
                )}
                {emailSuccess && (
                  <div style={{ fontSize: "11.5px", color: "#15803d", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>✓</span> {emailSuccess}
                  </div>
                )}
              </div>
            )}

            {/* Voice Call Bar */}
            <div
              style={{
                padding: "14px 18px",
                borderTop: "1px solid #e4e4e7",
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleToggleCall}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 18px",
                    background: callStatus === "live" ? "#dc2626" : "#000000",
                    color: "#ffffff",
                    borderRadius: "10px",
                    border: "none",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <span>{callStatus === "live" ? "End Voice Call" : callStatus === "busy" ? "Connecting..." : "Start Voice Call"}</span>
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {callStatus === "live" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "14px" }}>
                    <span style={{ width: "2.5px", height: "12px", background: "#000000", borderRadius: "1px" }} />
                    <span style={{ width: "2.5px", height: "8px", background: "#000000", borderRadius: "1px" }} />
                    <span style={{ width: "2.5px", height: "14px", background: "#000000", borderRadius: "1px" }} />
                    <span style={{ width: "2.5px", height: "6px", background: "#000000", borderRadius: "1px" }} />
                  </div>
                )}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: callStatus === "live" ? "#000000" : "#f4f4f5",
                    color: callStatus === "live" ? "#ffffff" : "#71717a",
                  }}
                >
                  {callDuration}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* HOW EACH INTEGRATION MODE WORKS UNDER THE HOOD (DEVELOPER PLAYGROUND)     */}
        {/* ========================================================================= */}
        <UnderTheHoodPlayground />
      </div>
    </div>
  );
}
