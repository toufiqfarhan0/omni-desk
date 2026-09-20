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
  root.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  let client: AssemblyAIVoiceClient | null = null;
  let callStatus: CallStatus = "idle";
  let callStartTime = 0;
  let timerInterval: any = null;
  let isOpen = false;
  let isExpanded = false;
  let userLevel = 0;
  let agentLevel = 0;

  const isLeft = position === "bottom-left";

  // Floating Trigger Container
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = `
    position: fixed; bottom: 20px; ${isLeft ? "left: 20px;" : "right: 20px;"};
    z-index: 999999;
  `;

  // Trigger Button
  const btn = document.createElement("button");
  btn.style.cssText = `
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${isDark ? "#18181b" : "#ffffff"}; color: ${isDark ? "#fafafa" : "#09090b"};
    border: 1px solid ${isDark ? "#27272a" : "#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `;
  btn.innerHTML = `
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${activeAccent};box-shadow:0 0 8px ${activeAccent};display:inline-block;"></span>
    <span>${label}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">▲</span>
  `;
  btnContainer.appendChild(btn);

  // Modal Backdrop
  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `;
  backdrop.onclick = () => toggleExpand(false);

  // Modal Container matching Reference Image
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; bottom: 80px; ${isLeft ? "left: 20px;" : "right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Topbar
  const header = document.createElement("div");
  header.style.cssText = `
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: rgba(255,255,255,0.6); display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.15); display: grid; place-items: center; flex-shrink: 0; color: #ffffff;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flexDirection: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${propBusinessName || "OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.75);">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle · Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: #ffffff; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: #ffffff; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;

  // Transcript Area (Pure White)
  const transcriptArea = document.createElement("div");
  transcriptArea.style.cssText = `
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;

  // Placeholder in Gray Background
  const placeholderBanner = document.createElement("div");
  placeholderBanner.id = "omnidesk-placeholder-banner";
  placeholderBanner.style.cssText = `
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `;
  placeholderBanner.innerHTML = `
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `;
  transcriptArea.appendChild(placeholderBanner);

  // Bottom Call Bar matching Reference Image
  const footer = document.createElement("div");
  footer.style.cssText = `
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;

  // Action Button
  const actionBtn = document.createElement("button");
  actionBtn.style.cssText = `
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `;
  actionBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;

  // Right status container (waveform + duration)
  const statusContainer = document.createElement("div");
  statusContainer.style.cssText = `
    display: flex; align-items: center; gap: 8px;
  `;

  const durationBadge = document.createElement("span");
  durationBadge.id = "omnidesk-timer";
  durationBadge.style.cssText = `
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `;
  durationBadge.innerText = "0:00";

  statusContainer.appendChild(durationBadge);

  footer.appendChild(actionBtn);
  footer.appendChild(statusContainer);

  modal.appendChild(header);
  modal.appendChild(transcriptArea);
  modal.appendChild(footer);

  root.appendChild(btnContainer);
  root.appendChild(backdrop);
  root.appendChild(modal);
  document.body.appendChild(root);

  function startTimer() {
    callStartTime = Date.now();
    durationBadge.innerText = "0:00";
    durationBadge.style.background = "#000000";
    durationBadge.style.color = "#ffffff";
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const ms = Date.now() - callStartTime;
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      durationBadge.innerText = `${m}:${String(s).padStart(2, "0")}`;
    }, 250);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    durationBadge.style.background = "#f4f4f5";
    durationBadge.style.color = "#71717a";
    durationBadge.innerText = "0:00";
  }

  function toggleWidget(open: boolean) {
    isOpen = open;
    modal.style.display = open ? "flex" : "none";
  }

  function toggleExpand(expand: boolean) {
    isExpanded = expand;
    backdrop.style.display = expand ? "block" : "none";
    if (expand) {
      modal.style.top = "50%";
      modal.style.left = "50%";
      modal.style.bottom = "auto";
      modal.style.right = "auto";
      modal.style.transform = "translate(-50%, -50%)";
      modal.style.width = "calc(100vw - 40px)";
      modal.style.maxWidth = "1140px";
      modal.style.height = "calc(100vh - 40px)";
      modal.style.maxHeight = "900px";
    } else {
      modal.style.top = "auto";
      modal.style.left = isLeft ? "20px" : "auto";
      modal.style.right = isLeft ? "auto" : "20px";
      modal.style.bottom = "80px";
      modal.style.transform = "none";
      modal.style.width = "390px";
      modal.style.maxWidth = "calc(100vw - 32px)";
      modal.style.height = "560px";
      modal.style.maxHeight = "calc(100vh - 100px)";
    }
  }

  btn.onclick = () => toggleWidget(!isOpen);
  header.querySelector("#omnidesk-close-btn")!.addEventListener("click", () => {
    toggleWidget(false);
    toggleExpand(false);
  });
  header.querySelector("#omnidesk-expand-btn")!.addEventListener("click", () => {
    toggleExpand(!isExpanded);
  });

  async function startCall() {
    const statusText = header.querySelector("#omnidesk-status-text") as HTMLElement;
    const statusDot = header.querySelector("#omnidesk-status-dot") as HTMLElement;
    const btnText = actionBtn.querySelector("#omnidesk-btn-text") as HTMLElement;
    statusText.innerText = "Connecting...";
    statusDot.style.background = "#eab308";
    btnText.innerText = "Connecting...";
    actionBtn.disabled = true;
    startTimer();

    try {
      let hostToUse = host;
      if (!hostToUse && typeof document !== "undefined") {
        const scriptEl = document.querySelector("script[src*='widget.js']") as HTMLScriptElement;
        if (scriptEl && scriptEl.src && scriptEl.src.startsWith("http")) {
          try {
            hostToUse = new URL(scriptEl.src).origin;
          } catch {}
        }
      }
      if (!hostToUse && typeof window !== "undefined" && !window.location.origin.includes("localhost")) {
        hostToUse = window.location.origin;
      }
      const cleanHost = (hostToUse || "https://omni-desk-rho.vercel.app").replace(/\/$/, "");
      const res = await fetch(`${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) throw new Error(`Failed to get session token (${res.status})`);
      const data: VoiceSessionTokenResponse = await res.json();

      if (data.business_name && !propBusinessName) {
        const title = header.querySelector("#omnidesk-biz-title") as HTMLElement;
        if (title) title.innerText = data.business_name;
      }

      const targetAgentId = propAgentId || data.agent_id || "";

      client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          callStatus = status;
          if (status === "connected") {
            statusText.innerText = "Live · Speaking";
            statusDot.style.background = "#22c55e";
            btnText.innerText = "End Voice Call";
            actionBtn.style.background = "#dc2626";
            actionBtn.disabled = false;
            callStartTime = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            statusText.innerText = "Idle · Ready";
            statusDot.style.background = "rgba(255,255,255,0.4)";
            btnText.innerText = "Start Voice Call";
            actionBtn.style.background = "#000000";
            actionBtn.disabled = false;
            stopTimer();
            if (callStartTime > 0) {
              const dur = Math.round((Date.now() - callStartTime) / 1000);
              callStartTime = 0;
              onCallEnd?.(dur);
            }
          }
        },
        onTranscript: (msg: TranscriptMessage) => {
          placeholderBanner.style.display = "none";
          const bubbleContainer = document.createElement("div");
          const isUser = msg.who === "user";
          bubbleContainer.style.cssText = `
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${isUser ? "flex-end" : "flex-start"};
          `;

          const inner = document.createElement("div");
          inner.style.cssText = `
            padding: 10px 14px; border-radius: ${isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${isUser ? "#18181b" : "#f4f4f5"};
            color: ${isUser ? "#ffffff" : "#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `;
          inner.innerText = msg.text;
          bubbleContainer.appendChild(inner);
          transcriptArea.appendChild(bubbleContainer);
          transcriptArea.scrollTop = transcriptArea.scrollHeight;
          onTranscript?.(msg);
        },
        onAudioLevel: (u, a) => {
          userLevel = u;
          agentLevel = a;
        },
        onError: () => {
          statusText.innerText = "Error";
          statusDot.style.background = "#ef4444";
          btnText.innerText = "Start Voice Call";
          actionBtn.style.background = "#000000";
          actionBtn.disabled = false;
          stopTimer();
        },
      });

      await client.start(data.token, targetAgentId);
    } catch (err: any) {
      console.error("[OmniDesk Voice Widget Error]:", err);
      statusText.innerText = "Error";
      statusDot.style.background = "#ef4444";
      btnText.innerText = "Start Voice Call";
      actionBtn.style.background = "#000000";
      actionBtn.disabled = false;
      stopTimer();
    }
  }

  function endCall() {
    if (client) {
      client.stop();
      client = null;
    }
    callStatus = "idle";
    stopTimer();
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
      stopTimer();
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
    document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");
  if (currentScript) {
    let autoHost: string | undefined;
    const scriptSrc = (currentScript as HTMLScriptElement).src || "";
    if (scriptSrc && scriptSrc.startsWith("http")) {
      try {
        autoHost = new URL(scriptSrc).origin;
      } catch {}
    }
    const businessId = currentScript.getAttribute("data-business-id") || undefined;
    const agentId = currentScript.getAttribute("data-agent") || undefined;
    const theme = (currentScript.getAttribute("data-theme") as any) || "dark";
    const accent = (currentScript.getAttribute("data-accent") as any) || "emerald";
    const position = (currentScript.getAttribute("data-position") as any) || "bottom-right";
    const label = currentScript.getAttribute("data-label") || undefined;
    const host = currentScript.getAttribute("data-host") || autoHost || "https://omni-desk-rho.vercel.app";
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
