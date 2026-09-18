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
  slate: "#10b981", // default clean vibrant emerald
};

const FREQ_BARS = [8, 14, 18, 11, 16, 20, 12, 6, 15];

export function OmniDeskWidget({
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
}: OmniDeskWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [businessName, setBusinessName] = useState(propBusinessName || "OmniDesk AI Receptionist");

  const clientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const callStartTimeRef = useRef<number>(0);

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

  const defaultGreeting = useMemo(() => {
    if (propGreeting) return propGreeting;
    if (businessId === "biz_demo_dental" && label.toLowerCase().includes("appointment")) {
      return "Hello! Welcome to Luxe & Mane Hair Studio. Would you like to check availability or book an appointment?";
    }
    return "Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?";
  }, [propGreeting, businessId, label]);

  // Auto-scroll transcript container
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
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
      setTranscripts([]);

      const tokenUrl = resolvedHost
        ? `${resolvedHost}/api/token?businessId=${encodeURIComponent(businessId)}`
        : `/api/token?businessId=${encodeURIComponent(businessId)}`;

      const res = await fetch(tokenUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch session token (${res.status})`);
      }

      const data: VoiceSessionTokenResponse = await res.json();
      if (data.business_name && !propBusinessName) {
        setBusinessName(`${data.business_name} AI Receptionist`);
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
          setCallStatus("error");
        },
      });

      clientRef.current = client;
      await client.start(data.token, targetAgentId);
    } catch (err: any) {
      setCallStatus("error");
    }
  }, [resolvedHost, businessId, propAgentId, propBusinessName, onCallStart, onCallEnd, onTranscript]);

  const handleEndCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    setCallStatus("idle");
    setUserLevel(0);
    setAgentLevel(0);
    if (callStartTimeRef.current > 0) {
      const duration = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      callStartTimeRef.current = 0;
      onCallEnd?.(duration);
    }
  }, [onCallEnd]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stop();
      }
    };
  }, []);

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
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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

      {/* EXPANDED MODAL PREVIEW (Image 1 Style) */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "70px",
            left: isLeft ? "20px" : "auto",
            right: isLeft ? "auto" : "20px",
            width: "320px",
            height: "280px",
            background: isDark ? "#18181b" : "#ffffff",
            border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
            borderRadius: "18px",
            boxShadow: "0 20px 30px -10px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 99999,
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: isDark ? "#09090b" : "#f4f4f5",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: isDark ? "#fafafa" : "#09090b",
                }}
              >
                {businessName}
              </div>
              <div style={{ fontSize: "10.5px", color: activeAccent, fontWeight: 600 }}>
                {isCallActive
                  ? "Live Voice Call (24kHz)"
                  : callStatus === "connecting"
                  ? "Connecting..."
                  : "Ready to connect"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#71717a",
                cursor: "pointer",
                padding: "4px",
                display: "grid",
                placeItems: "center",
              }}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Transcripts container */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* Initial Greeting Bubble */}
            <div
              style={{
                alignSelf: "flex-start",
                background: isDark ? "#27272a" : "#f4f4f5",
                color: isDark ? "#f4f4f5" : "#09090b",
                padding: "8px 12px",
                borderRadius: "12px",
                fontSize: "12px",
                maxWidth: "85%",
                lineHeight: 1.4,
              }}
            >
              {defaultGreeting}
            </div>

            {/* Live Streaming Messages */}
            {transcripts.map((t, idx) => {
              const isUser = t.who === "user";
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    background: isUser ? activeAccent : isDark ? "#27272a" : "#f4f4f5",
                    color: isUser ? "#ffffff" : isDark ? "#f4f4f5" : "#09090b",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    maxWidth: "85%",
                    lineHeight: 1.4,
                  }}
                >
                  {t.text}
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>

          {/* Footer / Visualizer dots & Start/End Call button */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Waveform visualizer dots/bars */}
            <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "18px" }}>
              {FREQ_BARS.map((h, i) => {
                const currentLevel = Math.max(userLevel, agentLevel);
                const activeHeight = isCallActive
                  ? Math.max(5, Math.min(18, Math.round(h * (0.35 + currentLevel * 1.5))))
                  : 4;

                return (
                  <div
                    key={i}
                    style={{
                      width: "3px",
                      height: `${activeHeight}px`,
                      borderRadius: "2px",
                      background: isCallActive ? (agentLevel > 0.05 ? activeAccent : "#3b82f6") : activeAccent,
                      opacity: isCallActive ? 1 : 0.7,
                      transition: "height 0.15s ease",
                    }}
                  />
                );
              })}
            </div>

            {/* Start / End Call Button */}
            <button
              type="button"
              onClick={isCallActive ? handleEndCall : handleStartCall}
              disabled={callStatus === "connecting"}
              style={{
                background: isCallActive ? "#ef4444" : activeAccent,
                color: "#ffffff",
                border: "none",
                padding: "7px 16px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: callStatus === "connecting" ? "not-allowed" : "pointer",
                opacity: callStatus === "connecting" ? 0.7 : 1,
                boxShadow: `0 2px 8px ${isCallActive ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                transition: "all 0.15s ease",
              }}
            >
              {isCallActive ? "End Call" : callStatus === "connecting" ? "Connecting..." : "Start Call"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const VoiceWidget = OmniDeskWidget;
