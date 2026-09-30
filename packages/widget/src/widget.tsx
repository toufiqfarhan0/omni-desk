"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { OmniDeskWidgetProps, CallStatus, TranscriptMessage, VoiceSessionTokenResponse } from "./types";
import { AssemblyAIVoiceClient } from "./audio-client";

const ACCENT_MAP: Record<string, string> = {
  emerald: "#10b981",
  green: "#10b981",
  blue: "#2563eb",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#10b981",
};

export function OmniDeskWidget({
  host = "",
  businessId = "biz_demo_dental",
  agentId: propAgentId,
  theme = "light",
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
}: OmniDeskWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [callDuration, setCallDuration] = useState("0:00");
  const [businessName, setBusinessName] = useState(propBusinessName || "OmniDesk Hair Salon & Studio");

  // Email input bar states
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [isThinking, setIsThinking] = useState(false);

  const clientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const emailCapturedRef = useRef<boolean>(false);
  const bookingFinalizedRef = useRef<boolean>(false);
  const awaitingEmailConfirmRef = useRef<boolean>(false);

  const activeAccent = useMemo(() => {
    if (accentColor) return accentColor;
    return ACCENT_MAP[accent] || accent || "#10b981";
  }, [accent, accentColor]);

  const isDark = useMemo(() => {
    if (theme === "dark") return true;
    if (theme === "auto" && typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }, [theme]);

  // Auto-scroll transcript container without scrolling the parent window
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts, isThinking]);

  const resolvedHost = useMemo(() => {
    if (host) return host.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }
    return "";
  }, [host]);

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
      emailCapturedRef.current = false;
      bookingFinalizedRef.current = false;
      awaitingEmailConfirmRef.current = false;
      setShowEmailBar(false);
      startTimer();
      const cleanHost = resolvedHost ? resolvedHost.replace(/\/$/, "") : "";
      const tokenUrl = `${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`;

      const res = await fetch(tokenUrl);
      if (!res.ok) throw new Error("Failed to initialize voice session");
      const data: VoiceSessionTokenResponse = await res.json();

      if (data.business_name && !propBusinessName) {
        setBusinessName(data.business_name);
      }

      if (!data.token) {
        throw new Error("Invalid session token payload received from host");
      }

      const targetAgentId = propAgentId || data.agent_id || "";

      const client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          setCallStatus(status);
          if (status === "connected") {
            callStartTimeRef.current = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            setIsThinking(false);
            stopTimer();
            if (callStartTimeRef.current > 0) {
              const dur = Math.round((Date.now() - callStartTimeRef.current) / 1000);
              callStartTimeRef.current = 0;
              onCallEnd?.(dur);
            }
          } else if (status === "error") {
            setIsThinking(false);
            stopTimer();
          }
        },
        onThinkingChange: (thinking) => {
          if (thinking) setIsThinking(true);
        },
        onTranscript: (msg) => {
          if (msg.who === "user") {
            setIsThinking(true);
          } else if (msg.who === "agent" && msg.text && msg.text.trim().length > 0) {
            setIsThinking(false);
          }
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.who === msg.who && !last.isFinal) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                text: msg.text,
                isFinal: msg.isFinal ?? false,
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: (msg as any).id || `${Date.now()}-${Math.random()}`,
                who: msg.who,
                text: msg.text,
                isFinal: msg.isFinal ?? false,
              },
            ];
          });
          onTranscript?.(msg);
          if (msg.who === "user") {
            const userTextLower = msg.text.toLowerCase();
            // If caller says no, wrong, or requests change to their email
            if (
              userTextLower === "no" ||
              userTextLower.startsWith("no ") ||
              userTextLower.includes("no,") ||
              userTextLower.includes("wrong") ||
              userTextLower.includes("incorrect") ||
              userTextLower.includes("change my email") ||
              userTextLower.includes("different email")
            ) {
              awaitingEmailConfirmRef.current = false;
            }
            // If caller speaks their email or provides it in voice/text
            if (
              msg.text.includes("@") ||
              (userTextLower.includes(" at ") && userTextLower.includes(" dot ")) ||
              userTextLower.includes("gmail.com") ||
              userTextLower.includes("yahoo.com") ||
              userTextLower.includes("outlook.com") ||
              userTextLower.includes("hotmail.com") ||
              userTextLower.includes("icloud.com")
            ) {
              setShowEmailBar(false);
              awaitingEmailConfirmRef.current = true;
            }
          } else if (msg.who === "agent") {
            const lower = msg.text.toLowerCase();

            // Only evaluate email-bar state on the FINAL agent message
            // (not on every streaming delta, which would clear it prematurely)
            if (msg.isFinal) {
              // 1. If booking is finalized, permanently lock and hide bar
              const isBookingFinalized =
                lower.includes("confirmation code is") ||
                lower.includes("booking is confirmed") ||
                lower.includes("scheduled your appointment") ||
                lower.includes("all set, your appointment") ||
                (lower.includes("sent your confirmation") && (lower.includes("code") || lower.includes("calendar invite"))) ||
                (lower.includes("sent a calendar invite") && (lower.includes("code") || lower.includes("all set")));

              if (isBookingFinalized) {
                bookingFinalizedRef.current = true;
                awaitingEmailConfirmRef.current = false;
                setShowEmailBar(false);
                return;
              }

              if (bookingFinalizedRef.current) {
                setShowEmailBar(false);
                return;
              }

              // 2. If agent is asking caller to confirm with yes or no
              const isAskingYesNo =
                lower.includes("confirm with yes or no") ||
                lower.includes("yes or no") ||
                lower.includes("is that correct") ||
                lower.includes("is that right");

              if (isAskingYesNo) {
                awaitingEmailConfirmRef.current = true;
                setShowEmailBar(false);
                return;
              }

              // 3. Strictly show input ONLY when agent is asking for caller's email
              const isAgentAskingEmail =
                lower.includes("what is your email") ||
                lower.includes("what's your email") ||
                lower.includes("may i have your email") ||
                lower.includes("can i have your email") ||
                lower.includes("could i get your email") ||
                lower.includes("could you provide your email") ||
                lower.includes("provide your email") ||
                lower.includes("enter your email") ||
                lower.includes("spell your email") ||
                lower.includes("share your email") ||
                lower.includes("need your email") ||
                lower.includes("what email") ||
                lower.includes("which email") ||
                lower.includes("where can i send your confirmation") ||
                lower.includes("where should i send your confirmation") ||
                lower.includes("where can i send your calendar") ||
                lower.includes("where should i send your calendar") ||
                (lower.includes("email") && (
                  lower.includes("what is") ||
                  lower.includes("what's") ||
                  lower.includes("may i have") ||
                  lower.includes("can i have") ||
                  lower.includes("provide") ||
                  lower.includes("give me") ||
                  lower.includes("tell me") ||
                  lower.includes("send your calendar invite") ||
                  lower.includes("send your confirmation")
                ));

              if (isAgentAskingEmail) {
                awaitingEmailConfirmRef.current = false;
                setShowEmailBar(true);
              } else {
                // Only hide bar if booking not finalized and not awaiting confirm
                if (!bookingFinalizedRef.current && !awaitingEmailConfirmRef.current) {
                  setShowEmailBar(false);
                }
              }
            }
          }
        },
        onAudioLevel: (u, a) => {
          setUserLevel(u);
          setAgentLevel(a);
        },
        onError: () => {
          setCallStatus("error");
          stopTimer();
        },
      });

      clientRef.current = client;
      await client.start(data.token, targetAgentId, data.voice);
    } catch {
      setCallStatus("error");
      stopTimer();
    }
  }, [resolvedHost, businessId, propAgentId, propBusinessName, onCallStart, onCallEnd, onTranscript, startTimer, stopTimer]);

  const handleEndCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    setCallStatus("idle");
    setIsThinking(false);
    setUserLevel(0);
    setAgentLevel(0);
    stopTimer();
    bookingFinalizedRef.current = false;
    awaitingEmailConfirmRef.current = false;
    setShowEmailBar(false);
    if (callStartTimeRef.current > 0) {
      const duration = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      callStartTimeRef.current = 0;
      onCallEnd?.(duration);
    }
  }, [onCallEnd, stopTimer]);

  const handleEmailSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = emailInput.trim();
      if (!trimmed) return;

      // Add user bubble immediately so the message shows right away
      setTranscripts((prev) => [...prev, { who: "user", text: `My email is ${trimmed}`, isFinal: true }]);

      if (clientRef.current) {
        clientRef.current.sendEmailInput(trimmed);
      }
      setIsThinking(true);
      awaitingEmailConfirmRef.current = true;
      setEmailInput("");
      setShowEmailBar(false);
    },
    [emailInput]
  );

  useEffect(() => {
    return () => {
      stopTimer();
      if (clientRef.current) {
        clientRef.current.stop();
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
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
              background: isDark ? "#09090b" : "#ffffff",
              border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
              borderRadius: "20px",
              boxShadow: isExpanded
                ? "0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                : "0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 999999,
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <style>{`
              @keyframes omnidesk-typing-dot {
                0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
                40% { transform: translateY(-6px) scale(1.15); opacity: 1; }
              }
              @keyframes omnidesk-pulse-amber {
                0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45); }
                70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
                100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
              }
              .omnidesk-motion-dot {
                display: inline-block;
                width: 6.5px;
                height: 6.5px;
                border-radius: 50%;
                background-color: currentColor;
                animation: omnidesk-typing-dot 1.25s infinite ease-in-out both;
                will-change: transform, opacity;
              }
              .omnidesk-dot-1 { animation-delay: 0s; }
              .omnidesk-dot-2 { animation-delay: 0.18s; }
              .omnidesk-dot-3 { animation-delay: 0.36s; }
            `}</style>
            {/* Topbar: Matching Live Voice Tester */}
            <div
              style={{
                background: isDark ? "#18181b" : "#ffffff",
                color: isDark ? "#ffffff" : "#09090b",
                borderBottom: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
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
                <div style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#71717a", display: "grid", placeItems: "center", flexShrink: 0 }}>
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
                    background: isDark ? "rgba(255,255,255,0.15)" : (activeAccent === "#18181b" ? "rgba(24,24,27,0.08)" : `${activeAccent}18`),
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    color: isDark ? "#ffffff" : (activeAccent === "#18181b" ? "#09090b" : activeAccent),
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
                      color: isDark ? "#ffffff" : "#09090b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {businessName}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: isDark ? "rgba(255,255,255,0.75)" : "#71717a" }}>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          isCallActive
                            ? isThinking
                              ? "#f59e0b"
                              : "#22c55e"
                            : callStatus === "connecting"
                            ? "#eab308"
                            : isDark
                            ? "rgba(255,255,255,0.4)"
                            : "#a1a1aa",
                        animation: isThinking ? "omnidesk-pulse-amber 1.5s infinite" : "none",
                      }}
                    />
                    <span>
                      {isCallActive
                        ? isThinking
                          ? "Thinking · Checking tools..."
                          : "Live · Speaking"
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
                    background: isDark ? "rgba(255,255,255,0.1)" : "#f4f4f5",
                    border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e4e4e7",
                    borderRadius: "7px",
                    color: isDark ? "#ffffff" : "#52525b",
                    width: "30px",
                    height: "30px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.2)" : "#e4e4e7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "#f4f4f5")}
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
                    background: isDark ? "rgba(255,255,255,0.1)" : "#f4f4f5",
                    border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e4e4e7",
                    borderRadius: "7px",
                    color: isDark ? "#ffffff" : "#52525b",
                    width: "30px",
                    height: "30px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.2)" : "#e4e4e7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "#f4f4f5")}
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
              ref={transcriptContainerRef}
              style={{
                flex: 1,
                minHeight: 0,
                padding: "16px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: isDark ? "#09090b" : "#ffffff",
              }}
            >
              {/* Placeholder in Gray Background */}
              {transcripts.length === 0 && (
                <div
                  style={{
                    margin: "auto",
                    textAlign: "center",
                    padding: "10px 18px",
                    background: isDark ? "#18181b" : "#f4f4f5",
                    border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
                    color: isDark ? "#a1a1aa" : "#52525b",
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
                      background: isCallActive ? "#22c55e" : (callStatus === "connecting" ? "#eab308" : "#a1a1aa"),
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
                          background: isUser ? activeAccent : (isDark ? "#18181b" : "#f4f4f5"),
                          color: isUser ? "#ffffff" : (isDark ? "#fafafa" : "#09090b"),
                          border: !isUser && isDark ? "1px solid #27272a" : "none",
                          boxShadow: isUser ? `0 2px 8px ${activeAccent}35` : "0 1px 2px rgba(0,0,0,0.04)",
                        }}
                      >
                        {t.text}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Animated Thinking Motion Bubble (While tool calling / generating reply) */}
              {isThinking && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    maxWidth: "88%",
                    alignSelf: "flex-start",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
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
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "14px 14px 14px 2px",
                        fontSize: "13px",
                        lineHeight: "1.45",
                        background: isDark ? "#18181b" : "#f4f4f5",
                        color: isDark ? "#a1a1aa" : "#71717a",
                        border: isDark ? "1px solid #27272a" : "none",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        minHeight: "38px",
                      }}
                      title="Agent is thinking and processing..."
                    >
                      <span className="omnidesk-motion-dot omnidesk-dot-1" />
                      <span className="omnidesk-motion-dot omnidesk-dot-2" />
                      <span className="omnidesk-motion-dot omnidesk-dot-3" />
                    </div>
                  </div>
                </div>
              )}

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
                    Email Requested by Agent
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
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter your email (e.g. name@gmail.com)"
                    required
                    style={{
                      flex: 1,
                      fontSize: "12.5px",
                      padding: "7px 11px",
                      borderRadius: "7px",
                      border: "1px solid #86efac",
                      background: "#ffffff",
                      color: "#09090b",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!emailInput.trim()}
                    style={{
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: emailInput.trim() ? "pointer" : "not-allowed",
                      opacity: emailInput.trim() ? 1 : 0.6,
                    }}
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* Bottom Call Bar (Matching Live Voice Tester) */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
                background: isDark ? "#121214" : "#fafafa",
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
                  background: isCallActive
                    ? "#dc2626"
                    : callStatus === "connecting"
                    ? "#64748b"
                    : activeAccent,
                  color: "#ffffff",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  boxShadow: isCallActive
                    ? "0 4px 14px rgba(220, 38, 38, 0.35)"
                    : `0 4px 14px ${activeAccent}40`,
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
                          background: activeAccent,
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
                    background: isDark ? "#18181b" : (isCallActive ? "#000000" : "#f4f4f5"),
                    color: isDark ? "#ffffff" : (isCallActive ? "#ffffff" : "#71717a"),
                    border: isDark ? "1px solid #27272a" : "none",
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

export const VoiceWidget = OmniDeskWidget;
