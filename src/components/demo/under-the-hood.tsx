"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Code2,
  Terminal,
  Cpu,
  Play,
  Square,
  Sparkles,
  Zap,
  Mic,
  Volume2,
  ArrowRight,
  Check,
  Copy,
  Layers,
  Radio,
  RefreshCw,
  Sliders,
  ExternalLink,
} from "lucide-react";

export function UnderTheHoodPlayground() {
  const [activeTab, setActiveTab] = useState<"react" | "vanilla" | "headless">("react");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    }
  };

  // ---------------------------------------------------------------------------
  // STEP 1: REACT STATE
  // ---------------------------------------------------------------------------
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "light">("dark");
  const [widgetPosition, setWidgetPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [widgetAccent, setWidgetAccent] = useState<string>("#10b981");
  const [widgetLabel, setWidgetLabel] = useState<string>("Talk to Receptionist");
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [widgetCallActive, setWidgetCallActive] = useState(false);
  const [widgetTranscript, setWidgetTranscript] = useState<Array<{ who: "agent" | "user"; text: string }>>([
    { who: "agent", text: "Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?" },
  ]);

  // ---------------------------------------------------------------------------
  // STEP 2: VANILLA STATE
  // ---------------------------------------------------------------------------
  const [vanillaMounted, setVanillaMounted] = useState(true);
  const [vanillaModalOpen, setVanillaModalOpen] = useState(false);
  const [vanillaLogs, setVanillaLogs] = useState<Array<{ time: string; msg: string; type: "dom" | "event" | "net" }>>([
    { time: "00:00.01", msg: "document.createElement('div#omnidesk-voice-widget-root')", type: "dom" },
    { time: "00:00.03", msg: "Attached scoped inline styles (zero Tailwind or external CSS needed)", type: "dom" },
    { time: "00:00.05", msg: "Injected floating trigger button into document.body", type: "dom" },
    { time: "00:00.08", msg: "Bound click event listener -> Ready for visitor interactions", type: "event" },
  ]);

  const addVanillaLog = (msg: string, type: "dom" | "event" | "net") => {
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(
      Math.floor(now.getMilliseconds() / 10)
    ).padStart(2, "0")}`;
    setVanillaLogs((prev) => [...prev.slice(-8), { time: timeStr, msg, type }]);
  };

  const handleVanillaMount = () => {
    setVanillaMounted(true);
    addVanillaLog("document.body.appendChild(rootNode)", "dom");
    addVanillaLog("initOmniDeskWidget() lifecycle initialized successfully", "event");
  };

  const handleVanillaDestroy = () => {
    setVanillaMounted(false);
    setVanillaModalOpen(false);
    addVanillaLog("document.getElementById('omnidesk-voice-widget-root').remove()", "dom");
    addVanillaLog("Event listeners & AudioContext disposed safely", "event");
  };

  // ---------------------------------------------------------------------------
  // STEP 3: HEADLESS AUDIO STATE
  // ---------------------------------------------------------------------------
  const [headlessStreaming, setHeadlessStreaming] = useState(false);
  const [headlessAgentSpeaking, setHeadlessAgentSpeaking] = useState(false);
  const [headlessBargeInAlert, setHeadlessBargeInAlert] = useState(false);
  const [headlessPacketsSent, setHeadlessPacketsSent] = useState(0);
  const [headlessPacketsRecv, setHeadlessPacketsRecv] = useState(0);
  const [headlessUserLevel, setHeadlessUserLevel] = useState(0);
  const [headlessAgentLevel, setHeadlessAgentLevel] = useState(0);
  const [headlessMode, setHeadlessMode] = useState<"pipeline" | "customUi">("pipeline");
  const [headlessLogs, setHeadlessLogs] = useState<string[]>([
    "AudioContext initialized at 48000Hz native sample rate",
    "AudioWorkletProcessor 'capture' loaded: Linear PCM16 @ 24,000Hz",
    "Connected to AssemblyAI WebSocket: wss://agents.assemblyai.com/v1/ws",
  ]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (headlessStreaming) {
      interval = setInterval(() => {
        setHeadlessPacketsSent((p) => p + 1);
        setHeadlessUserLevel(Math.random() * 0.7 + 0.1);

        if (Math.random() > 0.4) {
          setHeadlessPacketsRecv((p) => p + 1);
          setHeadlessAgentSpeaking(true);
          setHeadlessAgentLevel(Math.random() * 0.8 + 0.2);
        } else {
          setHeadlessAgentSpeaking(false);
          setHeadlessAgentLevel(0);
        }
      }, 350);
    } else {
      setHeadlessUserLevel(0);
      setHeadlessAgentLevel(0);
      setHeadlessAgentSpeaking(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [headlessStreaming]);

  const handleTriggerBargeIn = () => {
    if (!headlessStreaming) {
      setHeadlessStreaming(true);
    }
    setHeadlessBargeInAlert(true);
    setHeadlessAgentSpeaking(false);
    setHeadlessAgentLevel(0);
    setHeadlessLogs((prev) => [
      ...prev.slice(-6),
      `[BARGE-IN] Caller voice detected during agent playback!`,
      `[AudioWorklet] playback.port.postMessage('stop') dispatched`,
      `[RingBuffer] Cleared 14,200 pending samples in 6.8ms (Zero overlap)`,
    ]);
    setTimeout(() => setHeadlessBargeInAlert(false), 2400);
  };

  return (
    <section style={{ marginTop: "54px", paddingTop: "40px", borderTop: "1px solid #e4e4e7" }}>
      <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
        {/* SECTION HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: "9999px",
                padding: "4px 14px",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#18181b",
                marginBottom: "10px",
                letterSpacing: "0.04em",
              }}
            >
              <Cpu size={14} style={{ color: "#09090b" }} />
              <span>NPM PACKAGE ARCHITECTURE &amp; DEEP DIVE</span>
            </div>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                margin: "0 0 8px",
                color: "#09090b",
              }}
            >
              How Each Step Works Under the Hood
            </h2>
            <p style={{ fontSize: "14px", color: "#71717a", margin: 0, maxWidth: "740px", lineHeight: 1.6 }}>
              The <code style={{ background: "#f4f4f5", padding: "2px 7px", borderRadius: "5px", fontSize: "13px", fontWeight: 600, color: "#09090b" }}>omnidesk-voice</code> package is built for modular adoption. Click through each step below to inspect its execution pipeline, code location, and an interactive live sandbox.
            </p>
          </div>

          {/* Quick Install Pill */}
          <div
            onClick={() => handleCopy("npm i omnidesk-voice", "copy-install")}
            style={{
              background: "#09090b",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontFamily: "monospace",
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              border: "1px solid #27272a",
              transition: "transform 0.15s ease",
            }}
          >
            <span style={{ color: "#a1a1aa" }}>$</span>
            <span style={{ fontWeight: 600 }}>npm i omnidesk-voice</span>
            <span
              style={{
                color: copiedId === "copy-install" ? "#10b981" : "#a1a1aa",
                fontSize: "11px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {copiedId === "copy-install" ? (
                <>
                  <Check size={12} /> COPIED
                </>
              ) : (
                <>
                  <Copy size={12} /> COPY
                </>
              )}
            </span>
          </div>
        </div>

        {/* 3 STEP TABS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          {/* STEP 1 TAB */}
          <button
            type="button"
            onClick={() => setActiveTab("react")}
            style={{
              padding: "16px 20px",
              borderRadius: "16px",
              border: activeTab === "react" ? "2px solid #09090b" : "1px solid #e4e4e7",
              background: activeTab === "react" ? "#09090b" : "#ffffff",
              color: activeTab === "react" ? "#ffffff" : "#09090b",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "react" ? "0 8px 20px rgba(0,0,0,0.12)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", opacity: 0.75, fontWeight: 700, letterSpacing: "0.05em" }}>STEP 1</span>
              <span
                style={{
                  fontSize: "10.5px",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: activeTab === "react" ? "rgba(255,255,255,0.2)" : "#f4f4f5",
                  color: activeTab === "react" ? "#ffffff" : "#09090b",
                  border: activeTab === "react" ? "none" : "1px solid #e4e4e7",
                  fontWeight: 600,
                }}
              >
                React / Next.js
              </span>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, margin: "2px 0" }}>&lt;OmniDeskWidget /&gt;</div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>packages/widget/src/widget.tsx</div>
          </button>

          {/* STEP 2 TAB */}
          <button
            type="button"
            onClick={() => setActiveTab("vanilla")}
            style={{
              padding: "16px 20px",
              borderRadius: "16px",
              border: activeTab === "vanilla" ? "2px solid #09090b" : "1px solid #e4e4e7",
              background: activeTab === "vanilla" ? "#09090b" : "#ffffff",
              color: activeTab === "vanilla" ? "#ffffff" : "#09090b",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "vanilla" ? "0 8px 20px rgba(0,0,0,0.12)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", opacity: 0.75, fontWeight: 700, letterSpacing: "0.05em" }}>STEP 2</span>
              <span
                style={{
                  fontSize: "10.5px",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: activeTab === "vanilla" ? "rgba(255,255,255,0.2)" : "#f4f4f5",
                  color: activeTab === "vanilla" ? "#ffffff" : "#09090b",
                  border: activeTab === "vanilla" ? "none" : "1px solid #e4e4e7",
                  fontWeight: 600,
                }}
              >
                Vanilla JS / HTML
              </span>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, margin: "2px 0" }}>initOmniDeskWidget()</div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>packages/widget/src/vanilla.ts</div>
          </button>

          {/* STEP 3 TAB */}
          <button
            type="button"
            onClick={() => setActiveTab("headless")}
            style={{
              padding: "16px 20px",
              borderRadius: "16px",
              border: activeTab === "headless" ? "2px solid #09090b" : "1px solid #e4e4e7",
              background: activeTab === "headless" ? "#09090b" : "#ffffff",
              color: activeTab === "headless" ? "#ffffff" : "#09090b",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "headless" ? "0 8px 20px rgba(0,0,0,0.12)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", opacity: 0.75, fontWeight: 700, letterSpacing: "0.05em" }}>STEP 3</span>
              <span
                style={{
                  fontSize: "10.5px",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: activeTab === "headless" ? "rgba(255,255,255,0.2)" : "#f4f4f5",
                  color: activeTab === "headless" ? "#ffffff" : "#09090b",
                  border: activeTab === "headless" ? "none" : "1px solid #e4e4e7",
                  fontWeight: 600,
                }}
              >
                Headless Audio Client
              </span>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, margin: "2px 0" }}>AssemblyAIVoiceClient</div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>packages/widget/src/audio-client.ts</div>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: REACT / NEXT.JS (<OmniDeskWidget />)                                */}
        {/* ========================================================================= */}
        {activeTab === "react" && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #e4e4e7",
              borderRadius: "22px",
              padding: "32px",
              boxShadow: "0 6px 24px rgba(0,0,0,0.03)",
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "20px",
                paddingBottom: "18px",
                borderBottom: "1px solid #e4e4e7",
              }}
            >
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px", color: "#09090b" }}>
                  Step 1: React / Next.js (<code style={{ fontSize: "17px", color: "#09090b" }}>&lt;OmniDeskWidget /&gt;</code>)
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12.5px" }}>
                  <span style={{ color: "#71717a" }}>Code location:</span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "#09090b",
                      fontWeight: 700,
                      background: "#e4e4e7",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    packages/widget/src/widget.tsx
                  </span>
                </div>
              </div>

              {/* Showcase Links */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link
                  href="/demo/salon"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "#000000",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>Open Salon Demo</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* User's Exact "How It Works" bullet list */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "16px",
                padding: "20px 24px",
                marginBottom: "26px",
              }}
            >
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#71717a",
                  letterSpacing: "0.06em",
                  margin: "0 0 12px",
                }}
              >
                How It Works Under the Hood:
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#27272a", lineHeight: 1.7 }}>
                <li>
                  <strong>Floating Pill Button:</strong> Renders a floating pill button in the screen corner with custom inline styles (no Tailwind or external CSS needed).
                </li>
                <li>
                  <strong>Session Token Handshake:</strong> When clicked, it fetches a real session token from{" "}
                  <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>
                    https://your-domain.com/api/token?businessId=...
                  </code>
                  .
                </li>
                <li>
                  <strong>Direct 24kHz Web Audio Stream:</strong> Opens a Web Audio API 24kHz mic stream directly to AssemblyAI&apos;s voice agent WebSocket (
                  <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>
                    wss://agents.assemblyai.com/v1/ws
                  </code>
                  ).
                </li>
                <li>
                  <strong>Live Visualizer &amp; Speech Bubbles:</strong> Renders the animated frequency waveform visualizer and live transcript speech bubbles in real time.
                </li>
              </ul>
            </div>

            {/* INTERACTIVE PLAYGROUND (GET THE IDEA!) */}
            <div style={{ marginBottom: "26px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sliders size={16} style={{ color: "#09090b" }} />
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#09090b" }}>
                    Interactive React Widget Sandbox (Test Inline Customization)
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "#71717a" }}>
                  Click the floating button in the simulated preview frame to test!
                </span>
              </div>

              {/* Controls Toolbar */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e4e4e7",
                  borderRadius: "14px 14px 0 0",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                  borderBottom: "none",
                }}
              >
                {/* Theme toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a" }}>Theme:</span>
                  <div style={{ display: "flex", background: "#f4f4f5", padding: "2px", borderRadius: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setWidgetTheme("dark")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: "none",
                        background: widgetTheme === "dark" ? "#09090b" : "transparent",
                        color: widgetTheme === "dark" ? "#ffffff" : "#71717a",
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
                        fontSize: "11.5px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: "none",
                        background: widgetTheme === "light" ? "#ffffff" : "transparent",
                        color: widgetTheme === "light" ? "#09090b" : "#71717a",
                        cursor: "pointer",
                        boxShadow: widgetTheme === "light" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      Light
                    </button>
                  </div>
                </div>

                {/* Position toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a" }}>Position:</span>
                  <div style={{ display: "flex", background: "#f4f4f5", padding: "2px", borderRadius: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setWidgetPosition("bottom-right")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: "none",
                        background: widgetPosition === "bottom-right" ? "#09090b" : "transparent",
                        color: widgetPosition === "bottom-right" ? "#ffffff" : "#71717a",
                        cursor: "pointer",
                      }}
                    >
                      bottom-right
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidgetPosition("bottom-left")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: "none",
                        background: widgetPosition === "bottom-left" ? "#09090b" : "transparent",
                        color: widgetPosition === "bottom-left" ? "#ffffff" : "#71717a",
                        cursor: "pointer",
                      }}
                    >
                      bottom-left
                    </button>
                  </div>
                </div>

                {/* Accent Color picker */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a" }}>Accent:</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[
                      { hex: "#10b981", label: "Emerald" },
                      { hex: "#3b82f6", label: "Blue" },
                      { hex: "#8b5cf6", label: "Purple" },
                      { hex: "#f59e0b", label: "Amber" },
                      { hex: "#ec4899", label: "Pink" },
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
                          border: widgetAccent === c.hex ? "2px solid #09090b" : "2px solid transparent",
                          transform: widgetAccent === c.hex ? "scale(1.15)" : "scale(1)",
                          transition: "transform 0.15s ease",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Label text */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a" }}>Label:</span>
                  <input
                    type="text"
                    value={widgetLabel}
                    onChange={(e) => setWidgetLabel(e.target.value)}
                    style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #e4e4e7",
                      outline: "none",
                      width: "160px",
                    }}
                  />
                </div>
              </div>

              {/* Simulated Website Canvas */}
              <div
                style={{
                  position: "relative",
                  height: "380px",
                  background: widgetTheme === "dark" ? "#0f172a" : "#f8fafc",
                  borderRadius: "0 0 14px 14px",
                  border: "1px solid #e4e4e7",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Mock Website Nav */}
                <div
                  style={{
                    padding: "12px 20px",
                    borderBottom: widgetTheme === "dark" ? "1px solid #1e293b" : "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: widgetTheme === "dark" ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#eab308" }} />
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e" }} />
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: widgetTheme === "dark" ? "#94a3b8" : "#64748b",
                      }}
                    >
                      https://your-business-website.com
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: widgetTheme === "dark" ? "#64748b" : "#94a3b8" }}>
                    Simulated Next.js Page View
                  </div>
                </div>

                {/* Mock Page Content */}
                <div style={{ padding: "40px 24px", maxWidth: "480px" }}>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      background: widgetAccent + "22",
                      color: widgetAccent,
                      fontSize: "11px",
                      fontWeight: 700,
                      marginBottom: "12px",
                    }}
                  >
                    PREVIEW CLIENT SITE
                  </div>
                  <h3
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: widgetTheme === "dark" ? "#f8fafc" : "#0f172a",
                      margin: "0 0 10px",
                    }}
                  >
                    Autonomous 24/7 Scheduling for Growing Practices
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: widgetTheme === "dark" ? "#94a3b8" : "#64748b",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    The OmniDesk widget floats unobtrusively in the screen corner. Visitors click to talk with the AI voice receptionist immediately.
                  </p>
                </div>

                {/* FLOATING TRIGGER PILL */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "20px",
                    left: widgetPosition === "bottom-left" ? "20px" : "auto",
                    right: widgetPosition === "bottom-right" ? "20px" : "auto",
                    zIndex: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setWidgetOpen(!widgetOpen)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      background: widgetTheme === "dark" ? "#18181b" : "#ffffff",
                      color: widgetTheme === "dark" ? "#fafafa" : "#09090b",
                      border: `1px solid ${widgetTheme === "dark" ? "#27272a" : "#e4e4e7"}`,
                      padding: "10px 18px",
                      borderRadius: "9999px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: widgetCallActive ? "#ef4444" : widgetAccent,
                        boxShadow: `0 0 8px ${widgetCallActive ? "#ef4444" : widgetAccent}`,
                      }}
                    />
                    <span>{widgetLabel}</span>
                    <span style={{ fontSize: "11px", opacity: 0.6 }}>{widgetOpen ? "▲" : "▼"}</span>
                  </button>
                </div>

                {/* EXPANDED MODAL PREVIEW */}
                {widgetOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "70px",
                      left: widgetPosition === "bottom-left" ? "20px" : "auto",
                      right: widgetPosition === "bottom-right" ? "20px" : "auto",
                      width: "320px",
                      height: "280px",
                      background: widgetTheme === "dark" ? "#18181b" : "#ffffff",
                      border: `1px solid ${widgetTheme === "dark" ? "#27272a" : "#e4e4e7"}`,
                      borderRadius: "18px",
                      boxShadow: "0 20px 30px -10px rgba(0,0,0,0.4)",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      zIndex: 20,
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${widgetTheme === "dark" ? "#27272a" : "#e4e4e7"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: widgetTheme === "dark" ? "#09090b" : "#f4f4f5",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: widgetTheme === "dark" ? "#fafafa" : "#09090b",
                          }}
                        >
                          OmniDesk AI Receptionist
                        </div>
                        <div style={{ fontSize: "10.5px", color: widgetAccent, fontWeight: 600 }}>
                          {widgetCallActive ? "Live Voice Call (24kHz)" : "Ready to connect"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWidgetOpen(false)}
                        style={{
                          background: "transparent",
                          border: "none",
                          fontSize: "14px",
                          color: "#71717a",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Transcripts container */}
                    <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {widgetTranscript.map((t, idx) => (
                        <div
                          key={idx}
                          style={{
                            alignSelf: t.who === "agent" ? "flex-start" : "flex-end",
                            background: t.who === "agent" ? (widgetTheme === "dark" ? "#27272a" : "#f4f4f5") : widgetAccent,
                            color: t.who === "agent" ? (widgetTheme === "dark" ? "#f4f4f5" : "#09090b") : "#ffffff",
                            padding: "8px 12px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            maxWidth: "85%",
                            lineHeight: 1.4,
                          }}
                        >
                          {t.text}
                        </div>
                      ))}
                    </div>

                    {/* Footer / Frequency Waveform */}
                    <div
                      style={{
                        padding: "10px 14px",
                        borderTop: `1px solid ${widgetTheme === "dark" ? "#27272a" : "#e4e4e7"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      {/* Waveform bars */}
                      <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "18px" }}>
                        {[8, 14, 18, 11, 16, 20, 12, 6, 15].map((h, i) => (
                          <div
                            key={i}
                            style={{
                              width: "3px",
                              height: widgetCallActive ? `${h}px` : "4px",
                              borderRadius: "2px",
                              background: widgetAccent,
                              transition: "height 0.2s ease",
                            }}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setWidgetCallActive(!widgetCallActive);
                          if (!widgetCallActive) {
                            setWidgetTranscript((p) => [
                              ...p,
                              { who: "user", text: "Hi! Can you tell me what appointment slots are available?" },
                              { who: "agent", text: "Sure! We have slots open this Friday at 10:30 am and 2:00 pm." },
                            ]);
                          }
                        }}
                        style={{
                          background: widgetCallActive ? "#ef4444" : widgetAccent,
                          color: "#ffffff",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {widgetCallActive ? "End Call" : "Start Call"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Code Snippet Box */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#71717a", textTransform: "uppercase" }}>
                  Step 1 React / Next.js Embed Snippet:
                </span>
                <span style={{ fontSize: "11.5px", color: "#71717a" }}>Works with Next.js App Router, Vite, &amp; CRA</span>
              </div>
              <div style={{ position: "relative" }}>
                <pre
                  style={{
                    background: "#09090b",
                    color: "#f4f4f5",
                    padding: "20px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    overflowX: "auto",
                    lineHeight: 1.5,
                    margin: 0,
                    border: "1px solid #27272a",
                  }}
                >
{`import { OmniDeskWidget } from "omnidesk-voice";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Floating AI Voice Receptionist Widget */}
        <OmniDeskWidget
          host="https://omni-desk-rho.vercel.app"
          businessId="biz_demo_dental"
          theme="${widgetTheme}"
          position="${widgetPosition}"
          accentColor="${widgetAccent}"
          label="${widgetLabel}"
          onCallStart={() => console.log("Call started")}
          onCallEnd={(seconds) => console.log("Call duration:", seconds)}
        />
      </body>
    </html>
  );
}`}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `import { OmniDeskWidget } from "omnidesk-voice";\n\n<OmniDeskWidget host="https://omni-desk-rho.vercel.app" businessId="biz_demo_dental" theme="${widgetTheme}" position="${widgetPosition}" accentColor="${widgetAccent}" label="${widgetLabel}" />`,
                      "copy-react-code"
                    )
                  }
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  {copiedId === "copy-react-code" ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy Code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: VANILLA JS / HTML (initOmniDeskWidget)                              */}
        {/* ========================================================================= */}
        {activeTab === "vanilla" && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #e4e4e7",
              borderRadius: "22px",
              padding: "32px",
              boxShadow: "0 6px 24px rgba(0,0,0,0.03)",
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "20px",
                paddingBottom: "18px",
                borderBottom: "1px solid #e4e4e7",
              }}
            >
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px", color: "#09090b" }}>
                  Step 2: Vanilla JS / HTML (<code style={{ fontSize: "17px", color: "#09090b" }}>initOmniDeskWidget</code>)
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12.5px" }}>
                  <span style={{ color: "#71717a" }}>Code location:</span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "#09090b",
                      fontWeight: 700,
                      background: "#e4e4e7",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    packages/widget/src/vanilla.ts
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: "12px",
                  background: "#f4f4f5",
                  color: "#09090b",
                  border: "1px solid #e4e4e7",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontWeight: 700,
                }}
              >
                Zero React Runtime Required
              </span>
            </div>

            {/* User's Exact "How It Works" bullet list */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "16px",
                padding: "20px 24px",
                marginBottom: "26px",
              }}
            >
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#71717a",
                  letterSpacing: "0.06em",
                  margin: "0 0 12px",
                }}
              >
                How It Works Under the Hood:
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#27272a", lineHeight: 1.7 }}>
                <li>
                  <strong>Pure DOM Manipulation:</strong> Pure vanilla JavaScript using <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>document.createElement</code>.
                </li>
                <li>
                  <strong>Direct Body Injection:</strong> Injects the modal and button directly into the <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>document.body</code> of any static website, WordPress, Webflow, or Shopify store without requiring React.
                </li>
                <li>
                  <strong>Cloudflare CDN Ready:</strong> Resolves directly from Cloudflare via <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>https://esm.sh/omnidesk-voice</code> with 0 compilation or npm install.
                </li>
                <li>
                  <strong>Controller Lifecycle:</strong> Returns a clean controller <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>{`{ destroy(), startCall() }`}</code> to programmatically control the widget.
                </li>
              </ul>
            </div>

            {/* INTERACTIVE PLAYGROUND (GET THE IDEA!) */}
            <div style={{ marginBottom: "26px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Terminal size={16} style={{ color: "#09090b" }} />
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#09090b" }}>
                    Pure DOM Execution Sandbox (Simulated Shopify / WordPress Store)
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleVanillaMount}
                    disabled={vanillaMounted}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      border: vanillaMounted ? "1px solid #e4e4e7" : "none",
                      background: vanillaMounted ? "#f4f4f5" : "#000000",
                      color: vanillaMounted ? "#a1a1aa" : "#ffffff",
                      cursor: vanillaMounted ? "not-allowed" : "pointer",
                      boxShadow: vanillaMounted ? "none" : "0 2px 6px rgba(0, 0, 0, 0.12)",
                    }}
                  >
                    <Play size={12} /> Run initOmniDeskWidget()
                  </button>
                  <button
                    type="button"
                    onClick={handleVanillaDestroy}
                    disabled={!vanillaMounted}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      border: "none",
                      background: !vanillaMounted ? "#e4e4e7" : "#ef4444",
                      color: !vanillaMounted ? "#a1a1aa" : "#ffffff",
                      cursor: !vanillaMounted ? "not-allowed" : "pointer",
                    }}
                  >
                    <Square size={12} /> widget.destroy()
                  </button>
                </div>
              </div>

              {/* Sandbox Split View */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  borderRadius: "14px",
                  border: "1px solid #e4e4e7",
                  overflow: "hidden",
                  background: "#ffffff",
                }}
              >
                {/* Left: Simulated Static Page */}
                <div
                  style={{
                    padding: "24px",
                    borderRight: "1px solid #e4e4e7",
                    position: "relative",
                    minHeight: "260px",
                    background: "#fcfcfd",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#71717a", textTransform: "uppercase", marginBottom: "6px" }}>
                    Plain HTML / Shopify Theme
                  </div>
                  <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "#09090b" }}>
                    My Static Webflow Page (0 React)
                  </h4>
                  <p style={{ fontSize: "12.5px", color: "#71717a", lineHeight: 1.5, margin: "0 0 20px" }}>
                    Notice the widget element is injected directly into the DOM tree as a native browser child node.
                  </p>

                  {/* The injected Vanilla Widget */}
                  {vanillaMounted ? (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setVanillaModalOpen(!vanillaModalOpen);
                          addVanillaLog(
                            vanillaModalOpen ? "modal.style.display = 'none'" : "modal.style.display = 'flex'",
                            "event"
                          );
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 16px",
                          borderRadius: "9999px",
                          background: "#09090b",
                          color: "#ffffff",
                          border: "1px solid #27272a",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                        }}
                      >
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                        <span>Talk to Receptionist</span>
                      </button>

                      {/* Modal if open */}
                      {vanillaModalOpen && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "54px",
                            right: "0",
                            width: "260px",
                            background: "#18181b",
                            color: "#ffffff",
                            border: "1px solid #27272a",
                            borderRadius: "14px",
                            padding: "14px",
                            boxShadow: "0 14px 24px rgba(0,0,0,0.3)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700 }}>AI Receptionist</span>
                            <span
                              onClick={() => setVanillaModalOpen(false)}
                              style={{ cursor: "pointer", fontSize: "12px", color: "#a1a1aa" }}
                            >
                              ✕
                            </span>
                          </div>
                          <div style={{ fontSize: "11.5px", color: "#a1a1aa", lineHeight: 1.4 }}>
                            Injected into document.body without React runtime!
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "14px",
                        background: "#fee2e2",
                        color: "#991b1b",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      Widget destroyed. Click &ldquo;Run initOmniDeskWidget()&rdquo; to re-inject into DOM.
                    </div>
                  )}
                </div>

                {/* Right: Real-time DOM Lifecycle Log */}
                <div style={{ padding: "18px 20px", background: "#09090b", color: "#f4f4f5", fontFamily: "monospace" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#a1a1aa", letterSpacing: "0.05em" }}>
                      REAL-TIME DOM TRACE
                    </span>
                    <span style={{ fontSize: "10.5px", color: "#10b981" }}>ACTIVE</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11.5px", lineHeight: 1.4 }}>
                    {vanillaLogs.map((l, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px" }}>
                        <span style={{ color: "#71717a" }}>[{l.time}]</span>
                        <span
                          style={{
                            color: l.type === "dom" ? "#60a5fa" : l.type === "event" ? "#34d399" : "#fbbf24",
                          }}
                        >
                          {l.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Script Tag Snippet */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#71717a", textTransform: "uppercase" }}>
                  Universal HTML / Shopify / WordPress Script Tag:
                </span>
                <span style={{ fontSize: "11.5px", color: "#71717a" }}>Hosted on Cloudflare CDN via esm.sh</span>
              </div>
              <div style={{ position: "relative" }}>
                <pre
                  style={{
                    background: "#09090b",
                    color: "#f4f4f5",
                    padding: "20px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    overflowX: "auto",
                    lineHeight: 1.5,
                    margin: 0,
                    border: "1px solid #27272a",
                  }}
                >
{`<!-- Works on any HTML, Shopify, WordPress, or Webflow site -->
<script type="module">
  import { initOmniDeskWidget } from "https://esm.sh/omnidesk-voice";

  // Automatically injects floating pill and voice modal into document.body
  const widget = initOmniDeskWidget({
    host: "https://omni-desk-rho.vercel.app",
    businessId: "biz_demo_dental",
    theme: "dark",
    position: "bottom-right",
    label: "Talk to Receptionist",
    accentColor: "#10b981",
    onCallStart: () => console.log("Call connected"),
    onCallEnd: (duration) => console.log("Call duration: " + duration + "s")
  });

  // Programmatic cleanup when page unmounts (optional)
  // widget.destroy();
</script>`}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `<script type="module">\n  import { initOmniDeskWidget } from "https://esm.sh/omnidesk-voice";\n  initOmniDeskWidget({\n    host: "https://omni-desk-rho.vercel.app",\n    businessId: "biz_demo_dental"\n  });\n</script>`,
                      "copy-vanilla-code"
                    )
                  }
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  {copiedId === "copy-vanilla-code" ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy Script
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: HEADLESS AUDIO CLIENT (AssemblyAIVoiceClient)                       */}
        {/* ========================================================================= */}
        {activeTab === "headless" && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #e4e4e7",
              borderRadius: "22px",
              padding: "32px",
              boxShadow: "0 6px 24px rgba(0,0,0,0.03)",
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "20px",
                paddingBottom: "18px",
                borderBottom: "1px solid #e4e4e7",
              }}
            >
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px", color: "#09090b" }}>
                  Step 3: Headless Audio Client (<code style={{ fontSize: "17px", color: "#09090b" }}>AssemblyAIVoiceClient</code>)
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12.5px" }}>
                  <span style={{ color: "#71717a" }}>Code location:</span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "#09090b",
                      fontWeight: 700,
                      background: "#e4e4e7",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    packages/widget/src/audio-client.ts
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: "12px",
                  background: "#f4f4f5",
                  color: "#09090b",
                  border: "1px solid #e4e4e7",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontWeight: 700,
                }}
              >
                100% Custom UI Freedom
              </span>
            </div>

            {/* User's Exact "How It Works" bullet list */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "16px",
                padding: "20px 24px",
                marginBottom: "26px",
              }}
            >
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#71717a",
                  letterSpacing: "0.06em",
                  margin: "0 0 12px",
                }}
              >
                How It Works Under the Hood:
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#27272a", lineHeight: 1.7 }}>
                <li>
                  <strong>AudioWorklet Ring Buffers:</strong> Initializes <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>AudioContext</code> and <code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>AudioWorkletNode</code> ring buffers for continuous zero-allocation audio streaming.
                </li>
                <li>
                  <strong>Linear PCM Resampling:</strong> Converts raw microphone input into 16-bit linear PCM at 24kHz.
                </li>
                <li>
                  <strong>AssemblyAI WebSocket:</strong> Transmits audio to AssemblyAI (<code style={{ background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px", fontSize: "12.5px" }}>wss://agents.assemblyai.com/v1/ws</code>).
                </li>
                <li>
                  <strong>Sub-Second Interruption Handling:</strong> Receives streaming PCM chunks and plays them back through the user&apos;s speakers with sub-second interruption handling (barge-in).
                </li>
              </ul>
            </div>

            {/* INTERACTIVE PLAYGROUND (GET THE IDEA!) */}
            <div style={{ marginBottom: "26px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio size={16} style={{ color: "#09090b" }} />
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#09090b" }}>
                    AudioWorklet Pipeline &amp; Sub-Second Interruption Simulator
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setHeadlessStreaming(!headlessStreaming)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      border: "none",
                      background: headlessStreaming ? "#27272a" : "#000000",
                      color: "#ffffff",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
                    }}
                  >
                    {headlessStreaming ? <Square size={12} /> : <Play size={12} />}
                    <span>{headlessStreaming ? "Stop Audio Stream" : "Start Audio Stream"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerBargeIn}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      border: "1px solid #e4e4e7",
                      background: headlessBargeInAlert ? "#fee2e2" : "#ffffff",
                      color: headlessBargeInAlert ? "#991b1b" : "#09090b",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Zap size={12} style={{ color: "#eab308" }} />
                    <span>Trigger Barge-In (Interruption)</span>
                  </button>
                </div>
              </div>

              {/* Pipeline 4-Stage Architecture Diagram */}
              <div
                style={{
                  background: "#09090b",
                  color: "#ffffff",
                  borderRadius: "16px",
                  padding: "24px",
                  border: "1px solid #27272a",
                }}
              >
                {/* Barge-in alert notification */}
                {headlessBargeInAlert && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid #ef4444",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      marginBottom: "16px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#fca5a5",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Zap size={14} style={{ color: "#ef4444" }} />
                    <span>[BARGE-IN TRIGGERED] Speaker playback ring buffer flushed immediately &lt; 10ms.</span>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    marginBottom: "20px",
                  }}
                >
                  {/* STAGE 1: MIC INPUT */}
                  <div
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 700 }}>STAGE 1</span>
                      <Mic size={14} style={{ color: headlessStreaming ? "#10b981" : "#71717a" }} />
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "4px" }}>Browser Mic Stream</div>
                    <div style={{ fontSize: "11.5px", color: "#a1a1aa", marginBottom: "10px" }}>
                      navigator.mediaDevices
                    </div>
                    {/* User level bar */}
                    <div style={{ height: "4px", background: "#27272a", borderRadius: "2px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(headlessUserLevel * 100)}%`,
                          background: "#10b981",
                          transition: "width 0.15s ease",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#71717a", marginTop: "6px" }}>
                      Native: 44.1kHz - 48kHz
                    </div>
                  </div>

                  {/* STAGE 2: AUDIOWORKLET RESAMPLING */}
                  <div
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 700 }}>STAGE 2</span>
                      <Cpu size={14} style={{ color: headlessStreaming ? "#3b82f6" : "#71717a" }} />
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "4px" }}>AudioWorklet Resampler</div>
                    <div style={{ fontSize: "11.5px", color: "#a1a1aa", marginBottom: "10px" }}>
                      16-bit Linear PCM RingBuffer
                    </div>
                    <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#60a5fa" }}>
                      Wire Rate: 24,000 Hz
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#71717a", marginTop: "6px" }}>
                      Packets: {headlessPacketsSent} sent
                    </div>
                  </div>

                  {/* STAGE 3: ASSEMBLYAI WEBSOCKET */}
                  <div
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 700 }}>STAGE 3</span>
                      <Radio size={14} style={{ color: headlessStreaming ? "#8b5cf6" : "#71717a" }} />
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "4px" }}>AssemblyAI WebSocket</div>
                    <div style={{ fontSize: "11.5px", color: "#a1a1aa", marginBottom: "10px" }}>
                      wss://agents.assemblyai.com
                    </div>
                    <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#a78bfa" }}>
                      Status: {headlessStreaming ? "STREAMING" : "IDLE"}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#71717a", marginTop: "6px" }}>
                      Speech-to-Speech LLM
                    </div>
                  </div>

                  {/* STAGE 4: PLAYBACK & BARGE-IN */}
                  <div
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 700 }}>STAGE 4</span>
                      <Volume2 size={14} style={{ color: headlessAgentSpeaking ? "#10b981" : "#71717a" }} />
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "4px" }}>Playback &amp; Barge-In</div>
                    <div style={{ fontSize: "11.5px", color: "#a1a1aa", marginBottom: "10px" }}>
                      Speaker Queue + RingBuffer
                    </div>
                    {/* Agent level bar */}
                    <div style={{ height: "4px", background: "#27272a", borderRadius: "2px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(headlessAgentLevel * 100)}%`,
                          background: "#8b5cf6",
                          transition: "width 0.15s ease",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#71717a", marginTop: "6px" }}>
                      Latency Cut: &lt; 12ms stop
                    </div>
                  </div>
                </div>

                {/* Live Console Output */}
                <div
                  style={{
                    background: "#000000",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    fontSize: "11.5px",
                    fontFamily: "monospace",
                    color: "#a1a1aa",
                    border: "1px solid #27272a",
                  }}
                >
                  <div style={{ color: "#71717a", marginBottom: "4px" }}>// Headless Audio Session Activity:</div>
                  {headlessLogs.map((log, idx) => (
                    <div key={idx} style={{ color: log.includes("BARGE-IN") ? "#f87171" : "#d4d4d8" }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Code Snippet Box */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#71717a", textTransform: "uppercase" }}>
                  Headless Audio Client Implementation Snippet:
                </span>
                <span style={{ fontSize: "11.5px", color: "#71717a" }}>Build ANY custom design, 3D avatar, or soundwave UI</span>
              </div>
              <div style={{ position: "relative" }}>
                <pre
                  style={{
                    background: "#09090b",
                    color: "#f4f4f5",
                    padding: "20px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    overflowX: "auto",
                    lineHeight: 1.5,
                    margin: 0,
                    border: "1px solid #27272a",
                  }}
                >
{`import { AssemblyAIVoiceClient } from "omnidesk-voice";

// Build ANY custom UI, 3D avatar, retro terminal, or floating sound orb
const client = new AssemblyAIVoiceClient({
  onStatusChange: (status) => console.log("Call status:", status),
  onTranscript: (msg) => updateMyChatUI(msg.who, msg.text),
  onAudioLevel: (userLevel, agentLevel) => updateMyWaveform(userLevel, agentLevel),
  onToolEvent: (event) => console.log("Calendar tool event:", event),
  onError: (err) => console.error("Voice error:", err),
});

// 1. Fetch real session token & agent ID from your OmniDesk backend
const res = await fetch("https://your-domain.com/api/token?businessId=biz_demo_dental");
const { token, agent_id } = await res.json();

// 2. Open 24kHz Web Audio connection directly to AssemblyAI
await client.start(token, agent_id);

// 3. Sub-second interruption handling is handled automatically inside the AudioWorklet!
// When the caller speaks while the agent is talking, client stops playback instantaneously.`}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `import { AssemblyAIVoiceClient } from "omnidesk-voice";\n\nconst client = new AssemblyAIVoiceClient({\n  onTranscript: (msg) => console.log(msg),\n  onAudioLevel: (u, a) => console.log(u, a),\n});\n\nconst { token, agent_id } = await fetch("/api/token?businessId=biz_demo_dental").then(r => r.json());\nawait client.start(token, agent_id);`,
                      "copy-headless-code"
                    )
                  }
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  {copiedId === "copy-headless-code" ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy Code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
