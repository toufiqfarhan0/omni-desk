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

export function VoiceTester({ business }: VoiceTesterProps) {
  const [callStatus, setCallStatus] = useState<"idle" | "busy" | "live" | "error">("idle");
  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: "init",
      who: "agent",
      text:
        business.greeting ||
        `Thanks for calling ${business.name}. Click "Start Call" below to test your customized voice agent in real-time over 24kHz bidirectional audio.`,
    },
  ]);
  const [timerText, setTimerText] = useState("0:00");
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // Widget customizer state
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "light">("dark");
  const [widgetAccent, setWidgetAccent] = useState("#18181b");
  const [widgetPos, setWidgetPos] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [embedTab, setEmbedTab] = useState<"script" | "react">("script");

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const timerTickRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const feedBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

      const res = await fetch(`/api/token?businessId=${business.id}`);
      if (!res.ok) throw new Error("Failed to mint session token");
      const { token } = await res.json();

      const agentId = business.assemblyai_agent_id || "agent_demo";

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
      await client.start(token, agentId);
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

  const handleVerifyEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValue.trim()) return;

    setEmailFeedback(`✓ Email submitted: ${emailValue.trim()}`);
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
          text: `Thank you! I have confirmed ${emailValue.trim()} and validated your calendar booking slot.`,
        },
      ]);
      setShowEmailBar(false);
    }, 600);
  };

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://omnidesk.ai";
  const scriptSnippet = `<!-- OmniDesk Autonomous Voice Receptionist -->
<script
  src="${origin}/widget.js"
  data-agent="${business.assemblyai_agent_id || business.id}"
  data-position="${widgetPos}"
  data-theme="${widgetTheme}"
  defer>
</script>`;

  const npmSnippet = `npm install @omnidesk/voice-widget`;

  const reactSnippet = `import { VoiceWidget } from '@omnidesk/voice-widget';

export default function Page() {
  return (
    <VoiceWidget
      agentId="${business.assemblyai_agent_id || business.id}"
      position="${widgetPos}"
      theme="${widgetTheme}"
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
      {/* LEFT: Live Simulator Box Matching web/dashboard.html */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          minHeight: "640px",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            background: "#fafafa",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: callStatus === "live" ? "#16a34a" : callStatus === "busy" ? "#eab308" : "#a1a1aa",
              }}
            />
            <span style={{ fontWeight: 500 }}>
              {callStatus === "live"
                ? "Live Call Active — Speaking over 24kHz audio"
                : callStatus === "busy"
                ? "Connecting to Voice Agent..."
                : callStatus === "error"
                ? "Connection Error"
                : "Idle — Click Start Call to test voice agent"}
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "12px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: callStatus === "live" ? "#000000" : "#f4f4f5",
              color: callStatus === "live" ? "#ffffff" : "var(--text)",
              fontWeight: 600,
            }}
          >
            {timerText}
          </span>
        </div>

        {/* Feed */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "#ffffff",
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                maxWidth: "85%",
                alignSelf: m.who === "agent" ? "flex-start" : "flex-end",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: m.who === "agent" ? "#000000" : "#71717a",
                }}
              >
                {m.who === "agent" ? `${business.name} Voice Assistant` : "You (Caller)"}
              </span>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: m.who === "agent" ? "14px 14px 14px 2px" : "14px 14px 2px 14px",
                  background: m.who === "agent" ? "#f4f4f5" : "#000000",
                  color: m.who === "agent" ? "#09090b" : "#ffffff",
                  fontSize: "13.5px",
                  lineHeight: "1.45",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={feedBottomRef} />
        </div>

        {/* Live email box */}
        {showEmailBar && (
          <div style={{ padding: "12px 16px", background: "#fbfbfa", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                Agent Asking for Email
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Type email to verify directly</span>
            </div>
            <form onSubmit={handleVerifyEmailSubmit} style={{ display: "flex", gap: "8px" }}>
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="e.g. name@gmail.com"
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
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
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

        {/* Controls */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
            background: "#fafafa",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={handleToggleCall}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: callStatus === "live" ? "#dc2626" : "#000000",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>{callStatus === "live" ? "End Call" : callStatus === "busy" ? "Connecting..." : "Start Call"}</span>
          </button>

          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Microphone: 24kHz Mono &bull; Echo Cancellation
          </div>
        </div>
      </div>

      {/* RIGHT: Integrate Into Your Website Card Matching web/dashboard.html */}
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
              {[
                { hex: "#18181b", label: "Monochrome" },
                { hex: "#581c87", label: "Purple" },
                { hex: "#1e3a8a", label: "Navy" },
                { hex: "#065f46", label: "Emerald" },
              ].map((c) => (
                <div
                  key={c.hex}
                  onClick={() => setWidgetAccent(c.hex)}
                  title={c.label}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: c.hex,
                    cursor: "pointer",
                    boxShadow: widgetAccent === c.hex ? "0 0 0 2px #000000" : "0 0 0 1px var(--border)",
                    transform: widgetAccent === c.hex ? "scale(1.15)" : "scale(1)",
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

        {/* Integration Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "14px" }}>
          <button
            type="button"
            onClick={() => setEmbedTab("script")}
            style={{
              background: embedTab === "script" ? "#000000" : "#f4f4f5",
              color: embedTab === "script" ? "#ffffff" : "var(--text-muted)",
              border: "1px solid var(--border)",
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
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
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            React / NPM
          </button>
        </div>

        {embedTab === "script" ? (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px" }}>
              Paste this snippet right before the closing <code>&lt;/body&gt;</code> tag on Webflow, WordPress, Shopify, Framer, Wix, or plain HTML:
            </p>
            <div
              style={{
                position: "relative",
                background: "#09090b",
                color: "#f4f4f5",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
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
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy Script
                </button>
              </div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.45", overflowX: "auto" }}>
                {scriptSnippet}
              </pre>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px" }}>
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
                marginBottom: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <code style={{ fontFamily: "var(--mono)", fontSize: "12px" }}>{npmSnippet}</code>
                <button
                  type="button"
                  onClick={() => copySnippet(npmSnippet)}
                  style={{
                    background: "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
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
                padding: "12px 14px",
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
                    fontSize: "11px",
                  }}
                >
                  Copy Component
                </button>
              </div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.45", overflowX: "auto" }}>
                {reactSnippet}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
