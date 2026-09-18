import { VanillaOmniDeskConfig, CallStatus, TranscriptMessage, VoiceSessionTokenResponse } from "./types";
import { AssemblyAIVoiceClient } from "./audio-client";

export function initOmniDeskWidget(config: VanillaOmniDeskConfig) {
  if (typeof window === "undefined") return;

  const {
    host,
    businessId = "biz_demo_dental",
    theme = "dark",
    position = "bottom-right",
    label = "Talk to Receptionist",
    accentColor = "#10b981",
    onCallStart,
    onCallEnd,
    onTranscript,
  } = config;

  // Prevent duplicate mounts
  const existing = document.getElementById("omnidesk-voice-widget-root");
  if (existing) existing.remove();

  const root = document.createElement("div");
  root.id = "omnidesk-voice-widget-root";
  root.style.position = "fixed";
  root.style.bottom = "24px";
  if (position === "bottom-left") {
    root.style.left = "24px";
  } else {
    root.style.right = "24px";
  }
  root.style.zIndex = "999999";
  root.style.fontFamily = "system-ui, -apple-system, sans-serif";

  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const colors = {
    bg: isDark ? "#09090b" : "#ffffff",
    cardBg: isDark ? "#18181b" : "#f4f4f5",
    border: isDark ? "#27272a" : "#e4e4e7",
    text: isDark ? "#fafafa" : "#09090b",
    textMuted: isDark ? "#a1a1aa" : "#71717a",
    bubbleAgent: isDark ? "#27272a" : "#f4f4f5",
    bubbleUser: accentColor,
    userText: "#ffffff",
  };

  let client: AssemblyAIVoiceClient | null = null;
  let callStatus: CallStatus = "idle";
  let isMuted = false;
  let callStartTime = 0;

  // Trigger Button
  const btn = document.createElement("button");
  btn.style.cssText = `
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${colors.bg}; color: ${colors.text};
    border: 1px solid ${colors.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `;
  btn.innerHTML = `
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${label}</span>
  `;

  // Modal Container
  const modal = document.createElement("div");
  modal.style.cssText = `
    width: 360px; height: 520px;
    background: ${colors.bg}; border: 1px solid ${colors.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
    display: none; flex-direction: column; overflow: hidden;
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    padding: 16px 20px; border-bottom: 1px solid ${colors.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${colors.cardBg};
  `;
  header.innerHTML = `
    <div>
      <div style="font-weight:700;font-size:14px;color:${colors.text};" id="omnidesk-biz-title">AI Receptionist</div>
      <div style="font-size:11px;color:${colors.textMuted};margin-top:2px;" id="omnidesk-status-text">Ready</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${colors.textMuted};cursor:pointer;font-size:16px;">✕</button>
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

  const actionBtn = document.createElement("button");
  actionBtn.style.cssText = `
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${accentColor}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  `;
  actionBtn.innerText = "Start Call";
  footer.appendChild(actionBtn);

  modal.appendChild(header);
  modal.appendChild(transcriptArea);
  modal.appendChild(footer);

  root.appendChild(btn);
  root.appendChild(modal);
  document.body.appendChild(root);

  // Toggle Visibility
  btn.onclick = () => {
    btn.style.display = "none";
    modal.style.display = "flex";
    if (callStatus === "idle") {
      startCall();
    }
  };

  header.querySelector("#omnidesk-close-btn")!.addEventListener("click", () => {
    modal.style.display = "none";
    btn.style.display = "flex";
  });

  async function startCall() {
    const statusText = header.querySelector("#omnidesk-status-text") as HTMLElement;
    statusText.innerText = "Connecting...";
    actionBtn.innerText = "Connecting...";
    actionBtn.disabled = true;

    try {
      const cleanHost = host.replace(/\/$/, "");
      const res = await fetch(`${cleanHost}/api/token?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) throw new Error("Failed to get session token");
      const data: VoiceSessionTokenResponse = await res.json();

      if (data.business_name) {
        const title = header.querySelector("#omnidesk-biz-title") as HTMLElement;
        if (title) title.innerText = data.business_name;
      }

      client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => {
          callStatus = status;
          if (status === "connected") {
            statusText.innerText = "Live Receptionist";
            actionBtn.innerText = "End Call";
            actionBtn.style.background = "#ef4444";
            actionBtn.disabled = false;
            callStartTime = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            statusText.innerText = "Call Ended";
            actionBtn.innerText = "Start Call";
            actionBtn.style.background = accentColor;
            actionBtn.disabled = false;
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
            <div style="max-width:80%;padding:9px 13px;border-radius:${isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px"};background:${isUser ? colors.bubbleUser : colors.bubbleAgent};color:${isUser ? colors.userText : colors.text};font-size:13px;line-height:1.4;">
              ${msg.text}
            </div>
          `;
          transcriptArea.appendChild(bubble);
          transcriptArea.scrollTop = transcriptArea.scrollHeight;
          onTranscript?.(msg);
        },
        onError: (err) => {
          statusText.innerText = `Error: ${err}`;
          actionBtn.innerText = "Start Call";
          actionBtn.style.background = accentColor;
          actionBtn.disabled = false;
        },
      });

      await client.start(data.token, data.agent_id);
    } catch (err: any) {
      statusText.innerText = err.message || "Connection failed";
      actionBtn.innerText = "Start Call";
      actionBtn.style.background = accentColor;
      actionBtn.disabled = false;
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
