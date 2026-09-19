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
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [timerText, setTimerText] = useState("0:00");
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);

  // Widget customizer & live preview state
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "light">("dark");
  const [widgetAccent, setWidgetAccent] = useState("#18181b");
  const [widgetPos, setWidgetPos] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [widgetLabel, setWidgetLabel] = useState("Talk to Receptionist");
  const [embedTab, setEmbedTab] = useState<"script" | "react">("script");
  const [isExpanded, setIsExpanded] = useState(false);

  // Email input bar states
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const timerTickRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const feedBottomRef = useRef<HTMLDivElement | null>(null);

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
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
  };

  const handleReset = () => {
    handleEndCall();
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
    setMessages([]);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed) return;

    setIsVerifyingEmail(true);
    setEmailError("");
    setEmailSuccess("");

    try {
      const res = await fetch(`/api/tools/${business.id}/verify_customer_email`, {
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

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied snippet to clipboard!");
  };

  const deployedUrl =
    typeof window !== "undefined" &&
    !window.location.origin.includes("localhost") &&
    !window.location.origin.includes("127.0.0.1")
      ? window.location.origin
      : "";
  const origin = deployedUrl || "";
  const agentId = business.assemblyai_agent_id || "";

  const scriptSnippet = `<!-- OmniDesk Autonomous Voice Receptionist -->
<script
  src="${origin}/widget.js"
  data-agent="${agentId}"
  data-position="${widgetPos}"
  data-theme="${widgetTheme}"
  data-accent="${widgetAccent}"
  data-label="${widgetLabel}"
  defer>
</script>`;

  const npmInstallSnippet = `npm install omnidesk-voice`;

  const reactSnippet = `import { OmniDeskWidget } from 'omnidesk-voice';

export default function App() {
  return (
    <OmniDeskWidget
      businessId="${business.id}"
      agentId="${agentId}"
      theme="${widgetTheme}"
      accent="${widgetAccent}"
      position="${widgetPos}"
      label="${widgetLabel}"
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
          minHeight: isExpanded ? "auto" : "560px",
          height: isExpanded ? "calc(100vh - 56px)" : "680px",
          maxHeight: isExpanded ? "900px" : "680px",
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
        {/* Widget Topbar — Matching user reference */}
        <div
          style={{
            background: "#18181b",
            color: "#ffffff",
            borderBottom: "1px solid #27272a",
            padding: "13px 18px",
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

            {/* Title & Status */}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {business.name}
              </div>
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

          {/* Right controls */}
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

        {/* Conversation Feed — Crisp White Background */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
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

          {messages.map((m) => (
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
                    fontSize: "13px",
                    lineHeight: "1.45",
                    background: m.who === "agent" ? "#f4f4f5" : "#18181b",
                    color: m.who === "agent" ? "#09090b" : "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}
          <div ref={feedBottomRef} />
        </div>

        {/* Live email entry bar */}
        {showEmailBar && callStatus === "live" && (
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
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                Email Requested by Agent • Auto Verification
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
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: isVerifyingEmail ? 0.7 : 1,
                }}
              >
                {isVerifyingEmail ? "Verifying..." : "Verify & Send"}
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
            onClick={handleToggleCall}
            disabled={!isDeployed || callStatus === "busy"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              background: callStatus === "live" ? "#dc2626" : "#000000",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: !isDeployed || callStatus === "busy" ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span>{callStatus === "live" ? "End Voice Call" : callStatus === "busy" ? "Connecting..." : "Start Voice Call"}</span>
          </button>

          {/* Right: Waveform visualizer bars when live + Duration badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {callStatus === "live" && (
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
                background: callStatus === "live" ? "#000000" : "#f4f4f5",
                color: callStatus === "live" ? "#ffffff" : "#71717a",
              }}
            >
              {timerText}
            </span>
          </div>
        </div>

        {/* Live Floating Launcher Pill Preview */}
        <div
          style={{
            padding: "10px 16px",
            background: widgetTheme === "dark" ? "#09090b" : "#f4f4f5",
            borderTop: `1px solid ${widgetTheme === "dark" ? "#27272a" : "#e4e4e7"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: widgetPos === "bottom-right" ? "flex-end" : "flex-start",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: widgetTheme === "dark" ? "#18181b" : "#ffffff",
              color: widgetTheme === "dark" ? "#fafafa" : "#09090b",
              border: `1px solid ${widgetTheme === "dark" ? "#27272a" : "#e4e4e7"}`,
              padding: "7px 16px",
              borderRadius: "9999px",
              fontSize: "12.5px",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              userSelect: "none",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: callStatus === "live" ? "#ef4444" : (widgetAccent === "#18181b" ? "#10b981" : widgetAccent),
                boxShadow: `0 0 8px ${callStatus === "live" ? "#ef4444" : (widgetAccent === "#18181b" ? "#10b981" : widgetAccent)}`,
              }}
            />
            <span>{widgetLabel || "Talk to Receptionist"}</span>
            <span style={{ fontSize: "11px", opacity: 0.6 }}>▲</span>
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

          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Label:
            </div>
            <input
              type="text"
              value={widgetLabel}
              onChange={(e) => setWidgetLabel(e.target.value)}
              placeholder="Talk to Receptionist"
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#ffffff",
                color: "var(--text)",
                outline: "none",
                width: "160px",
                fontFamily: "var(--font)",
                boxSizing: "border-box",
                height: "27px",
              }}
            />
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
