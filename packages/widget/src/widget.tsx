"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { OmniDeskWidgetProps, CallStatus, TranscriptMessage, VoiceSessionTokenResponse } from "./types";
import { AssemblyAIVoiceClient } from "./audio-client";

export function OmniDeskWidget({
  host,
  businessId = "biz_demo_dental",
  theme = "dark",
  position = "bottom-right",
  label = "Talk to Receptionist",
  accentColor = "#10b981",
  className,
  onCallStart,
  onCallEnd,
  onTranscript,
}: OmniDeskWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const handleStartCall = useCallback(async () => {
    try {
      setCallStatus("connecting");
      setErrorMessage("");
      setTranscripts([]);

      const cleanHost = host.replace(/\/$/, "");
      const res = await fetch(`${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch session token (${res.status})`);
      }

      const data: VoiceSessionTokenResponse = await res.json();
      if (data.business_name) {
        setBusinessName(data.business_name);
      }

      if (!data.token || !data.agent_id) {
        throw new Error("Invalid session token payload received from host");
      }

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
      await client.start(data.token, data.agent_id);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to start call");
      setCallStatus("error");
    }
  }, [host, businessId, onCallStart, onCallEnd, onTranscript]);

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

  const isDark = theme === "dark" || (theme === "auto" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const colors = {
    bg: isDark ? "#09090b" : "#ffffff",
    cardBg: isDark ? "#18181b" : "#f4f4f5",
    border: isDark ? "#27272a" : "#e4e4e7",
    text: isDark ? "#fafafa" : "#09090b",
    textMuted: isDark ? "#a1a1aa" : "#71717a",
    bubbleAgent: isDark ? "#27272a" : "#f4f4f5",
    bubbleUser: accentColor,
    userText: "#ffffff",
  };

  const isLeft = position === "bottom-left";

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        bottom: "24px",
        left: isLeft ? "24px" : "auto",
        right: isLeft ? "auto" : "24px",
        zIndex: 999999,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Floating Trigger Button */}
      {!isOpen && (
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
              background: callStatus === "connected" ? accentColor : "#71717a",
              boxShadow: callStatus === "connected" ? `0 0 10px ${accentColor}` : "none",
            }}
          />
          {label}
        </button>
      )}

      {/* Expanded Modal */}
      {isOpen && (
        <div
          style={{
            width: "360px",
            maxHeight: "560px",
            height: "520px",
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: "20px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: colors.cardBg,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: colors.text }}>
                {businessName}
              </div>
              <div style={{ fontSize: "11px", color: colors.textMuted, display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background:
                      callStatus === "connected"
                        ? accentColor
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

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                padding: "6px",
                borderRadius: "8px",
                fontSize: "16px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Waveform Visualizer */}
          <div
            style={{
              padding: "16px 20px",
              background: colors.bg,
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              height: "64px",
            }}
          >
            {[40, 70, 90, 60, 100, 75, 45, 85, 60, 30].map((h, i) => {
              const active = callStatus === "connected";
              const level = active ? Math.max(userLevel, agentLevel) : 0;
              const barHeight = Math.max(8, Math.min(48, (h * (0.3 + level * 1.5))));
              return (
                <div
                  key={i}
                  style={{
                    width: "4px",
                    height: `${barHeight}px`,
                    borderRadius: "4px",
                    background: active && agentLevel > 0.1 ? accentColor : colors.border,
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
                {callStatus === "connecting"
                  ? "Connecting to AI Receptionist..."
                  : callStatus === "connected"
                  ? "Receptionist is listening. Say hello or ask to book an appointment!"
                  : errorMessage || "Click Start Call to speak with the receptionist."}
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
                      maxWidth: "80%",
                      padding: "9px 13px",
                      borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      background: isUser ? colors.bubbleUser : colors.bubbleAgent,
                      color: isUser ? colors.userText : colors.text,
                      fontSize: "13px",
                      lineHeight: 1.4,
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
                onClick={handleStartCall}
                disabled={callStatus === "connecting"}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: "10px",
                  border: "none",
                  background: accentColor,
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
