"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { AssemblyAIVoiceClient } from "@/lib/audio";
import { toast } from "sonner";

export interface VoiceWidgetProps {
  /**
   * Base host URL (e.g. "https://omni-desk-rho.vercel.app" or empty for relative).
   */
  host?: string;
  /**
   * Target business ID configured in OmniDesk.
   */
  businessId?: string;
  /**
   * Optional AssemblyAI Agent ID override.
   */
  agentId?: string;
  /**
   * Visual theme ("dark" | "light" | "auto"). Default is "dark".
   */
  theme?: "dark" | "light" | "auto" | string;
  /**
   * Screen anchor position ("bottom-right" | "bottom-left"). Default is "bottom-right".
   */
  position?: "bottom-right" | "bottom-left" | string;
  /**
   * Label text on the floating launcher pill button. Default is "Talk to Receptionist".
   */
  label?: string;
  /**
   * Theme accent color name ("emerald" | "blue" | "purple" | "amber" | "rose" | "slate") or hex string.
   */
  accent?: string;
  /**
   * Custom hex accent color (alias for accent).
   */
  accentColor?: string;
  /**
   * Custom business title shown in the widget topbar.
   */
  businessName?: string;
  /**
   * Initial greeting bubble message shown when opening widget.
   */
  greeting?: string;
  /**
   * Optional extra container class name.
   */
  className?: string;
  /**
   * Fired when voice call connects.
   */
  onCallStart?: () => void;
  /**
   * Fired when voice call terminates.
   */
  onCallEnd?: (durationSeconds: number) => void;
  /**
   * Fired on each live transcript event.
   */
  onTranscript?: (msg: { who: "user" | "agent"; text: string }) => void;
}

const ACCENT_MAP: Record<string, string> = {
  emerald: "#10b981",
  green: "#10b981",
  blue: "#2563eb",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#10b981",
};

export function VoiceWidget({
  host = "",
  businessId = "biz_demo_dental",
  agentId: propAgentId,
  theme = "dark",
  position = "bottom-right",
  label = "Talk to Receptionist",
  accent = "emerald",
  accentColor,
  businessName: propBusinessName,
  greeting: propGreeting,
  className,
  onCallStart,
  onCallEnd,
  onTranscript,
}: VoiceWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [transcripts, setTranscripts] = useState<Array<{ who: "user" | "agent"; text: string }>>([]);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [callDuration, setCallDuration] = useState("0:00");
  const [businessName, setBusinessName] = useState(propBusinessName || "OmniDesk Hair Salon & Studio");

  // Email input bar states
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);

  const activeAccent = useMemo(() => {
    if (accentColor) return accentColor;
    return ACCENT_MAP[accent] || accent || "#10b981";
  }, [accent, accentColor]);

  const isDark = useMemo(() => {
    if (theme === "light") return false;
    if (theme === "auto" && typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  }, [theme]);

  // Auto-scroll transcript container
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now();
    setCallDuration("0:00");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const ms = Date.now() - timerStartRef.current;
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setCallDuration(`${m}:${String(s).padStart(2, "0")}`);
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStartCall = useCallback(async () => {
    try {
      setCallStatus("connecting");
      startTimer();
      const cleanHost = host ? host.replace(/\/$/, "") : "";
      const tokenUrl = `${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`;

      const res = await fetch(tokenUrl);
      if (!res.ok) throw new Error("Failed to initialize voice session");
      const data = await res.json();

      if (data.business_name && !propBusinessName) {
        setBusinessName(data.business_name);
      }

      const client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          setCallStatus(status);
          if (status === "connected") {
            callStartTimeRef.current = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            stopTimer();
            if (callStartTimeRef.current > 0) {
              const dur = Math.round((Date.now() - callStartTimeRef.current) / 1000);
              callStartTimeRef.current = 0;
              onCallEnd?.(dur);
            }
          }
        },
        onTranscript: (ev) => {
          setTranscripts((prev) => [...prev, { who: ev.who, text: ev.text }]);
          onTranscript?.(ev);
          if (ev.who === "agent") {
            const lower = ev.text.toLowerCase();
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
        onAudioLevel: (u, a) => {
          setUserLevel(u);
          setAgentLevel(a);
        },
        onError: (err) => {
          toast.error(err);
          setCallStatus("error");
          stopTimer();
        },
      });

      voiceClientRef.current = client;
      await client.start(data.token, propAgentId || data.agent_id);
    } catch (err: any) {
      toast.error(err.message || "Failed to start call");
      setCallStatus("error");
      stopTimer();
    }
  }, [host, businessId, propAgentId, propBusinessName, onCallStart, onCallEnd, onTranscript, startTimer, stopTimer]);

  const handleEndCall = useCallback(() => {
    if (voiceClientRef.current) {
      voiceClientRef.current.stop();
      voiceClientRef.current = null;
    }
    setCallStatus("idle");
    setUserLevel(0);
    setAgentLevel(0);
    stopTimer();
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
    if (callStartTimeRef.current > 0) {
      const dur = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      callStartTimeRef.current = 0;
      onCallEnd?.(dur);
    }
  }, [onCallEnd, stopTimer]);

  const handleReset = useCallback(() => {
    if (callStatus === "connected" || callStatus === "connecting") {
      handleEndCall();
    }
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
    setTranscripts([]);
  }, [callStatus, handleEndCall]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = emailInput.trim();
      if (!trimmed) return;

      setIsVerifyingEmail(true);
      setEmailError("");
      setEmailSuccess("");

      try {
        const cleanHost = host ? host.replace(/\/$/, "") : "";
        const res = await fetch(`${cleanHost}/api/tools/${encodeURIComponent(businessId)}/verify_customer_email`, {
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

        setTranscripts((prev) => [...prev, { who: "user", text: `My email is ${verifiedEmail}` }]);

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
    },
    [emailInput, host, businessId]
  );

  useEffect(() => {
    return () => {
      stopTimer();
      if (voiceClientRef.current) {
        voiceClientRef.current.stop();
      }
    };
  }, [stopTimer]);

  const isLeft = position === "bottom-left";
  const isCallActive = callStatus === "connected";

  return (
    <div className={className} style={{ position: "relative", zIndex: 99999 }}>
      {/* FLOATING TRIGGER PILL */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: isLeft ? "20px" : "auto",
          right: isLeft ? "auto" : "20px",
          zIndex: 99999,
          fontFamily: "var(--font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            background: isDark ? "#18181b" : "#ffffff",
            color: isDark ? "#fafafa" : "#09090b",
            border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
            padding: "10px 18px",
            borderRadius: "9999px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            transition: "transform 0.15s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: isCallActive ? "#ef4444" : activeAccent,
              boxShadow: `0 0 8px ${isCallActive ? "#ef4444" : activeAccent}`,
            }}
          />
          <span>{label}</span>
          <span style={{ fontSize: "11px", opacity: 0.6 }}>{isOpen ? "▲" : "▲"}</span>
        </button>
      </div>

      {/* EXPANDED MODAL WINDOW (Matching User Reference Image) */}
      {isOpen && (
        <>
          {isExpanded && (
            <div
              onClick={() => setIsExpanded(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                zIndex: 999998,
              }}
            />
          )}

          <div
            style={{
              position: "fixed",
              bottom: isExpanded ? "auto" : "80px",
              left: isExpanded ? "50%" : isLeft ? "20px" : "auto",
              right: isExpanded ? "auto" : isLeft ? "auto" : "20px",
              top: isExpanded ? "50%" : "auto",
              transform: isExpanded ? "translate(-50%, -50%)" : "none",
              width: isExpanded ? "calc(100vw - 40px)" : "390px",
              maxWidth: isExpanded ? "1140px" : "calc(100vw - 32px)",
              height: isExpanded ? "calc(100vh - 40px)" : "560px",
              maxHeight: isExpanded ? "900px" : "calc(100vh - 100px)",
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: "20px",
              boxShadow: isExpanded
                ? "0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                : "0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 999999,
              fontFamily: "var(--font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Topbar: Dark Background with 3-dots, mic circle, title, status, expand and close */}
            <div
              style={{
                background: "#18181b",
                color: "#ffffff",
                padding: isExpanded ? "16px 22px" : "13px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                {/* 3 vertical dots icon */}
                <div style={{ color: "rgba(255,255,255,0.6)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </div>

                {/* Circular mic icon badge */}
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    color: "#ffffff",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>

                {/* Title & Status Subtitle */}
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: "#ffffff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {businessName}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: isCallActive ? "#22c55e" : callStatus === "connecting" ? "#eab308" : "rgba(255,255,255,0.4)",
                      }}
                    />
                    <span>
                      {isCallActive
                        ? "Live · Speaking"
                        : callStatus === "connecting"
                        ? "Connecting..."
                        : callStatus === "error"
                        ? "Error"
                        : "Idle · Ready"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right controls: Fullscreen & Close */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  ) : (
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
                  onClick={() => {
                    if (isCallActive) handleEndCall();
                    setIsOpen(false);
                  }}
                  title="Close Widget"
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

            {/* Conversation container — Crisp White Background */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: "16px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: "#ffffff",
              }}
            >
              {/* Placeholder in Gray Background */}
              {transcripts.length === 0 && (
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
                      background: isCallActive ? "#22c55e" : "#a1a1aa",
                      display: "inline-block",
                    }}
                  />
                  <span>
                    {isCallActive
                      ? "Connected · Speak to our receptionist"
                      : callStatus === "connecting"
                      ? "Connecting to receptionist..."
                      : "Start a call to talk to our receptionist"}
                  </span>
                </div>
              )}

              {/* Live streaming bubbles */}
              {transcripts.map((t, idx) => {
                const isUser = t.who === "user";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      maxWidth: "88%",
                      alignSelf: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      {!isUser && (
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
                          borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          fontSize: "13px",
                          lineHeight: "1.45",
                          background: isUser ? "#18181b" : "#f4f4f5",
                          color: isUser ? "#ffffff" : "#09090b",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        }}
                      >
                        {t.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Live email entry bar */}
            {showEmailBar && isCallActive && (
              <div
                style={{
                  padding: "11px 16px",
                  background: "#f0fdf4",
                  borderTop: "1px solid #bbf7d0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
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
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
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
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "1px 4px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleEmailSubmit} style={{ display: "flex", gap: "6px" }}>
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
                      fontSize: "12.5px",
                      padding: "7px 11px",
                      borderRadius: "7px",
                      border: emailError ? "1.5px solid #ef4444" : "1px solid #86efac",
                      background: "#ffffff",
                      color: "#09090b",
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
                      padding: "7px 14px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: isVerifyingEmail ? "wait" : "pointer",
                      opacity: isVerifyingEmail ? 0.7 : 1,
                    }}
                  >
                    {isVerifyingEmail ? "..." : "Verify & Send"}
                  </button>
                </form>

                {emailError && (
                  <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                    ⚠️ {emailError}
                  </div>
                )}
                {emailSuccess && (
                  <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 600 }}>
                    ✓ {emailSuccess}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Call Bar (Matching Reference Image) */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #e4e4e7",
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              {/* Start Voice Call Button on Left */}
              <button
                type="button"
                onClick={isCallActive ? handleEndCall : handleStartCall}
                disabled={callStatus === "connecting"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  background: isCallActive ? "#dc2626" : "#000000",
                  color: "#ffffff",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: callStatus === "connecting" ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                <span>
                  {isCallActive ? "End Voice Call" : callStatus === "connecting" ? "Connecting..." : "Start Voice Call"}
                </span>
              </button>

              {/* Right: Waveform visualizer bars when live + Duration badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {isCallActive && (
                  <div style={{ display: "flex", alignItems: "center", gap: "2.5px", height: "14px" }}>
                    {[12, 8, 14, 6, 10].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: "2.5px",
                          height: `${Math.max(4, Math.min(14, Math.round(h * (0.35 + Math.max(userLevel, agentLevel) * 1.5))))}px`,
                          background: "#000000",
                          borderRadius: "1px",
                          transition: "height 0.12s ease",
                        }}
                      />
                    ))}
                  </div>
                )}
                <span
                  style={{
                    fontFamily: "var(--mono, monospace)",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: isCallActive ? "#000000" : "#f4f4f5",
                    color: isCallActive ? "#ffffff" : "#71717a",
                  }}
                >
                  {callDuration}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Re-export OmniDeskWidget as alias for VoiceWidget
export const OmniDeskWidget = VoiceWidget;
