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
  isFinal?: boolean;
}

const ACCENT_COLORS = [
  { hex: "#18181b", label: "Onyx Black" },
  { hex: "#7c3aed", label: "Electric Purple" },
  { hex: "#2563eb", label: "Royal Blue" },
  { hex: "#059669", label: "Emerald Green" },
  { hex: "#e11d48", label: "Rose Coral" },
  { hex: "#d97706", label: "Amber Flame" },
  { hex: "#0891b2", label: "Cyan Ocean" },
  { hex: "#4f46e5", label: "Indigo Velvet" },
];

export function VoiceTester({ business }: VoiceTesterProps) {
  const [callStatus, setCallStatus] = useState<"idle" | "busy" | "live" | "error">("idle");
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [timerText, setTimerText] = useState("0:00");
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);

  // Widget customizer & live preview state
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "light">("light");
  const [widgetAccent, setWidgetAccent] = useState("#18181b");
  const [widgetPos, setWidgetPos] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [widgetLabel, setWidgetLabel] = useState("Talk to Receptionist");
  const [embedTab, setEmbedTab] = useState<"script" | "react">("script");
  const [isExpanded, setIsExpanded] = useState(false);

  const isDark = widgetTheme === "dark";

  // Email input bar states
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  const [isThinking, setIsThinking] = useState(false);

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const timerTickRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const bookingFinalizedRef = useRef<boolean>(false);
  const awaitingEmailConfirmRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

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
    if (callStatus === "live" || callStatus === "busy") {
      handleEndCall();
    } else {
      await handleStartCall();
    }
  };

  const handleStartCall = async () => {
    try {
      setCallStatus("busy");
      bookingFinalizedRef.current = false;
      awaitingEmailConfirmRef.current = false;
      hasSavedConversationRef.current = false;
      setShowEmailBar(false);
      startTimer();

      const res = await fetch(`/api/token?businessId=${business.id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to mint session token");
      }

      const agentId = (data.agent_id || business.assemblyai_agent_id || "").trim();
      const voice = data.voice || business.voice_id || "alba";

      const client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          if (status === "connected") {
            setCallStatus("live");
          } else if (status === "idle") {
            setCallStatus("idle");
            setIsThinking(false);
            stopTimer();
          } else if (status === "error") {
            setCallStatus("error");
            setIsThinking(false);
            stopTimer();
          }
        },
        onThinkingChange: (thinking) => {
          if (thinking) setIsThinking(true);
        },
        onSessionId: (sid) => {
          sessionIdRef.current = sid;
        },
        onTranscript: (event) => {
          if (event.who === "user" && event.isFinal) {
            setIsThinking(true);
          } else if (event.who === "agent" && event.text && event.text.trim().length > 0) {
            setIsThinking(false);
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            // If the last message is from the same speaker and was not finalized, update it in place!
            if (last && last.who === event.who && !last.isFinal) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                text: event.text,
                isFinal: event.isFinal ?? false,
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                who: event.who,
                text: event.text,
                isFinal: event.isFinal ?? false,
              },
            ];
          });

          if (event.who === "user") {
            const userTextLower = event.text.toLowerCase().trim();

            // If caller says no, wrong, or requests change to their email:
            const isNo =
              userTextLower === "no" ||
              userTextLower.startsWith("no ") ||
              userTextLower.includes("no,") ||
              userTextLower.includes("wrong") ||
              userTextLower.includes("incorrect") ||
              userTextLower.includes("change my email") ||
              userTextLower.includes("different email") ||
              userTextLower.includes("that's not right") ||
              userTextLower.includes("thats not right") ||
              userTextLower.includes("not right") ||
              userTextLower.includes("not my email");

            if (isNo) {
              awaitingEmailConfirmRef.current = false;
              // User rejected email! Immediately show the email input bar again so they can enter it!
              setShowEmailBar(true);
            }

            // If caller says yes to confirm their email:
            const isYes =
              userTextLower === "yes" ||
              userTextLower.startsWith("yes ") ||
              userTextLower.includes("yes,") ||
              userTextLower === "yeah" ||
              userTextLower.startsWith("yeah ") ||
              userTextLower === "yep" ||
              userTextLower === "correct" ||
              userTextLower.includes("that's right") ||
              userTextLower.includes("thats right") ||
              userTextLower.includes("sounds good") ||
              userTextLower === "confirm" ||
              userTextLower === "sure";

            if (isYes && awaitingEmailConfirmRef.current) {
              awaitingEmailConfirmRef.current = false;
              setShowEmailBar(false);
            }

            // If caller speaks their email or provides it in voice/text:
            if (
              event.text.includes("@") ||
              (userTextLower.includes(" at ") && userTextLower.includes(" dot ")) ||
              userTextLower.includes("gmail") ||
              userTextLower.includes("yahoo") ||
              userTextLower.includes("outlook") ||
              userTextLower.includes("hotmail") ||
              userTextLower.includes("icloud")
            ) {
              awaitingEmailConfirmRef.current = true;
              setShowEmailBar(false);
            }
          } else if (event.who === "agent") {
            const lower = event.text.toLowerCase();

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

            // 2. If agent is confirming the email or asking for yes/no confirmation:
            // e.g., "I have verified your email as ... Can you please confirm with yes or no?"
            const isConfirmingEmail =
              lower.includes("confirm with yes or no") ||
              lower.includes("yes or no") ||
              lower.includes("is that correct") ||
              lower.includes("is that right") ||
              lower.includes("verified your email") ||
              lower.includes("checking that email") ||
              lower.includes("let me check that email");

            if (isConfirmingEmail) {
              awaitingEmailConfirmRef.current = true;
              setShowEmailBar(false);
              return;
            }

            // 3. Strictly show input ONLY when agent is explicitly asking the caller to provide their email.
            // MUST NOT trigger in the middle of conversation (e.g. discussing services, pricing, dates, or caller name).
            const isAgentAskingEmail =
              !awaitingEmailConfirmRef.current &&
              (
                lower.includes("what is your email") ||
                lower.includes("what's your email") ||
                lower.includes("whats your email") ||
                lower.includes("may i have your email") ||
                lower.includes("can i have your email") ||
                lower.includes("could i have your email") ||
                lower.includes("could i get your email") ||
                lower.includes("could you provide your email") ||
                lower.includes("can you provide your email") ||
                lower.includes("provide your email") ||
                lower.includes("enter your email") ||
                lower.includes("share your email") ||
                lower.includes("need your email") ||
                lower.includes("what is your correct email") ||
                lower.includes("provide your correct email") ||
                lower.includes("where can i send your confirmation") ||
                lower.includes("where should i send your confirmation") ||
                lower.includes("where can i send your calendar") ||
                lower.includes("where should i send your calendar") ||
                (lower.includes("email address") && (
                  lower.includes("what is") ||
                  lower.includes("what's") ||
                  lower.includes("whats") ||
                  lower.includes("may i have") ||
                  lower.includes("can i have") ||
                  lower.includes("could i have") ||
                  lower.includes("could you provide") ||
                  lower.includes("can you provide") ||
                  lower.includes("provide") ||
                  lower.includes("share") ||
                  lower.includes("so i can send") ||
                  lower.includes("to send your")
                ))
              );

            if (isAgentAskingEmail) {
              setShowEmailBar(true);
            } else if (event.isFinal) {
              // Hide on final message if not explicitly asking for email
              setShowEmailBar(false);
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
      await client.start(data.token, agentId, voice, data.ws_url);
    } catch (err: any) {
      toast.error(err.message || "Failed to start call");
      setCallStatus("error");
      stopTimer();
    }
  };

  const messagesRef = useRef<SimMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const hasSavedConversationRef = useRef(false);
  const saveConversationRecord = async () => {
    if (hasSavedConversationRef.current) return;
    const msgs = messagesRef.current;
    if (!msgs || msgs.length <= 1) return;
    hasSavedConversationRef.current = true;

    let callerName: string | null = null;
    let callerEmail: string | null = null;
    let isBooked = false;
    let confirmationCode: string | null = null;

    const isValidPersonName = (val: string): boolean => {
      if (!val || typeof val !== "string") return false;
      const clean = val.trim();
      if (clean.length < 2 || clean.length > 30) return false;
      if (clean.includes("@") || /\d+:\d+|\b\d+\s*(?:am|pm)\b/i.test(clean)) return false;
      const lower = clean.toLowerCase();
      const forbidden = [
        "initial consultation", "consultation", "standard service", "haircut", "styling",
        "blowout", "balayage", "color", "full color", "treatment", "therapy",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
        "today", "tomorrow", "morning", "afternoon", "evening",
        "yes", "no", "okay", "ok", "yeah", "yep", "sure", "hello", "hi", "hey",
        "thanks", "thank you", "please", "appointment", "booking", "schedule",
        "oh thanks", "oh thank you", "good", "great", "fine", "demo caller"
      ];
      return !forbidden.some((b) => lower === b || lower.includes("consultation") || lower.includes("appointment"));
    };

    // 1. Detect booking confirmation code & email from conversation
    for (const m of msgs) {
      const lower = m.text.toLowerCase();
      if (
        lower.includes("confirmation code is") ||
        lower.includes("scheduled your") ||
        lower.includes("calendar invite") ||
        lower.includes("booking code") ||
        lower.includes("all set")
      ) {
        isBooked = true;
      }
      if (!confirmationCode) {
        const codeMatch = m.text.match(/(?:confirmation code is|reservation code is|code is|booking code is)\s*([A-Za-z0-9]{5,7})/i);
        if (codeMatch) {
          confirmationCode = codeMatch[1].toUpperCase();
          isBooked = true;
        }
      }
      if (!callerEmail) {
        const match = m.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) callerEmail = match[0];
      }
    }

    // 2. Context-aware name extraction: Check if agent explicitly asked for caller's name
    for (let i = 0; i < msgs.length - 1; i++) {
      const current = msgs[i];
      const next = msgs[i + 1];
      if (current.who === "agent" && next.who === "user") {
        const agentQ = current.text.toLowerCase();
        if (
          agentQ.includes("may i have your name") ||
          agentQ.includes("may i have your full name") ||
          agentQ.includes("what is your name") ||
          agentQ.includes("what's your name") ||
          agentQ.includes("can i have your name") ||
          agentQ.includes("can i get your name") ||
          agentQ.includes("who am i speaking with")
        ) {
          const candidate = next.text
            .replace(/^(my name is|this is|i am|it's|it is)\s+/i, "")
            .replace(/[?.!,]/g, "")
            .trim();
          if (isValidPersonName(candidate)) {
            callerName = candidate;
            break;
          }
        }
      }
    }

    // 3. Fallback: Check for explicit self-introduction ("My name is X")
    if (!callerName) {
      for (const m of msgs) {
        if (m.who === "user") {
          const match = m.text.match(/(?:my name is|this is|i am|call me|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
          if (match && isValidPersonName(match[1])) {
            callerName = match[1].trim();
            break;
          }
        }
      }
    }

    // 4. Fallback: Agent repeated the name in confirmation ("All set, Ravi!" or "Thanks, Ravi.")
    if (!callerName) {
      for (const m of msgs) {
        if (m.who === "agent") {
          const match = m.text.match(/(?:thanks|thank you|all set|perfect|welcome)[,\s]+([A-Z][a-z]+)[!.,]/i);
          if (match && isValidPersonName(match[1])) {
            callerName = match[1].trim();
            break;
          }
        }
      }
    }

    const elapsed = timerStartRef.current
      ? Math.max(5, Math.floor((Date.now() - timerStartRef.current) / 1000))
      : 30;

    try {
      await fetch("/api/conversations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionIdRef.current || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          business_id: business.id,
          caller_name: callerName || null,
          caller_email: callerEmail || null,
          confirmation_code: confirmationCode || null,
          started_at: new Date(Date.now() - elapsed * 1000).toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: elapsed,
          status: isBooked ? "booked" : "completed",
          outcome: isBooked ? "appointment_scheduled" : "inquiry",
          transcript: msgs.map((m) => ({ who: m.who, text: m.text })),
          tool_calls: [],
        }),
      });
    } catch (err) {
      console.error("[VoiceTester] Failed to save conversation transcript:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (messagesRef.current.length > 1) {
        saveConversationRecord();
      }
    };
  }, []);

  const handleEndCall = () => {
    saveConversationRecord();
    if (voiceClientRef.current) {
      voiceClientRef.current.stop();
      voiceClientRef.current = null;
    }
    setCallStatus("idle");
    setIsThinking(false);
    stopTimer();
    bookingFinalizedRef.current = false;
    awaitingEmailConfirmRef.current = false;
    setShowEmailBar(false);
    setEmailError("");
    setEmailSuccess("");
  };

  const handleReset = () => {
    handleEndCall();
    setIsThinking(false);
    bookingFinalizedRef.current = false;
    awaitingEmailConfirmRef.current = false;
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
      setIsThinking(true);

      awaitingEmailConfirmRef.current = true;
      setEmailInput("");
      setShowEmailBar(false);
      setEmailSuccess("");
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
  const hostUrl =
    deployedUrl ||
    (typeof window !== "undefined" && !window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://omni-desk-rho.vercel.app");
  const agentId = business.assemblyai_agent_id || "";

  const scriptSnippet = `<!-- OmniDesk Autonomous Voice Receptionist -->
<script
  src="https://cdn.jsdelivr.net/npm/omnidesk-voice@0.1.17/dist/widget.global.global.js"
  onerror="this.onerror=null;this.src='${hostUrl}/widget.js'"
  data-host="${hostUrl}"
  data-business-id="${business.id}"
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
      host="${hostUrl}"
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
        alignItems: "start",
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
          background: isDark ? "#09090b" : "#ffffff",
          border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
          borderRadius: "20px",
          boxShadow: isExpanded
            ? "0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)"
            : isDark
            ? "0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)"
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
            background: isDark ? "#18181b" : "#ffffff",
            color: isDark ? "#ffffff" : "#09090b",
            borderBottom: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
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
                background: isDark ? "rgba(255,255,255,0.15)" : `${widgetAccent}18`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: isDark ? "#ffffff" : (widgetAccent === "#18181b" ? "#09090b" : widgetAccent),
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
              <div style={{ fontSize: "13.5px", fontWeight: 600, color: isDark ? "#ffffff" : "#09090b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {business.name}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: isDark ? "rgba(255,255,255,0.75)" : "#71717a" }}>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background:
                      callStatus === "live"
                        ? isThinking
                          ? "#f59e0b"
                          : "#22c55e"
                        : callStatus === "busy"
                        ? "#eab308"
                        : isDark
                        ? "rgba(255,255,255,0.4)"
                        : "#a1a1aa",
                    animation: isThinking ? "omnidesk-pulse-amber 1.5s infinite" : "none",
                  }}
                />
                <span>
                  {callStatus === "live"
                    ? isThinking
                      ? "Thinking · Checking tools..."
                      : "Live · Speaking"
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
              onClick={handleReset}
              title="Reset Conversation"
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
            minHeight: 0,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: isDark ? "#09090b" : "#ffffff",
          }}
          ref={feedContainerRef}
        >
          {/* Placeholder in Gray Background */}
          {messages.length === 0 && (
            <div
              style={{
                margin: "auto",
                textAlign: "center",
                padding: "10px 18px",
                background: isDark ? "#18181b" : "#f4f4f5",
                border: isDark ? "1px solid #27272a" : "1px solid #e4e4e7",
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
                  background: callStatus === "live" ? "#22c55e" : widgetAccent,
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
                    background: m.who === "agent" ? (isDark ? "#18181b" : "#f4f4f5") : widgetAccent,
                    color: m.who === "agent" ? (isDark ? "#fafafa" : "#09090b") : "#ffffff",
                    border: m.who === "agent" && isDark ? "1px solid #27272a" : "none",
                    boxShadow: m.who === "agent" ? "0 1px 2px rgba(0,0,0,0.04)" : `0 2px 8px ${widgetAccent}35`,
                  }}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}

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
                {emailError}
              </div>
            )}
            {emailSuccess && (
              <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 600 }}>
                ✓ {emailSuccess}
              </div>
            )}
          </div>
        )}

        {/* Bottom Call Bar */}
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
            onClick={handleToggleCall}
            disabled={!isDeployed || callStatus === "busy"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              background: callStatus === "live"
                ? "#dc2626"
                : callStatus === "busy"
                ? "#64748b"
                : widgetAccent,
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: callStatus === "live"
                ? "0 4px 14px rgba(220, 38, 38, 0.35)"
                : `0 4px 14px ${widgetAccent}40`,
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
                      background: widgetAccent,
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
                background: isDark ? "#18181b" : (callStatus === "live" ? "#000000" : "#f4f4f5"),
                color: isDark ? "#ffffff" : (callStatus === "live" ? "#ffffff" : "#71717a"),
                border: isDark ? "1px solid #27272a" : "none",
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
            background: isDark ? "#09090b" : "#f4f4f5",
            borderTop: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: widgetPos === "bottom-right" ? "flex-end" : "flex-start",
          }}
        >
          <button
            type="button"
            onClick={handleToggleCall}
            disabled={!isDeployed || callStatus === "busy"}
            title={callStatus === "live" ? "Click to end voice call" : "Click to launch test call"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: isDark ? "#18181b" : "#ffffff",
              color: isDark ? "#fafafa" : "#09090b",
              border: `1.5px solid ${widgetAccent === "#18181b" ? (isDark ? "#3f3f46" : "#e4e4e7") : widgetAccent}`,
              padding: "7px 16px",
              borderRadius: "9999px",
              fontSize: "12.5px",
              fontWeight: 600,
              boxShadow: widgetAccent === "#18181b"
                ? "0 4px 12px rgba(0,0,0,0.12)"
                : `0 4px 14px ${widgetAccent}35`,
              cursor: !isDeployed || callStatus === "busy" ? "not-allowed" : "pointer",
              userSelect: "none",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (isDeployed && callStatus !== "busy") {
                e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: callStatus === "live" ? "#ef4444" : widgetAccent,
                boxShadow: `0 0 8px ${callStatus === "live" ? "#ef4444" : widgetAccent}`,
                display: "inline-block",
              }}
            />
            <span>{callStatus === "live" ? "End Call (Live)" : (widgetLabel || "Talk to Receptionist")}</span>
            <span style={{ fontSize: "11px", opacity: 0.6 }}>{callStatus === "live" ? "▼" : "▲"}</span>
          </button>
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
          minHeight: "680px",
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

          <div style={{ flex: "1 1 100%" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Accent Color:</span>
              <span style={{ fontSize: "11px", fontFamily: "var(--mono, monospace)", color: "var(--text)", fontWeight: 500 }}>
                {widgetAccent}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {ACCENT_COLORS.map((c) => {
                const isSelected = widgetAccent.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setWidgetAccent(c.hex)}
                    title={c.label}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: c.hex,
                      border: isSelected ? "2px solid #ffffff" : "1px solid rgba(0,0,0,0.15)",
                      boxShadow: isSelected ? `0 0 0 2px ${c.hex}` : "none",
                      cursor: "pointer",
                      transform: isSelected ? "scale(1.15)" : "scale(1)",
                      transition: "all 0.15s ease",
                      padding: 0,
                    }}
                  />
                );
              })}

              {/* Custom Color Picker Swatch & Hex input */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "4px", paddingLeft: "8px", borderLeft: "1px solid var(--border)" }}>
                <label
                  title="Pick your own custom color"
                  style={{
                    position: "relative",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: widgetAccent,
                    border: "2px solid #ffffff",
                    boxShadow: "0 0 0 1.5px var(--border)",
                    cursor: "pointer",
                    display: "inline-block",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="color"
                    value={widgetAccent.startsWith("#") && widgetAccent.length === 7 ? widgetAccent : "#7c3aed"}
                    onChange={(e) => setWidgetAccent(e.target.value)}
                    style={{
                      position: "absolute",
                      top: "-50%",
                      left: "-50%",
                      width: "200%",
                      height: "200%",
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={widgetAccent}
                  onChange={(e) => setWidgetAccent(e.target.value)}
                  placeholder="#7c3aed"
                  maxLength={7}
                  style={{
                    width: "72px",
                    fontSize: "11px",
                    fontFamily: "var(--mono, monospace)",
                    fontWeight: 600,
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "#ffffff",
                    color: "var(--text)",
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                />
              </div>
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

