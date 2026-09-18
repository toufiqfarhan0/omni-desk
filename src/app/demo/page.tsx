"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { AssemblyAIVoiceClient } from "@/lib/audio";
import { UnderTheHoodPlayground } from "@/components/demo/under-the-hood";

interface TemplateInfo {
  id: string;
  name: string;
  greeting: string;
  agentRole: string;
  chips: { label: string; query: string }[];
}

const TEMPLATES: Record<string, TemplateInfo> = {
  salon: {
    id: "salon-demo",
    name: "OmniDesk Hair Salon & Studio",
    greeting:
      "Thanks for calling OmniDesk Hair Salon & Studio! Are you looking to book a haircut, styling, or coloring session?",
    agentRole: "Hair Salon Voice Receptionist",
    chips: [
      { label: "Signature Haircut ($45)", query: "I want to book a haircut" },
      { label: "Artisan Balayage ($180)", query: "Do you have balayage appointments?" },
      { label: "Check Availability", query: "What times are available this Thursday?" },
    ],
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
  const [showEmailBox, setShowEmailBox] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authAlert, setAuthAlert] = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const [authNotFound, setAuthNotFound] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  const activeTemplate = TEMPLATES[templateKey];

  // Initialize transcript when template changes
  useEffect(() => {
    setMessages([
      {
        id: "initial",
        who: "agent",
        text: activeTemplate.greeting,
      },
    ]);
  }, [templateKey, activeTemplate.greeting]);

  useEffect(() => {
    if (messages.length > 1) {
      transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleReset = () => {
    if (callStatus !== "idle") {
      handleEndCall();
    }
    setMessages([
      {
        id: `initial-${Date.now()}`,
        who: "agent",
        text: activeTemplate.greeting,
      },
    ]);
    setShowEmailBox(false);
    setEmailInput("");
    setEmailFeedback(null);
  };

  const handleQuickQuery = (text: string) => {
    const userMsg: MessageBubble = {
      id: `user-${Date.now()}`,
      who: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      let reply = "";
      if (templateKey === "salon") {
        if (text.toLowerCase().includes("haircut") || text.toLowerCase().includes("balayage")) {
          reply =
            "Great choice! We have slots open this Friday at 10:30 am with Jordan, or 2:00 pm with Taylor. Would either of those times work for you?";
        } else {
          reply =
            "We have availability this Thursday at 9:00 am, 11:30 am, and 2:30 pm. Let me know your preferred time and I'll confirm your booking!";
        }
      } else {
        if (text.toLowerCase().includes("tour") || text.toLowerCase().includes("viewing")) {
          reply =
            "I'd be glad to arrange that property tour! We have viewing slots open this Saturday at 11:00 am and 3:00 pm. Would you like to reserve one?";
        } else {
          reply =
            "Our licensed property specialists are available for private consultations this Friday afternoon. What time suits your schedule best?";
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          who: "agent",
          text: reply,
        },
      ]);
    }, 600);
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
            if (lower.includes("email") || lower.includes("spell your email")) {
              setShowEmailBox(true);
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
  };

  const handleConfirmEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setEmailFeedback(`Email verified: ${emailInput.trim()}`);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        who: "user",
        text: `My email is ${emailInput.trim()}`,
      },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          who: "agent",
          text: `Thank you! I have confirmed your email as ${emailInput.trim()}. I've sent your calendar invite and booking confirmation!`,
        },
      ]);
      setShowEmailBox(false);
    }, 600);
  };

  // Instant demo account
  const handleInstantDemo = () => {
    localStorage.setItem("omnidesk_owner_id", "owner_demo");
    localStorage.setItem("omnidesk_owner_email", "demo@omnidesk.ai");
    localStorage.setItem("omnidesk_owner_name", "OmniDesk Demo Operator");
    localStorage.setItem("omnidesk_selected_biz_id", "biz_demo_dental");
    window.location.href = "/dashboard";
  };


  // Auth form submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthAlert(null);
    setAuthNotFound(false);
    if (!authEmail || !authPassword) {
      setAuthAlert({ msg: "Please provide both email and password.", type: "error" });
      return;
    }
    if (authPassword.length < 6) {
      setAuthAlert({ msg: "Password must be at least 6 characters.", type: "error" });
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await fetch("/api/auth/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
          name: authName || authEmail.split("@")[0],
          mode: authMode,
        }),
      });
      const data = await res.json();
      if (data.ok && data.owner) {
        localStorage.setItem("omnidesk_owner_id", data.owner.id);
        localStorage.setItem("omnidesk_owner_email", data.owner.email);
        localStorage.setItem("omnidesk_owner_name", data.owner.name);
        if (data.businesses && data.businesses.length > 0) {
          localStorage.setItem("omnidesk_selected_biz_id", data.businesses[0].id);
        }
        window.location.href = "/dashboard";
      } else if (data.code === "NOT_FOUND") {
        setAuthNotFound(true);
      } else {
        setAuthAlert({ msg: data.error || "Authentication failed", type: "error" });
      }
    } catch (err: any) {
      setAuthAlert({ msg: err.message || "Authentication error", type: "error" });
    } finally {
      setIsSubmittingAuth(false);
    }
  };


  return (
    <div style={{ background: "#ffffff", color: "#09090b", minHeight: "100vh", fontFamily: "var(--font)" }}>
      {/* ----------------- TOP STICKY HEADER ----------------- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 32px",
          background: "#ffffff",
          borderBottom: "1px solid #e4e4e7",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "#09090b",
          }}
        >
          <div style={{ width: "32px", height: "32px", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <BrandLogo size={32} />
          </div>
          <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.025em" }}>OmniDesk</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={() => {
              setAuthAlert(null);
              setAuthMode("signin");
              setAuthModalOpen(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              background: "#000000",
              color: "#ffffff",
              fontFamily: "var(--font)",
              fontSize: "13px",
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid #000000",
              cursor: "pointer",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" x2="19" y1="8" y2="14" />
              <line x1="22" x2="16" y1="11" y2="11" />
            </svg>
            Sign In / Sign Up
          </button>
        </div>
      </header>

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
          <button
            type="button"
            onClick={() => {
              setAuthAlert(null);
              setAuthMode("signup");
              setAuthModalOpen(true);
            }}
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
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
          >
            Create Voice Agent &rarr;
          </button>
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
              maxWidth: "680px",
              margin: "0 auto",
            }}
          >
            {/* CARD: HAIR SALON */}
            <div
              style={{
                background: "#fafafa",
                border: "2px solid #10b981",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#059669",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                    }}
                  >
                    HAIR SALON &amp; MEDSPA
                  </span>
                  <span style={{ fontSize: "12px", color: "#71717a", fontWeight: 500 }}>
                    45m–120m Appointments
                  </span>
                </div>

                <h3 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 6px", color: "#09090b" }}>
                  Luxe &amp; Mane Hair Studio
                </h3>
                <p style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5, margin: "0 0 18px" }}>
                  High-end salon with live calendar booking for precision haircuts, coloring, and balayage. Experience how visitors schedule treatments directly from the homepage.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", paddingTop: "8px" }}>
                <Link
                  href="/demo/salon"
                  style={{
                    flex: 1,
                    minWidth: "150px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: "#10b981",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "10px 16px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <span>Open Salon Website</span>
                  <span>&rarr;</span>
                </Link>
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
                overflowY: "auto",
                padding: "18px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                background: "#ffffff",
              }}
            >
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

                  {/* If first message, show quick chips */}
                  {idx === 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", marginLeft: "32px" }}>
                      {activeTemplate.chips.map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => handleQuickQuery(chip.query)}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e4e4e7",
                            borderRadius: "100px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "#27272a",
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={transcriptBottomRef} />
            </div>

            {/* Customer Email Confirmation Bar */}
            {showEmailBox && (
              <div style={{ padding: "12px 16px", background: "#fbfbfa", borderTop: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                    Agent Requested Email
                  </span>
                  <span style={{ fontSize: "11px", color: "#71717a" }}>Quick confirmation entry</span>
                </div>
                <form onSubmit={handleConfirmEmail} style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. client@gmail.com"
                    required
                    style={{
                      flex: 1,
                      fontFamily: "var(--font)",
                      fontSize: "13px",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid #e4e4e7",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: "#000000",
                      color: "#ffffff",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Confirm
                  </button>
                </form>
                {emailFeedback && (
                  <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>{emailFeedback}</div>
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

      {/* ----------------- AUTH MODAL ----------------- */}
      {authModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthModalOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: "18px",
              padding: "28px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                  OmniDesk Portal Access
                </h3>
                <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
                  Manage your AI voice receptionist, customize prompts, and inspect live customer call logs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: "22px", color: "#71717a", cursor: "pointer", padding: "0 4px" }}
              >
                &times;
              </button>
            </div>

            {/* 1-Click Demo Account */}
            <div
              style={{
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "12.5px", fontWeight: 600, marginBottom: "8px" }}>
                Don&apos;t want to sign in? Use Demo Account
              </div>
              <button
                type="button"
                onClick={handleInstantDemo}
                style={{
                  width: "100%",
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                Continue with Instant Demo Account &rarr;
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e4e4e7", marginBottom: "20px" }}>
              <button
                type="button"
                onClick={() => { setAuthMode("signin"); setAuthNotFound(false); setAuthAlert(null); }}
                style={{
                  flex: 1,
                  padding: "10px",
                  textAlign: "center",
                  background: "transparent",
                  border: "none",
                  borderBottom: authMode === "signin" ? "2px solid #000000" : "2px solid transparent",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  color: authMode === "signin" ? "#09090b" : "#71717a",
                  cursor: "pointer",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("signup"); setAuthNotFound(false); setAuthAlert(null); }}
                style={{
                  flex: 1,
                  padding: "10px",
                  textAlign: "center",
                  background: "transparent",
                  border: "none",
                  borderBottom: authMode === "signup" ? "2px solid #000000" : "2px solid transparent",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  color: authMode === "signup" ? "#09090b" : "#71717a",
                  cursor: "pointer",
                }}
              >
                Create Account
              </button>
            </div>

            {/* NOT FOUND — contextual prompt */}
            {authNotFound && authMode === "signin" ? (
              <div style={{ background: "#f9fafb", border: "1px solid #e4e4e7", borderRadius: "12px", padding: "20px", textAlign: "center", marginBottom: "4px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#09090b", marginBottom: "4px" }}>No account found</div>
                <div style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5, marginBottom: "16px" }}>
                  <strong style={{ color: "#3f3f46" }}>{authEmail}</strong> isn&apos;t registered yet.
                  <br />Create a free account to get started.
                </div>
                <button
                  type="button"
                  onClick={() => { setAuthMode("signup"); setAuthNotFound(false); }}
                  style={{ width: "100%", padding: "11px", background: "#09090b", color: "#fff", border: "none", borderRadius: "8px", fontFamily: "var(--font)", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Create Account with this Email
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthNotFound(false); setAuthEmail(""); setAuthPassword(""); }}
                  style={{ marginTop: "8px", background: "none", border: "none", fontSize: "12.5px", color: "#a1a1aa", cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Use a different email
                </button>
              </div>
            ) : (
            <>
            {authAlert && (
              <div
                style={{
                  fontSize: "12.5px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  marginBottom: "12px",
                  background: authAlert.type === "error" ? "#fee2e2" : "#dcfce7",
                  color: authAlert.type === "error" ? "#991b1b" : "#166534",
                }}
              >
                {authAlert.msg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === "signup" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Jane Doe"
                    style={{
                      width: "100%",
                      fontFamily: "var(--font)",
                      fontSize: "13.5px",
                      padding: "9px 12px",
                      border: "1px solid #e4e4e7",
                      borderRadius: "10px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="owner@practice.com"
                  required
                  style={{
                    width: "100%",
                    fontFamily: "var(--font)",
                    fontSize: "13.5px",
                    padding: "9px 12px",
                    border: "1px solid #e4e4e7",
                    borderRadius: "10px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    fontFamily: "var(--font)",
                    fontSize: "13.5px",
                    padding: "9px 12px",
                    border: "1px solid #e4e4e7",
                    borderRadius: "10px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                style={{
                  width: "100%",
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  padding: "11px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isSubmittingAuth ? "not-allowed" : "pointer",
                  marginTop: "10px",
                  opacity: isSubmittingAuth ? 0.7 : 1,
                }}
              >
                {isSubmittingAuth
                  ? authMode === "signin"
                    ? "Signing In..."
                    : "Creating Account..."
                  : authMode === "signin"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
