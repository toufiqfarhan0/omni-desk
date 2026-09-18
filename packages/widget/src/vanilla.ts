import { VanillaOmniDeskConfig, CallStatus, TranscriptMessage, VoiceSessionTokenResponse } from "./types";
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

const FREQ_BARS = [8, 14, 18, 11, 16, 20, 12, 6, 15];

export function initOmniDeskWidget(config: VanillaOmniDeskConfig = {}) {
  if (typeof window === "undefined") return;

  const {
    host,
    businessId = "biz_demo_dental",
    agentId: propAgentId,
    theme = "dark",
    position = "bottom-right",
    label = "Talk to Receptionist",
    accent = "emerald",
    accentColor,
    businessName: propBusinessName,
    greeting: propGreeting,
    onCallStart,
    onCallEnd,
    onTranscript,
  } = config;

  const activeAccent = accentColor || ACCENT_MAP[accent] || accent || "#10b981";

  // Prevent duplicate mounts
  const existing = document.getElementById("omnidesk-voice-widget-root");
  if (existing) existing.remove();

  const root = document.createElement("div");
  root.id = "omnidesk-voice-widget-root";
  root.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const colors = {
    bg: isDark ? "#18181b" : "#ffffff",
    headerBg: isDark ? "#09090b" : "#f4f4f5",
    border: isDark ? "#27272a" : "#e4e4e7",
    text: isDark ? "#fafafa" : "#09090b",
    textMuted: isDark ? "#a1a1aa" : "#71717a",
    bubbleAgent: isDark ? "#27272a" : "#f4f4f5",
    bubbleUser: activeAccent,
    userText: "#ffffff",
    agentText: isDark ? "#f4f4f5" : "#09090b",
  };

  let client: AssemblyAIVoiceClient | null = null;
  let callStatus: CallStatus = "idle";
  let callStartTime = 0;
  let isOpen = false;
  let userLevel = 0;
  let agentLevel = 0;

  const isLeft = position === "bottom-left";
  const defaultGreeting = propGreeting || "Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?";

  // Floating Trigger Container
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = `
    position: fixed; bottom: 20px; ${isLeft ? "left: 20px;" : "right: 20px;"};
    z-index: 999999;
  `;

  // Trigger Button matching Image 1
  const btn = document.createElement("button");
  btn.style.cssText = `
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${colors.bg}; color: ${colors.text};
    border: 1px solid ${colors.border};
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `;
  btn.innerHTML = `
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${activeAccent};box-shadow:0 0 8px ${activeAccent};display:inline-block;"></span>
    <span>${label}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">▲</span>
  `;
  btnContainer.appendChild(btn);

  // Modal Container matching Image 1
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; bottom: 70px; ${isLeft ? "left: 20px;" : "right: 20px;"};
    width: 320px; height: 280px;
    background: ${colors.bg}; border: 1px solid ${colors.border};
    border-radius: 18px; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Header matching Image 1
  const header = document.createElement("div");
  header.style.cssText = `
    padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${colors.headerBg};
  `;
  header.innerHTML = `
    <div>
      <div style="font-size:13px;font-weight:700;color:${colors.text};" id="omnidesk-biz-title">${propBusinessName || "OmniDesk AI Receptionist"}</div>
      <div style="font-size:10.5px;color:${activeAccent};font-weight:600;" id="omnidesk-status-text">Ready to connect</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${colors.textMuted};cursor:pointer;padding:4px;font-size:14px;" title="Close">✕</button>
  `;

  // Transcript Area
  const transcriptArea = document.createElement("div");
  transcriptArea.style.cssText = `
    flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;
  `;

  // Initial greeting bubble
  const greetingBubble = document.createElement("div");
  greetingBubble.style.cssText = `
    align-self: flex-start; background: ${colors.bubbleAgent}; color: ${colors.agentText};
    padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
  `;
  greetingBubble.innerText = defaultGreeting;
  transcriptArea.appendChild(greetingBubble);

  // Footer matching Image 1
  const footer = document.createElement("div");
  footer.style.cssText = `
    padding: 10px 14px; border-top: 1px solid ${colors.border};
    display: flex; align-items: center; justify-content: space-between;
  `;

  // Waveform dots container
  const waveformContainer = document.createElement("div");
  waveformContainer.style.cssText = `
    display: flex; align-items: center; gap: 3px; height: 18px;
  `;
  FREQ_BARS.forEach(() => {
    const bar = document.createElement("div");
    bar.className = "omnidesk-freq-bar";
    bar.style.cssText = `
      width: 3px; height: 4px; border-radius: 2px;
      background: ${activeAccent}; opacity: 0.7; transition: height 0.15s ease;
    `;
    waveformContainer.appendChild(bar);
  });

  const actionBtn = document.createElement("button");
  actionBtn.style.cssText = `
    padding: 7px 16px; border-radius: 9999px; border: none;
    background: ${activeAccent}; color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 2px 8px rgba(16,185,129,0.3); transition: all 0.15s ease;
  `;
  actionBtn.innerText = "Start Call";

  footer.appendChild(waveformContainer);
  footer.appendChild(actionBtn);

  modal.appendChild(header);
  modal.appendChild(transcriptArea);
  modal.appendChild(footer);

  root.appendChild(btnContainer);
  root.appendChild(modal);
  document.body.appendChild(root);

  function updateBars(active: boolean, level: number) {
    const bars = modal.querySelectorAll<HTMLDivElement>(".omnidesk-freq-bar");
    bars.forEach((b, i) => {
      const h = FREQ_BARS[i];
      const activeHeight = active ? Math.max(5, Math.min(18, Math.round(h * (0.35 + level * 1.5)))) : 4;
      b.style.height = `${activeHeight}px`;
      b.style.opacity = active ? "1" : "0.7";
    });
  }

  function toggleWidget(open: boolean) {
    isOpen = open;
    modal.style.display = open ? "flex" : "none";
  }

  btn.onclick = () => {
    toggleWidget(!isOpen);
  };

  header.querySelector("#omnidesk-close-btn")!.addEventListener("click", () => {
    toggleWidget(false);
  });

  async function startCall() {
    const statusText = header.querySelector("#omnidesk-status-text") as HTMLElement;
    const triggerDot = btnContainer.querySelector("#omnidesk-trigger-dot") as HTMLElement;
    statusText.innerText = "Connecting...";
    actionBtn.innerText = "Connecting...";
    actionBtn.disabled = true;

    try {
      const cleanHost = host ? host.replace(/\/$/, "") : (typeof window !== "undefined" ? window.location.origin : "");
      const res = await fetch(`${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) throw new Error("Failed to get session token");
      const data: VoiceSessionTokenResponse = await res.json();

      if (data.business_name && !propBusinessName) {
        const title = header.querySelector("#omnidesk-biz-title") as HTMLElement;
        if (title) title.innerText = `${data.business_name} AI Receptionist`;
      }

      const targetAgentId = propAgentId || data.agent_id || "";

      client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          callStatus = status;
          if (status === "connected") {
            statusText.innerText = "Live Voice Call (24kHz)";
            actionBtn.innerText = "End Call";
            actionBtn.style.background = "#ef4444";
            actionBtn.style.boxShadow = "0 2px 8px rgba(239,68,68,0.3)";
            actionBtn.disabled = false;
            if (triggerDot) {
              triggerDot.style.background = "#ef4444";
              triggerDot.style.boxShadow = "0 0 8px #ef4444";
            }
            callStartTime = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            statusText.innerText = "Ready to connect";
            actionBtn.innerText = "Start Call";
            actionBtn.style.background = activeAccent;
            actionBtn.style.boxShadow = "0 2px 8px rgba(16,185,129,0.3)";
            actionBtn.disabled = false;
            if (triggerDot) {
              triggerDot.style.background = activeAccent;
              triggerDot.style.boxShadow = `0 0 8px ${activeAccent}`;
            }
            updateBars(false, 0);
            if (callStartTime > 0) {
              const dur = Math.round((Date.now() - callStartTime) / 1000);
              callStartTime = 0;
              onCallEnd?.(dur);
            }
          }
        },
        onTranscript: (msg: TranscriptMessage) => {
          const bubble = document.createElement("div");
          const isUser = msg.who === "user";
          bubble.style.cssText = `
            align-self: ${isUser ? "flex-end" : "flex-start"};
            background: ${isUser ? colors.bubbleUser : colors.bubbleAgent};
            color: ${isUser ? colors.userText : colors.agentText};
            padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
          `;
          bubble.innerText = msg.text;
          transcriptArea.appendChild(bubble);
          transcriptArea.scrollTop = transcriptArea.scrollHeight;
          onTranscript?.(msg);
        },
        onAudioLevel: (u, a) => {
          userLevel = u;
          agentLevel = a;
          updateBars(callStatus === "connected", Math.max(u, a));
        },
        onError: (err) => {
          statusText.innerText = "Connection error";
          actionBtn.innerText = "Start Call";
          actionBtn.style.background = activeAccent;
          actionBtn.disabled = false;
          updateBars(false, 0);
        },
      });

      await client.start(data.token, targetAgentId);
    } catch (err: any) {
      statusText.innerText = "Connection failed";
      actionBtn.innerText = "Start Call";
      actionBtn.style.background = activeAccent;
      actionBtn.disabled = false;
      updateBars(false, 0);
    }
  }

  function endCall() {
    if (client) {
      client.stop();
      client = null;
    }
    callStatus = "idle";
    updateBars(false, 0);
  }

  actionBtn.onclick = () => {
    if (callStatus === "connected") {
      endCall();
    } else if (callStatus === "idle") {
      startCall();
    }
  };

  return {
    destroy: () => {
      if (client) client.stop();
      root.remove();
    },
    startCall,
    endCall,
  };
}

// Auto-run if loaded via script tag with data attributes
if (typeof document !== "undefined") {
  const currentScript =
    document.currentScript ||
    document.querySelector("script[data-agent], script[data-business-id]");
  if (currentScript) {
    const businessId = currentScript.getAttribute("data-business-id") || undefined;
    const agentId = currentScript.getAttribute("data-agent") || undefined;
    const theme = (currentScript.getAttribute("data-theme") as any) || "dark";
    const accent = (currentScript.getAttribute("data-accent") as any) || "emerald";
    const position = (currentScript.getAttribute("data-position") as any) || "bottom-right";
    const label = currentScript.getAttribute("data-label") || undefined;
    const host = currentScript.getAttribute("data-host") || undefined;
    const greeting = currentScript.getAttribute("data-greeting") || undefined;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initOmniDeskWidget({ businessId, agentId, theme, accent, position, label, host, greeting });
      });
    } else {
      initOmniDeskWidget({ businessId, agentId, theme, accent, position, label, host, greeting });
    }
  }
}
