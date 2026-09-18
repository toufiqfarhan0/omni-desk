import { VanillaOmniDeskConfig, CallStatus, TranscriptMessage, VoiceSessionTokenResponse } from "./types";
import { AssemblyAIVoiceClient } from "./audio-client";

const ACCENT_MAP: Record<string, string> = {
  slate: "#18181b",
  purple: "#7c3aed",
  blue: "#2563eb",
  emerald: "#059669",
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
    accent = "slate",
    accentColor,
    suggestions,
    onCallStart,
    onCallEnd,
    onTranscript,
  } = config;

  const activeAccent = accentColor || ACCENT_MAP[accent] || accent || "#18181b";

  // Prevent duplicate mounts
  const existing = document.getElementById("omnidesk-voice-widget-root");
  if (existing) existing.remove();

  const root = document.createElement("div");
  root.id = "omnidesk-voice-widget-root";
  root.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const colors = {
    bg: isDark ? "#09090b" : "#ffffff",
    cardBg: isDark ? "#121215" : "#f4f4f5",
    border: isDark ? "#27272a" : "#e4e4e7",
    text: isDark ? "#fafafa" : "#09090b",
    textMuted: isDark ? "#a1a1aa" : "#71717a",
    bubbleAgent: isDark ? "#18181b" : "#f4f4f5",
    bubbleUser: activeAccent,
    userText: "#ffffff",
  };

  let client: AssemblyAIVoiceClient | null = null;
  let callStatus: CallStatus = "idle";
  let isMuted = false;
  let callStartTime = 0;
  let isExpanded = false;

  const isLeft = position === "bottom-left";

  // Floating Trigger Container
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = `
    position: fixed; bottom: 24px; ${isLeft ? "left: 24px;" : "right: 24px;"}
    z-index: 999999;
  `;

  // Trigger Button
  const btn = document.createElement("button");
  btn.style.cssText = `
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${colors.bg}; color: ${colors.text};
    border: 1px solid ${colors.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `;
  btn.innerHTML = `
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${label}</span>
  `;
  btnContainer.appendChild(btn);

  // Backdrop when expanded
  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 999998; display: none;
  `;

  // Modal Container
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; bottom: 24px; ${isLeft ? "left: 24px;" : "right: 24px;"}
    width: 370px; height: 560px; max-height: 85vh;
    background: ${colors.bg}; border: 1px solid ${colors.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    padding: 14px 18px; border-bottom: 1px solid ${colors.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${colors.cardBg};
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 34px; height: 34px; border-radius: 50%; background: ${activeAccent}; color: #fff; display: grid; place-items: center; font-size: 14px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </div>
      <div>
        <div style="font-weight:700;font-size:14px;color:${colors.text};" id="omnidesk-biz-title">AI Receptionist</div>
        <div style="font-size:11px;color:${colors.textMuted};margin-top:2px;display:flex;align-items:center;gap:6px;" id="omnidesk-status-text">
          <span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Ready
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button id="omnidesk-expand-btn" style="background:transparent;border:none;color:${colors.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Expand">⤢</button>
      <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${colors.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Close">✕</button>
    </div>
  `;

  // Transcript Area
  const transcriptArea = document.createElement("div");
  transcriptArea.style.cssText = `
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;

  // Footer Controls
  const footer = document.createElement("div");
  footer.style.cssText = `
    padding: 14px 16px; border-top: 1px solid ${colors.border};
    background: ${colors.cardBg}; display: flex; gap: 10px;
  `;

  const muteBtn = document.createElement("button");
  muteBtn.style.cssText = `
    display: none; flex: 1; padding: 10px; border-radius: 10px; border: 1px solid ${colors.border};
    background: ${colors.bg}; color: ${colors.text}; font-size: 12.5px; font-weight: 600; cursor: pointer;
  `;
  muteBtn.innerText = "Mute Mic";

  const actionBtn = document.createElement("button");
  actionBtn.style.cssText = `
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${activeAccent}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s ease;
  `;
  actionBtn.innerText = "Start Call";

  footer.appendChild(muteBtn);
  footer.appendChild(actionBtn);

  modal.appendChild(header);
  modal.appendChild(transcriptArea);
  modal.appendChild(footer);

  root.appendChild(backdrop);
  root.appendChild(btnContainer);
  root.appendChild(modal);
  document.body.appendChild(root);

  function applyExpansion(expanded: boolean) {
    isExpanded = expanded;
    if (expanded) {
      backdrop.style.display = "block";
      modal.style.top = "50%";
      modal.style.left = "50%";
      modal.style.bottom = "auto";
      modal.style.right = "auto";
      modal.style.transform = "translate(-50%, -50%)";
      modal.style.width = "min(640px, 92vw)";
      modal.style.height = "min(720px, 86vh)";
      modal.style.maxHeight = "800px";
      modal.style.borderRadius = "24px";
      header.querySelector("#omnidesk-expand-btn")!.innerHTML = "↙";
    } else {
      backdrop.style.display = "none";
      modal.style.top = "auto";
      modal.style.left = isLeft ? "24px" : "auto";
      modal.style.bottom = "24px";
      modal.style.right = isLeft ? "auto" : "24px";
      modal.style.transform = "none";
      modal.style.width = "370px";
      modal.style.height = "560px";
      modal.style.maxHeight = "85vh";
      modal.style.borderRadius = "20px";
      header.querySelector("#omnidesk-expand-btn")!.innerHTML = "⤢";
    }
  }

  // Toggle Visibility
  btn.onclick = () => {
    btnContainer.style.display = "none";
    modal.style.display = "flex";
    if (callStatus === "idle") {
      startCall();
    }
  };

  header.querySelector("#omnidesk-close-btn")!.addEventListener("click", () => {
    modal.style.display = "none";
    backdrop.style.display = "none";
    btnContainer.style.display = "block";
    applyExpansion(false);
  });

  header.querySelector("#omnidesk-expand-btn")!.addEventListener("click", () => {
    applyExpansion(!isExpanded);
  });

  backdrop.addEventListener("click", () => {
    applyExpansion(false);
  });

  muteBtn.onclick = () => {
    if (client) {
      isMuted = !isMuted;
      client.setMuted(isMuted);
      muteBtn.innerText = isMuted ? "Unmute Mic" : "Mute Mic";
      muteBtn.style.background = isMuted ? "#ef4444" : colors.bg;
      muteBtn.style.color = isMuted ? "#fff" : colors.text;
    }
  };

  async function startCall() {
    const statusText = header.querySelector("#omnidesk-status-text") as HTMLElement;
    statusText.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Connecting...`;
    actionBtn.innerText = "Connecting...";
    actionBtn.disabled = true;

    try {
      const cleanHost = host ? host.replace(/\/$/, "") : (typeof window !== "undefined" ? window.location.origin : "");
      const res = await fetch(`${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) throw new Error("Failed to get session token");
      const data: VoiceSessionTokenResponse = await res.json();

      if (data.business_name) {
        const title = header.querySelector("#omnidesk-biz-title") as HTMLElement;
        if (title) title.innerText = data.business_name;
      }

      const targetAgentId = propAgentId || data.agent_id || "";

      client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          callStatus = status;
          if (status === "connected") {
            statusText.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Live Receptionist`;
            actionBtn.innerText = "End Call";
            actionBtn.style.background = "#ef4444";
            actionBtn.style.width = "auto";
            actionBtn.style.flex = "1";
            actionBtn.disabled = false;
            muteBtn.style.display = "block";
            callStartTime = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            statusText.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Call Ended`;
            actionBtn.innerText = "Start Call";
            actionBtn.style.background = activeAccent;
            actionBtn.style.width = "100%";
            actionBtn.disabled = false;
            muteBtn.style.display = "none";
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
            display: flex; justify-content: ${isUser ? "flex-end" : "flex-start"};
          `;
          bubble.innerHTML = `
            <div style="max-width:${isExpanded ? "70%" : "82%"};padding:9px 13px;border-radius:${isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px"};background:${isUser ? colors.bubbleUser : colors.bubbleAgent};color:${isUser ? colors.userText : colors.text};font-size:13px;line-height:1.45;">
              ${msg.text}
            </div>
          `;
          transcriptArea.appendChild(bubble);
          transcriptArea.scrollTop = transcriptArea.scrollHeight;
          onTranscript?.(msg);
        },
        onError: (err) => {
          statusText.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Error: ${err}`;
          actionBtn.innerText = "Start Call";
          actionBtn.style.background = activeAccent;
          actionBtn.style.width = "100%";
          actionBtn.disabled = false;
          muteBtn.style.display = "none";
        },
      });

      await client.start(data.token, targetAgentId);
    } catch (err: any) {
      statusText.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> ${err.message || "Connection failed"}`;
      actionBtn.innerText = "Start Call";
      actionBtn.style.background = activeAccent;
      actionBtn.style.width = "100%";
      actionBtn.disabled = false;
      muteBtn.style.display = "none";
    }
  }

  actionBtn.onclick = () => {
    if (callStatus === "connected" && client) {
      client.stop();
      client = null;
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
    const accent = (currentScript.getAttribute("data-accent") as any) || "slate";
    const position = (currentScript.getAttribute("data-position") as any) || "bottom-right";
    const label = currentScript.getAttribute("data-label") || undefined;
    const host = currentScript.getAttribute("data-host") || undefined;

    // Automatically mount when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initOmniDeskWidget({ businessId, agentId, theme, accent, position, label, host });
      });
    } else {
      initOmniDeskWidget({ businessId, agentId, theme, accent, position, label, host });
    }
  }
}
