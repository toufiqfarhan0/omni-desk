"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { OmniDeskWidgetProps, CallStatus, TranscriptMessage, VoiceSessionTokenResponse } from "./types";
import { AssemblyAIVoiceClient } from "./audio-client";

const ACCENT_MAP: Record<string, string> = {
  slate: "#18181b",
  purple: "#7c3aed",
  blue: "#2563eb",
  emerald: "#059669",
};

export function OmniDeskWidget({
  host,
  businessId = "biz_demo_dental",
  agentId: propAgentId,
  theme = "dark",
  position = "bottom-right",
  label = "Talk to Receptionist",
  accent = "slate",
  accentColor,
  suggestions,
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
  const [isMuted, setIsMuted] = useState(false);
  const [businessName, setBusinessName] = useState("AI Voice Receptionist");
  const [errorMessage, setErrorMessage] = useState("");

  const clientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const callStartTimeRef = useRef<number>(0);

  const activeAccent = useMemo(() => {
    if (accentColor) return accentColor;
    return ACCENT_MAP[accent] || accent || "#18181b";
  }, [accent, accentColor]);

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const resolvedHost = useMemo(() => {
    if (host) return host.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }
    return "";
  }, [host]);

  const handleStartCall = useCallback(async () => {
    try {
      setCallStatus("connecting");
      setErrorMessage("");
      setTranscripts([]);

      const tokenUrl = resolvedHost
        ? `${resolvedHost}/api/token?businessId=${encodeURIComponent(businessId)}`
        : `/api/token?businessId=${encodeURIComponent(businessId)}`;

      const res = await fetch(tokenUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch session token (${res.status})`);
      }

      const data: VoiceSessionTokenResponse = await res.json();
      if (data.business_name) {
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
          } else if (status === "idle" && callStartTimeRef.current > 0) {
            const duration = Math.round((Date.now() - callStartTimeRef.current) / 1000);
            callStartTimeRef.current = 0;
            onCallEnd?.(duration);
          }
        },
        onTranscript: (msg) => {
          setTranscripts((prev) => [...prev, msg]);
          onTranscript?.(msg);
        },
        onAudioLevel: (u, a) => {
          setUserLevel(u);
          setAgentLevel(a);
        },
        onError: (err) => {
          setErrorMessage(err);
          setCallStatus("error");
        },
      });

      clientRef.current = client;
      await client.start(data.token, targetAgentId);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to start call");
      setCallStatus("error");
    }
  }, [resolvedHost, businessId, propAgentId, onCallStart, onCallEnd, onTranscript]);

  const handleEndCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    setCallStatus("idle");
    setIsMuted(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (clientRef.current) {
      const next = !isMuted;
      clientRef.current.setMuted(next);
      setIsMuted(next);
    }
  }, [isMuted]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stop();
      }
    };
  }, []);

  const isDark =
    theme === "dark" ||
    (theme === "auto" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const colors = {
    bg: isDark ? "#09090b" : "#ffffff",
    cardBg: isDark ? "#121215" : "#f4f4f5",
    border: isDark ? "#27272a" : "#e4e4e7",
    text: isDark ? "#fafafa" : "#09090b",
    textMuted: isDark ? "#a1a1aa" : "#71717a",
    bubbleAgent: isDark ? "#18181b" : "#f4f4f5",
    bubbleUser: activeAccent,
    userText: "#ffffff",
  };

  const isLeft = position === "bottom-left";

  const defaultSuggestions = suggestions || [
    "Check availability",
    "Book consultation",
    "Pricing & services",
  ];

  return (
    <div className={className}>
      {/* Expanded Modal Backdrop when in expanded mode */}
      {isOpen && isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 999998,
            transition: "all 0.25s ease",
          }}
        />
      )}

      {/* Floating Trigger Button */}
      {!isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: isLeft ? "24px" : "auto",
            right: isLeft ? "auto" : "24px",
            zIndex: 999999,
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <button
            onClick={() => {
              setIsOpen(true);
              if (callStatus === "idle") {
                handleStartCall();
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 20px",
              borderRadius: "9999px",
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background:
                  callStatus === "connected"
                    ? activeAccent
                    : callStatus === "connecting"
                    ? "#f59e0b"
                    : "#71717a",
                boxShadow:
                  callStatus === "connected"
                    ? `0 0 10px ${activeAccent}`
                    : "none",
              }}
            />
            {label}
          </button>
        </div>
      )}

      {/* Main Widget Container (Floating or Centered Expanded) */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            ...(isExpanded
              ? {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "min(640px, 92vw)",
                  height: "min(720px, 86vh)",
                  maxHeight: "800px",
                }
              : {
                  bottom: "24px",
                  left: isLeft ? "24px" : "auto",
                  right: isLeft ? "auto" : "24px",
                  width: "370px",
                  height: "560px",
                  maxHeight: "85vh",
                }),
            zIndex: 999999,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: isExpanded ? "24px" : "20px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: colors.cardBg,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: activeAccent,
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: colors.text }}>
                  {businessName}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: colors.textMuted,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "2px",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background:
                        callStatus === "connected"
                          ? "#10b981"
                          : callStatus === "connecting"
                          ? "#f59e0b"
                          : "#71717a",
                    }}
                  />
                  {callStatus === "connected"
                    ? "Live Receptionist"
                    : callStatus === "connecting"
                    ? "Connecting..."
                    : "Call Ended"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {/* Expand Toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  fontSize: "15px",
                  display: "grid",
                  placeItems: "center",
                }}
                title={isExpanded ? "Collapse modal" : "Expand fullscreen"}
              >
                {isExpanded ? "↙" : "⤢"}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsExpanded(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  fontSize: "15px",
                  display: "grid",
                  placeItems: "center",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Waveform Visualizer */}
          <div
            style={{
              padding: "12px 18px",
              background: colors.bg,
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              height: "56px",
            }}
          >
            {[35, 65, 85, 55, 95, 70, 45, 80, 55, 30, 60, 40].map((h, i) => {
              const active = callStatus === "connected";
              const level = active ? Math.max(userLevel, agentLevel) : 0;
              const barHeight = Math.max(6, Math.min(42, h * (0.25 + level * 1.6)));
              return (
                <div
                  key={i}
                  style={{
                    width: "4px",
                    height: `${barHeight}px`,
                    borderRadius: "4px",
                    background:
                      active && agentLevel > 0.08 ? activeAccent : colors.border,
                    transition: "height 0.1s ease, background 0.2s ease",
                  }}
                />
              );
            })}
          </div>

          {/* Transcript Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {transcripts.length === 0 && (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  color: colors.textMuted,
                  fontSize: "13px",
                  lineHeight: 1.5,
                  padding: "0 20px",
                }}
              >
                {callStatus === "connecting" ? (
                  "Connecting to AI Receptionist..."
                ) : callStatus === "connected" ? (
                  "Receptionist is listening. Say hello or ask to book an appointment!"
                ) : errorMessage ? (
                  <span style={{ color: "#ef4444" }}>{errorMessage}</span>
                ) : (
                  "Click Start Call to speak with the autonomous receptionist."
                )}
              </div>
            )}

            {transcripts.map((msg, idx) => {
              const isUser = msg.who === "user";
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: isExpanded ? "70%" : "82%",
                      padding: "9px 13px",
                      borderRadius: isUser
                        ? "14px 14px 2px 14px"
                        : "14px 14px 14px 2px",
                      background: isUser ? colors.bubbleUser : colors.bubbleAgent,
                      color: isUser ? colors.userText : colors.text,
                      fontSize: "13px",
                      lineHeight: 1.45,
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>

          {/* Suggestion Chips */}
          {defaultSuggestions.length > 0 && callStatus === "connected" && (
            <div
              style={{
                padding: "8px 16px",
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                borderTop: `1px solid ${colors.border}`,
                background: colors.cardBg,
              }}
            >
              {defaultSuggestions.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: "11.5px",
                    padding: "4px 10px",
                    borderRadius: "9999px",
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    whiteSpace: "nowrap",
                    cursor: "default",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}

          {/* Bottom Call Controls */}
          <div
            style={{
              padding: "14px 16px",
              borderTop: `1px solid ${colors.border}`,
              background: colors.cardBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            {callStatus === "connected" ? (
              <>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: `1px solid ${colors.border}`,
                    background: isMuted ? "#ef4444" : colors.bg,
                    color: isMuted ? "#ffffff" : colors.text,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isMuted ? "Unmute Mic" : "Mute Mic"}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  End Call
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartCall}
                disabled={callStatus === "connecting"}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeAccent,
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: callStatus === "connecting" ? "not-allowed" : "pointer",
                  opacity: callStatus === "connecting" ? 0.7 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                {callStatus === "connecting" ? "Connecting..." : "Start Call"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const VoiceWidget = OmniDeskWidget;
