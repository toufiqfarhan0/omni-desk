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
  slate: "#10b981", // default vibrant accent
};

const FREQ_BARS = [8, 14, 18, 11, 16, 20, 12, 6, 15];

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
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [transcripts, setTranscripts] = useState<Array<{ who: "user" | "agent"; text: string }>>([]);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [businessName, setBusinessName] = useState(propBusinessName || "OmniDesk AI Receptionist");

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
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

  const handleStartCall = useCallback(async () => {
    try {
      setCallStatus("connecting");
      const cleanHost = host ? host.replace(/\/$/, "") : "";
      const tokenUrl = `${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`;

      const res = await fetch(tokenUrl);
      if (!res.ok) throw new Error("Failed to initialize voice session");
      const data = await res.json();

      if (data.business_name && !propBusinessName) {
        setBusinessName(`${data.business_name} AI Receptionist`);
      }

      const client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          setCallStatus(status);
          if (status === "connected") {
            callStartTimeRef.current = Date.now();
            onCallStart?.();
          } else if (status === "idle" && callStartTimeRef.current > 0) {
            const dur = Math.round((Date.now() - callStartTimeRef.current) / 1000);
            callStartTimeRef.current = 0;
            onCallEnd?.(dur);
          }
        },
        onTranscript: (ev) => {
          setTranscripts((prev) => [...prev, { who: ev.who, text: ev.text }]);
          onTranscript?.(ev);
        },
        onAudioLevel: (u, a) => {
          setUserLevel(u);
          setAgentLevel(a);
        },
        onError: (err) => {
          toast.error(err);
          setCallStatus("error");
        },
      });

      voiceClientRef.current = client;
      await client.start(data.token, propAgentId || data.agent_id);
    } catch (err: any) {
      toast.error(err.message || "Failed to start call");
      setCallStatus("error");
    }
  }, [host, businessId, propAgentId, propBusinessName, onCallStart, onCallEnd, onTranscript]);

  const handleEndCall = useCallback(() => {
    if (voiceClientRef.current) {
      voiceClientRef.current.stop();
      voiceClientRef.current = null;
    }
    setCallStatus("idle");
    setUserLevel(0);
    setAgentLevel(0);
    if (callStartTimeRef.current > 0) {
      const dur = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      callStartTimeRef.current = 0;
      onCallEnd?.(dur);
    }
  }, [onCallEnd]);

  useEffect(() => {
    return () => {
      if (voiceClientRef.current) {
        voiceClientRef.current.stop();
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

      {/* EXPANDED MODAL WINDOW (Matching Under-The-Hood Image 1) */}
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

          {/* Transcripts / Conversation container */}
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

            {/* Live streaming bubbles */}
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

            {/* Action Call Button */}
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

// Re-export OmniDeskWidget as alias for VoiceWidget
export const OmniDeskWidget = VoiceWidget;
