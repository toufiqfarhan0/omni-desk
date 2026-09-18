"use client";

import { useState, useRef, useEffect } from "react";
import { Business } from "@/lib/db";
import { AssemblyAIVoiceClient } from "@/lib/audio";
import { toast } from "sonner";

interface VoiceTesterProps {
  business: Business;
}

interface SimMessage {
  id: string;
  who: "user" | "agent";
  text: string;
}

const ACCENT_COLORS = [
  { hex: "#18181b", label: "Black" },
  { hex: "#7c3aed", label: "Purple" },
  { hex: "#2563eb", label: "Blue" },
  { hex: "#059669", label: "Emerald" },
];

export function VoiceTester({ business }: VoiceTesterProps) {
  const [callStatus, setCallStatus] = useState<"idle" | "busy" | "live" | "error">("idle");
  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: "init",
      who: "agent",
      text:
        business.greeting ||
        `Thanks for calling ${business.name}! Are you looking to book an appointment or check availability today?`,
    },
  ]);
  const [timerText, setTimerText] = useState("0:00");
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // Widget customizer & live preview state
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "light">("dark");
  const [widgetAccent, setWidgetAccent] = useState("#18181b");
  const [widgetPos, setWidgetPos] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [embedTab, setEmbedTab] = useState<"script" | "react">("script");
  const [isExpanded, setIsExpanded] = useState(false);

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const timerTickRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const feedBottomRef = useRef<HTMLDivElement | null>(null);

  // Quick chips derived dynamically from business catalog
  const chips = (business.services && business.services.length > 0)
    ? [
        ...business.services.slice(0, 2).map((s) => ({
          label: `${s.label} ($${s.price})`,
          query: `I'd like to ask about ${s.label}`,
        })),
        { label: "Check Availability", query: "What times do you have open this week?" },
      ]
    : [
        { label: "Book Appointment", query: "I would like to book an appointment" },
        { label: "Check Availability", query: "What times are open today?" },
        { label: "Pricing Info", query: "Can you tell me about your pricing?" },
      ];

  useEffect(() => {
    if (messages.length > 1) {
      feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const startTimer = () => {
    timerStartRef.current = Date.now();
    setTimerText("0:00");
    timerTickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      setTimerText(`${m}:${String(s).padStart(2, "0")}`);
    }, 250);
  };

  const stopTimer = () => {
    if (timerTickRef.current) {
      clearInterval(timerTickRef.current);
      timerTickRef.current = null;
    }
  };

  const isDeployed = Boolean(
    business.assemblyai_agent_id || business.id === "biz_demo_dental"
  );

  const handleToggleCall = async () => {
    if (!isDeployed) {
      toast.error("Please deploy this agent to AssemblyAI in the AI Agent Builder before testing.");
      return;
    }
    if (callStatus === "live" || callStatus === "busy") {
      handleEndCall();
    } else {
      await handleStartCall();
    }
  };

  const handleStartCall = async () => {
    if (!isDeployed) {
      toast.error("Please deploy this agent to AssemblyAI in the AI Agent Builder first.");
      return;
    }
    try {
      setCallStatus("busy");
      startTimer();

      const res = await fetch(`/api/token?businessId=${business.id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to mint session token");
      }

      const agentId =
        data.agent_id ||
        business.assemblyai_agent_id ||
        "";

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
              setShowEmailBar(true);
            }
          }
        },
        onError: (err) => {
          toast.error(err);
          setCallStatus("error");
          stopTimer();
        },
      });

      voiceClientRef.current = client;
      await client.start(data.token, agentId);
    } catch (err: any) {
      toast.error(err.message || "Failed to start call");
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

  const handleReset = () => {
    handleEndCall();
    setMessages([
      {
        id: "init",
        who: "agent",
        text:
          business.greeting ||
          `Thanks for calling ${business.name}! Are you looking to book an appointment or check availability today?`,
      },
    ]);
    setShowEmailBar(false);
    setEmailFeedback(null);
  };

  const handleQuickChip = (query: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        who: "user",
        text: query,
      },
    ]);
    if (callStatus !== "live") {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            who: "agent",
            text: `I'd be glad to help you with that! Click "Start Voice Call" below to begin speaking with me in real-time.`,
          },
        ]);
      }, 400);
    }
  };

  const handleVerifyEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValue.trim()) return;

    setEmailFeedback(`Email submitted: ${emailValue.trim()}`);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        who: "user",
        text: `My email is ${emailValue.trim()}`,
      },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          who: "agent",
          text: `Thank you! I have confirmed ${emailValue.trim()} and validated your booking reservation.`,
        },
      ]);
      setShowEmailBar(false);
    }, 600);
  };

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied snippet to clipboard!");
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://omni-desk-rho.vercel.app";
  const agentId = business.assemblyai_agent_id || "";

  const scriptSnippet = `<!-- OmniDesk Autonomous Voice Receptionist -->
<script
  src="${origin}/widget.js"
  data-agent="${agentId}"
  data-position="${widgetPos}"
  data-theme="${widgetTheme}"
  data-accent="${widgetAccent}"
  defer>
</script>`;

  const npmInstallSnippet = `npm install @omnidesk/voice-widget`;

  const reactSnippet = `import { VoiceWidget } from '@omnidesk/voice-widget';

export default function App() {
  return (
    <VoiceWidget
      businessId="${business.id}"
      agentId="${agentId}"
      theme="${widgetTheme}"
      accent="${widgetAccent}"
      position="${widgetPos}"
    />
  );
}`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        gap: "24px",
        alignItems: "stretch",
      }}
    >
      {/* Backdrop when expanded to fullscreen */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 190,
          }}
        />
      )}

      {/* LEFT: Live Simulator Box Matching the state-of-the-art Demo Widget */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e4e4e7",
          borderRadius: "20px",
          boxShadow: isExpanded
            ? "0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)"
            : "0 20px 40px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: "640px",
          height: isExpanded ? "calc(100vh - 56px)" : "100%",
          maxHeight: isExpanded ? "900px" : "none",
          width: isExpanded ? "calc(100vw - 64px)" : "100%",
          maxWidth: isExpanded ? "1140px" : "none",
          position: isExpanded ? "fixed" : "relative",
          top: isExpanded ? "50%" : "auto",
          left: isExpanded ? "50%" : "auto",
          transform: isExpanded ? "translate(-50%, -50%)" : "none",
          zIndex: isExpanded ? 200 : "auto",
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box",
        }}
      >
        {/* Widget Topbar — Live Dynamic Theme & Accent */}
        <div
          style={{
            background: widgetTheme === "dark" ? widgetAccent : "#ffffff",
            color: widgetTheme === "dark" ? "#ffffff" : "#09090b",
            borderBottom: widgetTheme === "light" ? "1px solid #e4e4e7" : "none",
            padding: isExpanded ? "16px 24px" : "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            userSelect: "none",
            flexShrink: 0,
            transition: "background 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            {/* 3 vertical dots icon */}
            <div style={{ color: widgetTheme === "dark" ? "rgba(255,255,255,0.7)" : "#71717a", display: "grid", placeItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </div>
            {/* Circle microphone avatar */}
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: widgetTheme === "dark" ? "rgba(255,255,255,0.18)" : "#f4f4f5",
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
              <h3 style={{ margin: 0, fontSize: "13.5px", fontWeight: 600, color: widgetTheme === "dark" ? "#ffffff" : "#09090b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {business.name}
              </h3>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: widgetTheme === "dark" ? "rgba(255,255,255,0.75)" : "#71717a" }}>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: callStatus === "live" ? "#22c55e" : callStatus === "busy" ? "#eab308" : widgetTheme === "dark" ? "rgba(255,255,255,0.4)" : "#a1a1aa",
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

          {/* Right controls: Open Full & Reset */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: widgetTheme === "dark" ? "rgba(255,255,255,0.85)" : "#52525b" }}>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Exit Fullscreen" : "Open Full"}
              style={{
                background: widgetTheme === "dark" ? "rgba(255,255,255,0.12)" : "#f4f4f5",
                border: widgetTheme === "dark" ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e4e4e7",
                borderRadius: "7px",
                color: widgetTheme === "dark" ? "#ffffff" : "#27272a",
                width: "30px",
                height: "30px",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                transition: "all 0.15s ease",
              }}
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
              onClick={handleReset}
              title="Reset Conversation"
              style={{
                background: widgetTheme === "dark" ? "rgba(255,255,255,0.12)" : "#f4f4f5",
                border: widgetTheme === "dark" ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e4e4e7",
                borderRadius: "7px",
                color: widgetTheme === "dark" ? "#ffffff" : "#27272a",
                width: "30px",
                height: "30px",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                transition: "all 0.15s ease",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Undeployed warning banner */}
        {!isDeployed && (
          <div
            style={{
              padding: "12px 18px",
              background: "#fffbeb",
              borderBottom: "1px solid #fde68a",
              color: "#92400e",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              lineHeight: 1.45,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Agent Not Deployed:</strong> This receptionist hasn&apos;t been deployed to AssemblyAI yet. Please open the <strong>AI Agent Builder</strong> and click <strong>Deploy to AssemblyAI</strong> before starting live voice calls.
            </div>
          </div>
        )}

        {/* Conversation Feed */}
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
              key={m.id}
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
                      background: widgetAccent,
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff",
                      flexShrink: 0,
                      marginTop: "2px",
                      transition: "background 0.2s ease",
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
                    background: m.who === "agent" ? "#f4f4f5" : widgetAccent,
                    color: m.who === "agent" ? "#09090b" : "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    transition: "background 0.2s ease",
                  }}
                >
                  {m.text}
                </div>
              </div>

              {/* Quick suggestion chips below initial greeting message */}
              {idx === 0 && chips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", marginLeft: "32px" }}>
                  {chips.map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => handleQuickChip(chip.query)}
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = widgetAccent;
                        e.currentTarget.style.color = widgetAccent;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e4e4e7";
                        e.currentTarget.style.color = "#27272a";
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={feedBottomRef} />
        </div>

        {/* Live email entry box */}
        {showEmailBar && (
          <div style={{ padding: "12px 16px", background: "#fbfbfa", borderTop: "1px solid #e4e4e7" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                Agent Asking for Email
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Direct confirmation entry</span>
            </div>
            <form onSubmit={handleVerifyEmailSubmit} style={{ display: "flex", gap: "8px" }}>
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="e.g. client@gmail.com"
                required
                style={{
                  flex: 1,
                  fontFamily: "var(--font)",
                  fontSize: "13px",
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  background: widgetAccent,
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s ease",
                }}
              >
                Verify &amp; Send
              </button>
            </form>
            {emailFeedback && (
              <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>{emailFeedback}</div>
            )}
          </div>
        )}

        {/* Bottom Call Bar */}
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
            disabled={!isDeployed || callStatus === "busy"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 18px",
              background: !isDeployed ? "#71717a" : callStatus === "live" ? "#dc2626" : widgetAccent,
              color: "#ffffff",
              borderRadius: "10px",
              border: "none",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: !isDeployed ? "not-allowed" : "pointer",
              opacity: !isDeployed ? 0.65 : 1,
              transition: "all 0.15s ease",
            }}
            title={!isDeployed ? "Deploy to AssemblyAI in Agent Builder before testing" : undefined}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span>
              {!isDeployed
                ? "Deploy Agent to Test Live Voice"
                : callStatus === "live"
                ? "End Voice Call"
                : callStatus === "busy"
                ? "Connecting..."
                : "Start Voice Call"}
            </span>
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
              {timerText}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: Integrate Into Your Website Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          minHeight: "640px",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px", lineHeight: "1.4" }}>
            Integrate Into Your Website
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
            Embed this autonomous voice agent into any platform in under 60 seconds.
          </p>
        </div>

        {/* Customizer Controls Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            background: "#fafafa",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            marginBottom: "18px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Widget Theme:
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setWidgetTheme("dark")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: widgetTheme === "dark" ? "1px solid #000000" : "1px solid var(--border)",
                  background: widgetTheme === "dark" ? "#000000" : "#ffffff",
                  color: widgetTheme === "dark" ? "#ffffff" : "var(--text)",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setWidgetTheme("light")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: widgetTheme === "light" ? "1px solid #000000" : "1px solid var(--border)",
                  background: widgetTheme === "light" ? "#000000" : "#ffffff",
                  color: widgetTheme === "light" ? "#ffffff" : "var(--text)",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Light
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Accent Color:
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {ACCENT_COLORS.map((c) => (
                <div
                  key={c.hex}
                  onClick={() => setWidgetAccent(c.hex)}
                  title={c.label}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: c.hex,
                    cursor: "pointer",
                    boxShadow: widgetAccent === c.hex ? "0 0 0 2px #000000" : "0 0 0 1px var(--border)",
                    transform: widgetAccent === c.hex ? "scale(1.18)" : "scale(1)",
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Position:
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setWidgetPos("bottom-right")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: widgetPos === "bottom-right" ? "1px solid #000000" : "1px solid var(--border)",
                  background: widgetPos === "bottom-right" ? "#000000" : "#ffffff",
                  color: widgetPos === "bottom-right" ? "#ffffff" : "var(--text)",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Bottom-Right
              </button>
              <button
                type="button"
                onClick={() => setWidgetPos("bottom-left")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: widgetPos === "bottom-left" ? "1px solid #000000" : "1px solid var(--border)",
                  background: widgetPos === "bottom-left" ? "#000000" : "#ffffff",
                  color: widgetPos === "bottom-left" ? "#ffffff" : "var(--text)",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Bottom-Left
              </button>
            </div>
          </div>
        </div>

        {/* Integration Code Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "14px" }}>
          <button
            type="button"
            onClick={() => setEmbedTab("script")}
            style={{
              background: embedTab === "script" ? "#000000" : "#f4f4f5",
              color: embedTab === "script" ? "#ffffff" : "var(--text-muted)",
              border: "1px solid var(--border)",
              padding: "5px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Script Embed
          </button>
          <button
            type="button"
            onClick={() => setEmbedTab("react")}
            style={{
              background: embedTab === "react" ? "#000000" : "#f4f4f5",
              color: embedTab === "react" ? "#ffffff" : "var(--text-muted)",
              border: "1px solid var(--border)",
              padding: "5px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            React / NPM
          </button>
        </div>

        {/* Tab 1: Script Embed Snippet */}
        {embedTab === "script" ? (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px", lineHeight: "1.5" }}>
              Paste this snippet right before the closing <code>&lt;/body&gt;</code> tag on Webflow, WordPress, Shopify, Framer, Wix, or plain HTML:
            </p>
            <div
              style={{
                position: "relative",
                background: "#09090b",
                color: "#f4f4f5",
                borderRadius: "var(--radius)",
                padding: "14px",
                border: "1px solid #27272a",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "#a1a1aa" }}>HTML Drop-in</span>
                <button
                  type="button"
                  onClick={() => copySnippet(scriptSnippet)}
                  style={{
                    background: "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11.5px",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy Script
                </button>
              </div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.5", overflowX: "auto" }}>
                {scriptSnippet}
              </pre>
            </div>
          </div>
        ) : (
          /* Tab 2: React / NPM Snippet */
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px", lineHeight: "1.5" }}>
              Install the package via npm or pnpm for Next.js, Vite, or React applications:
            </p>
            <div
              style={{
                position: "relative",
                background: "#09090b",
                color: "#f4f4f5",
                borderRadius: "var(--radius)",
                padding: "10px 14px",
                border: "1px solid #27272a",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <code style={{ fontFamily: "var(--mono)", fontSize: "12px" }}>{npmInstallSnippet}</code>
                <button
                  type="button"
                  onClick={() => copySnippet(npmInstallSnippet)}
                  style={{
                    background: "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy
                </button>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                background: "#09090b",
                color: "#f4f4f5",
                borderRadius: "var(--radius)",
                padding: "14px",
                border: "1px solid #27272a",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "#a1a1aa" }}>React / Next.js Component</span>
                <button
                  type="button"
                  onClick={() => copySnippet(reactSnippet)}
                  style={{
                    background: "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11.5px",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy Component
                </button>
              </div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.5", overflowX: "auto" }}>
                {reactSnippet}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
