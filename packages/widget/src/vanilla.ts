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
    theme = "light",
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
  let emailCaptured = false;
  let bookingFinalized = false;
  let awaitingEmailConfirm = false;
  let lastSpeaker: "user" | "agent" | null = null;
  let lastBubbleInner: HTMLElement | null = null;
  let lastMsgWasFinal = false;

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
    background: ${isDark ? "#09090b" : "#ffffff"}; border: 1px solid ${isDark ? "#27272a" : "#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Topbar
  const header = document.createElement("div");
  header.style.cssText = `
    background: ${isDark ? "#18181b" : "#ffffff"}; color: ${isDark ? "#ffffff" : "#09090b"};
    border-bottom: 1px solid ${isDark ? "#27272a" : "#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${isDark ? "rgba(255,255,255,0.6)" : "#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${isDark ? "rgba(255,255,255,0.15)" : (activeAccent === "#18181b" ? "rgba(24,24,27,0.08)" : `${activeAccent}18`)}; display: grid; place-items: center; flex-shrink: 0; color: ${isDark ? "#ffffff" : (activeAccent === "#18181b" ? "#09090b" : activeAccent)};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${isDark ? "#ffffff" : "#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${propBusinessName || "OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${isDark ? "rgba(255,255,255,0.75)" : "#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${isDark ? "rgba(255,255,255,0.4)" : "#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle · Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${isDark ? "rgba(255,255,255,0.1)" : "#f4f4f5"}; border: 1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#e4e4e7"}; border-radius: 7px; color: ${isDark ? "#ffffff" : "#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${isDark ? "rgba(255,255,255,0.1)" : "#f4f4f5"}; border: 1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#e4e4e7"}; border-radius: 7px; color: ${isDark ? "#ffffff" : "#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;

  // Typing dots CSS
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @keyframes omnidesk-typing-dot {
      0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
      40% { transform: translateY(-6px) scale(1.15); opacity: 1; }
    }
    .omnidesk-motion-dot {
      display: inline-block;
      width: 6.5px;
      height: 6.5px;
      border-radius: 50%;
      background-color: currentColor;
      animation: omnidesk-typing-dot 1.25s infinite ease-in-out both;
      will-change: transform, opacity;
    }
    .omnidesk-dot-1 { animation-delay: 0s; }
    .omnidesk-dot-2 { animation-delay: 0.18s; }
    .omnidesk-dot-3 { animation-delay: 0.36s; }
  `;
  root.appendChild(styleEl);

  // Transcript Area
  const transcriptArea = document.createElement("div");
  transcriptArea.style.cssText = `
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${isDark ? "#09090b" : "#ffffff"};
  `;

  // Placeholder in Gray Background
  const placeholderBanner = document.createElement("div");
  placeholderBanner.id = "omnidesk-placeholder-banner";
  placeholderBanner.style.cssText = `
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${isDark ? "#18181b" : "#f4f4f5"}; border: 1px solid ${isDark ? "#27272a" : "#e4e4e7"}; color: ${isDark ? "#a1a1aa" : "#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `;
  placeholderBanner.innerHTML = `
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `;
  transcriptArea.appendChild(placeholderBanner);

  // Animated Thinking Motion Bubble (While tool calling / generating reply)
  const thinkingBubble = document.createElement("div");
  thinkingBubble.id = "omnidesk-thinking-bubble";
  thinkingBubble.style.cssText = `
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `;
  thinkingBubble.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${isDark ? "#18181b" : "#f4f4f5"}; color: ${isDark ? "#a1a1aa" : "#71717a"}; border: ${isDark ? "1px solid #27272a" : "none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `;
  transcriptArea.appendChild(thinkingBubble);

  if (propGreeting) {
    placeholderBanner.style.display = "none";
    const bubbleContainer = document.createElement("div");
    bubbleContainer.style.cssText = `display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;`;
    const row = document.createElement("div");
    row.style.cssText = `display: flex; align-items: flex-start; gap: 8px;`;
    const avatar = document.createElement("div");
    avatar.style.cssText = `width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;`;
    avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>`;
    const inner = document.createElement("div");
    inner.style.cssText = `padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${isDark ? "#18181b" : "#f4f4f5"}; color: ${isDark ? "#fafafa" : "#09090b"}; border: ${isDark ? "1px solid #27272a" : "none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`;
    inner.innerText = propGreeting;
    row.appendChild(avatar);
    row.appendChild(inner);
    bubbleContainer.appendChild(row);
    transcriptArea.insertBefore(bubbleContainer, thinkingBubble);
    lastSpeaker = "agent";
    lastBubbleInner = inner;
    lastMsgWasFinal = true;
  }

  // Live email entry bar
  const emailBar = document.createElement("div");
  emailBar.id = "omnidesk-email-bar";
  emailBar.style.cssText = `
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `;
  emailBar.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: 6px;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        Email Requested by Agent • Auto Verification
      </span>
      <button id="omnidesk-email-close-btn" type="button" style="background: none; border: none; color: #15803d; cursor: pointer; font-size: 12px; font-weight: 700; padding: 1px 4px;">✕</button>
    </div>
    <form id="omnidesk-email-form" style="display: flex; gap: 8px; margin: 0;">
      <input id="omnidesk-email-input" type="email" placeholder="Enter your real email (e.g. name@gmail.com)" required style="flex: 1; font-size: 12.5px; padding: 7px 11px; border-radius: 7px; border: 1px solid #86efac; background: #ffffff; color: #09090b; outline: none;" />
      <button id="omnidesk-email-submit" type="submit" style="background: #16a34a; color: #ffffff; border: none; padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">Verify & Send</button>
    </form>
  `;

  // Bottom Call Bar matching Live Voice Tester
  const footer = document.createElement("div");
  footer.style.cssText = `
    padding: 12px 16px; border-top: 1px solid ${isDark ? "#27272a" : "#e4e4e7"};
    background: ${isDark ? "#121214" : "#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;

  // Action Button
  const actionBtn = document.createElement("button");
  actionBtn.style.cssText = `
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${activeAccent}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${activeAccent}40;
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

  const waveformBox = document.createElement("div");
  waveformBox.id = "omnidesk-waveform";
  waveformBox.style.cssText = `display: none; align-items: center; gap: 2.5px; height: 14px;`;
  const defaultWaveHeights = [12, 8, 14, 6, 10];
  const waveBars: HTMLSpanElement[] = [];
  defaultWaveHeights.forEach((h) => {
    const bar = document.createElement("span");
    bar.style.cssText = `width: 2.5px; height: ${Math.round(h * 0.35)}px; background: ${activeAccent}; border-radius: 1px; transition: height 0.12s ease;`;
    waveformBox.appendChild(bar);
    waveBars.push(bar);
  });
  statusContainer.appendChild(waveformBox);

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
  modal.appendChild(emailBar);
  modal.appendChild(footer);

  root.appendChild(btnContainer);
  root.appendChild(backdrop);
  root.appendChild(modal);
  document.body.appendChild(root);

  function startTimer() {
    callStartTime = Date.now();
    durationBadge.innerText = "0:00";
    durationBadge.style.background = isDark ? "#18181b" : "#000000";
    durationBadge.style.color = "#ffffff";
    durationBadge.style.border = isDark ? "1px solid #27272a" : "none";
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
    durationBadge.style.border = "none";
    durationBadge.innerText = "0:00";
    waveformBox.style.display = "none";
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

  const emailForm = emailBar.querySelector("#omnidesk-email-form") as HTMLFormElement;
  const emailInput = emailBar.querySelector("#omnidesk-email-input") as HTMLInputElement;
  const emailCloseBtn = emailBar.querySelector("#omnidesk-email-close-btn") as HTMLButtonElement;

  emailCloseBtn.addEventListener("click", () => {
    emailBar.style.display = "none";
  });

  emailForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = emailInput.value.trim();
    if (!val || !val.includes("@")) return;

    if (client) {
      client.sendEmailInput(val);
    }
    awaitingEmailConfirm = true;
    emailBar.style.display = "none";
    emailInput.value = "";

    placeholderBanner.style.display = "none";
    const bubbleContainer = document.createElement("div");
    bubbleContainer.style.cssText = `
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;
    const inner = document.createElement("div");
    inner.style.cssText = `
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${activeAccent}; color: #ffffff;
      box-shadow: 0 2px 8px ${activeAccent}35;
    `;
    inner.innerText = `My email is ${val}`;
    bubbleContainer.appendChild(inner);
    transcriptArea.insertBefore(bubbleContainer, thinkingBubble);
    thinkingBubble.style.display = "flex";
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
    lastSpeaker = "user";
    lastBubbleInner = inner;
    lastMsgWasFinal = true;
  });

  async function startCall() {
    emailCaptured = false;
    bookingFinalized = false;
    awaitingEmailConfirm = false;
    emailBar.style.display = "none";
    thinkingBubble.style.display = "none";
    lastSpeaker = null;
    lastBubbleInner = null;
    lastMsgWasFinal = false;

    const statusText = header.querySelector("#omnidesk-status-text") as HTMLElement;
    const statusDot = header.querySelector("#omnidesk-status-dot") as HTMLElement;
    const btnText = actionBtn.querySelector("#omnidesk-btn-text") as HTMLElement;
    statusText.innerText = "Connecting...";
    statusDot.style.background = "#eab308";
    btnText.innerText = "Connecting...";
    actionBtn.style.background = "#64748b";
    actionBtn.style.boxShadow = "none";
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
            actionBtn.style.boxShadow = "0 4px 14px rgba(220, 38, 38, 0.35)";
            actionBtn.disabled = false;
            waveformBox.style.display = "flex";
            callStartTime = Date.now();
            onCallStart?.();
          } else if (status === "idle") {
            statusText.innerText = "Idle · Ready";
            statusDot.style.background = isDark ? "rgba(255,255,255,0.4)" : "#a1a1aa";
            btnText.innerText = "Start Voice Call";
            actionBtn.style.background = activeAccent;
            actionBtn.style.boxShadow = `0 4px 14px ${activeAccent}40`;
            actionBtn.disabled = false;
            waveformBox.style.display = "none";
            emailBar.style.display = "none";
            thinkingBubble.style.display = "none";
            stopTimer();
            if (callStartTime > 0) {
              const dur = Math.round((Date.now() - callStartTime) / 1000);
              callStartTime = 0;
              onCallEnd?.(dur);
            }
          }
        },
        onThinkingChange: (thinking) => {
          if (thinking) {
            thinkingBubble.style.display = "flex";
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
          }
        },
        onTranscript: (msg: TranscriptMessage) => {
          placeholderBanner.style.display = "none";

          if (msg.who === "user") {
            if (msg.isFinal) {
              thinkingBubble.style.display = "flex";
            }
            const userTextLower = msg.text.toLowerCase();
            // If caller says no, wrong, or requests change to their email
            if (
              userTextLower === "no" ||
              userTextLower.startsWith("no ") ||
              userTextLower.includes("no,") ||
              userTextLower.includes("wrong") ||
              userTextLower.includes("incorrect") ||
              userTextLower.includes("change my email") ||
              userTextLower.includes("different email")
            ) {
              awaitingEmailConfirm = false;
            }
            // If caller speaks their email or provides it in voice/text
            if (
              msg.text.includes("@") ||
              (userTextLower.includes(" at ") && userTextLower.includes(" dot ")) ||
              userTextLower.includes("gmail.com") ||
              userTextLower.includes("yahoo.com") ||
              userTextLower.includes("outlook.com") ||
              userTextLower.includes("hotmail.com") ||
              userTextLower.includes("icloud.com")
            ) {
              emailBar.style.display = "none";
              awaitingEmailConfirm = true;
            }
          } else if (msg.who === "agent") {
            if (msg.text && msg.text.trim().length > 0) {
              thinkingBubble.style.display = "none";
            }
            const lower = msg.text.toLowerCase();

            // 1. If booking is finalized, permanently lock and hide bar
            const isBookingFinalized =
              lower.includes("confirmation code is") ||
              lower.includes("booking is confirmed") ||
              lower.includes("scheduled your appointment") ||
              lower.includes("all set, your appointment") ||
              (lower.includes("sent your confirmation") && (lower.includes("code") || lower.includes("calendar invite"))) ||
              (lower.includes("sent a calendar invite") && (lower.includes("code") || lower.includes("all set")));

            if (isBookingFinalized) {
              bookingFinalized = true;
              awaitingEmailConfirm = false;
              emailBar.style.display = "none";
              return;
            }

            if (bookingFinalized) {
              emailBar.style.display = "none";
              return;
            }

            // 2. If agent is asking the caller to confirm with yes or no:
            // e.g., "I have verified your email as ... Can you please confirm with yes or no?"
            const isAskingYesNo =
              lower.includes("confirm with yes or no") ||
              lower.includes("yes or no") ||
              lower.includes("is that correct") ||
              lower.includes("is that right");

            if (isAskingYesNo) {
              awaitingEmailConfirm = true;
              emailBar.style.display = "none";
              return;
            }

            // 3. Strictly show input ONLY when agent is asking for caller's email
            const isAgentAskingEmail =
              lower.includes("what is your email") ||
              lower.includes("what's your email") ||
              lower.includes("may i have your email") ||
              lower.includes("can i have your email") ||
              lower.includes("could i get your email") ||
              lower.includes("could you provide your email") ||
              lower.includes("provide your email") ||
              lower.includes("enter your email") ||
              lower.includes("spell your email") ||
              lower.includes("share your email") ||
              lower.includes("need your email") ||
              lower.includes("what email") ||
              lower.includes("which email") ||
              lower.includes("where can i send your confirmation") ||
              lower.includes("where should i send your confirmation") ||
              lower.includes("where can i send your calendar") ||
              lower.includes("where should i send your calendar") ||
              (lower.includes("email") && (
                lower.includes("what is") ||
                lower.includes("what's") ||
                lower.includes("may i have") ||
                lower.includes("can i have") ||
                lower.includes("provide") ||
                lower.includes("give me") ||
                lower.includes("tell me") ||
                lower.includes("send your calendar invite") ||
                lower.includes("send your confirmation")
              ));

            if (isAgentAskingEmail) {
              awaitingEmailConfirm = false;
              emailBar.style.display = "flex";
              setTimeout(() => emailInput.focus(), 60);
            } else {
              emailBar.style.display = "none";
            }
          }

          // Check if last bubble belongs to same speaker and is non-final
          if (lastSpeaker === msg.who && lastBubbleInner && !lastMsgWasFinal) {
            lastBubbleInner.innerText = msg.text;
            lastMsgWasFinal = Boolean(msg.isFinal);
          } else {
            const isUser = msg.who === "user";
            const bubbleContainer = document.createElement("div");
            bubbleContainer.style.cssText = `
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${isUser ? "flex-end" : "flex-start"};
            `;

            if (isUser) {
              const inner = document.createElement("div");
              inner.style.cssText = `
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${activeAccent};
                color: #ffffff;
                box-shadow: 0 2px 8px ${activeAccent}35;
              `;
              inner.innerText = msg.text;
              bubbleContainer.appendChild(inner);
              lastBubbleInner = inner;
            } else {
              const row = document.createElement("div");
              row.style.cssText = `display: flex; align-items: flex-start; gap: 8px;`;

              const avatar = document.createElement("div");
              avatar.style.cssText = `
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `;
              avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>`;

              const inner = document.createElement("div");
              inner.style.cssText = `
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${isDark ? "#18181b" : "#f4f4f5"};
                color: ${isDark ? "#fafafa" : "#09090b"};
                border: ${isDark ? "1px solid #27272a" : "none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `;
              inner.innerText = msg.text;

              row.appendChild(avatar);
              row.appendChild(inner);
              bubbleContainer.appendChild(row);
              lastBubbleInner = inner;
            }

            transcriptArea.insertBefore(bubbleContainer, thinkingBubble);
            lastSpeaker = msg.who;
            lastMsgWasFinal = Boolean(msg.isFinal);
          }
          transcriptArea.scrollTop = transcriptArea.scrollHeight;
          onTranscript?.(msg);
        },
        onAudioLevel: (u, a) => {
          userLevel = u;
          agentLevel = a;
          if (callStatus === "connected") {
            waveformBox.style.display = "flex";
            const maxLevel = Math.max(u, a);
            defaultWaveHeights.forEach((h, i) => {
              const newH = Math.max(4, Math.min(14, Math.round(h * (0.35 + maxLevel * 1.5))));
              if (waveBars[i]) waveBars[i].style.height = `${newH}px`;
            });
          }
        },
        onError: () => {
          statusText.innerText = "Error";
          statusDot.style.background = "#ef4444";
          btnText.innerText = "Start Voice Call";
          actionBtn.style.background = activeAccent;
          actionBtn.style.boxShadow = `0 4px 14px ${activeAccent}40`;
          actionBtn.disabled = false;
          waveformBox.style.display = "none";
          emailBar.style.display = "none";
          thinkingBubble.style.display = "none";
          stopTimer();
        },
      });

      await client.start(data.token, targetAgentId, data.voice);
    } catch (err: any) {
      console.error("[OmniDesk Voice Widget Error]:", err);
      statusText.innerText = "Error";
      statusDot.style.background = "#ef4444";
      btnText.innerText = "Start Voice Call";
      actionBtn.style.background = activeAccent;
      actionBtn.style.boxShadow = `0 4px 14px ${activeAccent}40`;
      actionBtn.disabled = false;
      waveformBox.style.display = "none";
      emailBar.style.display = "none";
      thinkingBubble.style.display = "none";
      stopTimer();
    }
  }

  function endCall() {
    if (client) {
      client.stop();
      client = null;
    }
    callStatus = "idle";
    const statusText = header.querySelector("#omnidesk-status-text") as HTMLElement;
    const statusDot = header.querySelector("#omnidesk-status-dot") as HTMLElement;
    const btnText = actionBtn.querySelector("#omnidesk-btn-text") as HTMLElement;
    if (statusText) statusText.innerText = "Idle · Ready";
    if (statusDot) statusDot.style.background = isDark ? "rgba(255,255,255,0.4)" : "#a1a1aa";
    if (btnText) btnText.innerText = "Start Voice Call";
    actionBtn.style.background = activeAccent;
    actionBtn.style.boxShadow = `0 4px 14px ${activeAccent}40`;
    actionBtn.disabled = false;
    waveformBox.style.display = "none";
    emailBar.style.display = "none";
    thinkingBubble.style.display = "none";
    bookingFinalized = false;
    awaitingEmailConfirm = false;
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
