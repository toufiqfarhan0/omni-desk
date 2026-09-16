/**
 * OmniDesk app.js — frontend logic
 *
 * Responsibilities:
 * 1. Navigation between 4 views
 * 2. WebSocket voice session with AssemblyAI
 * 3. PCM16 audio capture and playback
 * 4. Live tool event polling (/api/events)
 * 5. Dossier, appointment, and tenant rendering
 * 6. Post-call LeMUR trigger (/api/call-ended)
 */

"use strict";

// ─── State ──────────────────────────────────────────────────────────────────

const STATE = {
  activeTenantId: "bright-dental",
  tenants: [],
  agentId: "",
  ws: null,
  audioCtx: null,
  stream: null,
  workletNode: null,
  sourceNode: null,
  audioQueue: [],
  isPlaying: false,
  callActive: false,
  callState: "idle",    // idle | connecting | listening | speaking | thinking
  eventCursor: 0,
  pollTimer: null,
  transcript: [],
  lastConfirmationCode: null,
};

const SAMPLE_RATE = 24000;

// ─── Bootstrap ──────────────────────────────────────────────────────────────

async function boot() {
  buildWaveform();
  await loadConfig();
  loadTenantCallPanel();
  await loadDossiers();
  await loadAppointments();
  loadSettingsTenants();
  bindNav();
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    STATE.agentId = data.agent_id || "";
    STATE.tenants = data.tenants || [];

    const display = document.getElementById("agent-id-display");
    display.textContent = STATE.agentId
      ? STATE.agentId.slice(0, 22) + "…"
      : "no agent — run create_agent.py";
  } catch (e) {
    console.warn("config load failed", e);
  }
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function bindNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + viewId).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === viewId);
  });
  if (viewId === "dossiers") loadDossiers();
  if (viewId === "appointments") loadAppointments();
  if (viewId === "tenants") loadSettingsTenants();
}

// ─── Waveform ────────────────────────────────────────────────────────────────

function buildWaveform() {
  const wrap = document.getElementById("waveform");
  wrap.innerHTML = "";
  for (let i = 0; i < 18; i++) {
    const bar = document.createElement("div");
    bar.className = "wave-bar";
    bar.id = `wb-${i}`;
    wrap.appendChild(bar);
  }
}

function animateWaveform(active, amplitudes = []) {
  for (let i = 0; i < 18; i++) {
    const bar = document.getElementById(`wb-${i}`);
    if (!bar) continue;
    if (active) {
      bar.classList.add("active");
      if (amplitudes.length > 0) {
        const h = 8 + (amplitudes[i % amplitudes.length] || 0) * 48;
        bar.style.height = h + "px";
        bar.style.animation = "none";
      }
    } else {
      bar.classList.remove("active");
      bar.style.height = "8px";
      bar.style.animation = "";
    }
  }
}

// ─── Agent State Badge ───────────────────────────────────────────────────────

function setCallState(state, label = "") {
  STATE.callState = state;
  const badge = document.getElementById("state-badge");
  const lbl = document.getElementById("state-label");
  badge.className = "state-badge " + state;
  const labels = {
    idle: "Ready", connecting: "Connecting…",
    listening: "Listening", speaking: "Speaking", thinking: "Processing",
  };
  lbl.textContent = label || labels[state] || state;
}

// ─── Tenant Panel ────────────────────────────────────────────────────────────

function loadTenantCallPanel() {
  const container = document.getElementById("tenant-list-call");
  container.innerHTML = "";

  if (!STATE.tenants.length) {
    container.innerHTML = `<div class="empty"><span>No tenants found. Add one in the Tenants tab.</span></div>`;
    return;
  }

  STATE.tenants.forEach(t => {
    const card = document.createElement("div");
    card.className = "tenant-card" + (t.id === STATE.activeTenantId ? " selected" : "");
    card.id = `tc-${t.id}`;

    const services = t.services || {};
    const chips = Object.values(services).slice(0, 3)
      .map(s => `<span class="chip">${s.label || s}</span>`).join("");

    card.innerHTML = `
      <div class="tenant-card-name">${t.name}</div>
      <div class="tenant-card-meta">${t.open_days || "Mon–Fri"} · ${_speak_hour(t.open_hour)}–${_speak_hour(t.close_hour)}</div>
      ${chips ? `<div class="service-chips">${chips}</div>` : ""}
    `;
    card.addEventListener("click", () => selectTenant(t.id));
    container.appendChild(card);
  });

  // Apply active business name
  const active = STATE.tenants.find(t => t.id === STATE.activeTenantId);
  if (active) applyActiveTenant(active);
}

function selectTenant(tenantId) {
  if (STATE.callActive) {
    showToast("End the current call before switching tenants.");
    return;
  }
  STATE.activeTenantId = tenantId;
  document.querySelectorAll(".tenant-card").forEach(c => c.classList.remove("selected"));
  const card = document.getElementById(`tc-${tenantId}`);
  if (card) card.classList.add("selected");

  const tenant = STATE.tenants.find(t => t.id === tenantId);
  if (tenant) applyActiveTenant(tenant);

  // Reset confirmation card
  document.getElementById("confirmation-card").classList.remove("visible");
  STATE.lastConfirmationCode = null;
}

function applyActiveTenant(tenant) {
  document.getElementById("active-business-name").textContent = tenant.name;
  document.getElementById("active-greeting").textContent = tenant.greeting || "";
}

function _speak_hour(h) {
  if (!h && h !== 0) return "?";
  const hr = parseInt(h);
  const suffix = hr < 12 ? "am" : "pm";
  const display = hr % 12 || 12;
  return `${display}${suffix}`;
}

// ─── Call — WebSocket + Audio ────────────────────────────────────────────────

async function toggleCall() {
  if (STATE.callActive) {
    await endCall();
  } else {
    await startCall();
  }
}

async function startCall() {
  if (!STATE.agentId) {
    showToast("No agent ID found. Run scripts/create_agent.py first.");
    return;
  }
  if (!STATE.activeTenantId) {
    showToast("Select a business first.");
    return;
  }

  const btn = document.getElementById("call-btn");
  btn.disabled = true;
  btn.textContent = "Connecting…";
  setCallState("connecting");
  document.getElementById("live-dot").className = "dot live";

  try {
    // Fetch short-lived token
    const tokenRes = await fetch("/api/token");
    if (!tokenRes.ok) throw new Error("Token request failed: " + tokenRes.statusText);
    const { token } = await tokenRes.json();

    // Request microphone
    STATE.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: SAMPLE_RATE },
    });

    // Open WebSocket to AssemblyAI
    STATE.ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${token}`);
    STATE.ws.binaryType = "arraybuffer";

    STATE.ws.onopen = () => {
      STATE.ws.send(JSON.stringify({
        type: "session.update",
        session: { agent_id: STATE.agentId },
      }));
      initAudio();
      STATE.callActive = true;
      btn.disabled = false;
      btn.className = "call-btn end";
      btn.textContent = "End call";
      setCallState("listening");
      startEventPolling();
      STATE.transcript = [];
      document.getElementById("transcript-scroll").textContent = "";
    };

    STATE.ws.onmessage = handleWsMessage;
    STATE.ws.onerror = (e) => console.error("WS error", e);
    STATE.ws.onclose = () => handleCallEnded();

  } catch (err) {
    console.error("Start call error:", err);
    showToast("Could not start call: " + err.message);
    btn.disabled = false;
    btn.className = "call-btn start";
    btn.textContent = "Start call";
    setCallState("idle");
    document.getElementById("live-dot").className = "dot";
    cleanup();
  }
}

async function endCall() {
  if (STATE.ws && STATE.ws.readyState === WebSocket.OPEN) {
    STATE.ws.send(JSON.stringify({ type: "session.end" }));
  }
  // handleCallEnded will fire via ws.onclose
}

function handleCallEnded() {
  STATE.callActive = false;
  stopEventPolling();
  cleanup();
  setCallState("idle");
  animateWaveform(false);

  const btn = document.getElementById("call-btn");
  btn.disabled = false;
  btn.className = "call-btn start";
  btn.textContent = "Start call";
  document.getElementById("live-dot").className = "dot";

  // Trigger LeMUR post-call pipeline
  const transcript = STATE.transcript.join("\n");
  if (transcript.trim().length > 20) {
    triggerLeMUR(transcript);
  }
}

async function triggerLeMUR(transcript) {
  try {
    await fetch("/api/call-ended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        tenant_id: STATE.activeTenantId,
        caller_name: "",
        caller_phone: "",
        duration_s: 0,
      }),
    });
    showToast("Call ended — generating LeMUR dossier…");
    // Poll dossiers after a short delay to pick up the async result
    setTimeout(() => loadDossiers(), 4000);
    setTimeout(() => loadDossiers(), 9000);
  } catch (e) {
    console.warn("LeMUR trigger failed", e);
  }
}

function handleWsMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (msg.type) {
    case "session.started":
      setCallState("listening");
      break;

    case "input.speech.started":
      stopPlayback();
      setCallState("listening");
      animateWaveform(true);
      break;

    case "input.speech.stopped":
      setCallState("thinking");
      animateWaveform(false);
      break;

    case "transcript.partial":
    case "transcript.final":
      if (msg.text) {
        const scroll = document.getElementById("transcript-scroll");
        scroll.textContent = msg.text;
        if (msg.type === "transcript.final") {
          STATE.transcript.push("Caller: " + msg.text);
        }
      }
      break;

    case "reply.text.delta":
    case "reply.text.done":
      if (msg.text || msg.value) {
        const text = msg.text || msg.value;
        document.getElementById("transcript-scroll").textContent = text;
        if (msg.type === "reply.text.done") {
          STATE.transcript.push("Agent: " + text);
          // detect confirmation code in agent speech
          const codeMatch = text.match(/\b([A-Z0-9]{6})\b/);
          if (codeMatch) showConfirmationCode(codeMatch[1]);
        }
      }
      break;

    case "reply.audio.delta":
      setCallState("speaking");
      if (msg.delta) {
        const bytes = base64ToArrayBuffer(msg.delta);
        STATE.audioQueue.push(bytes);
        if (!STATE.isPlaying) playNextChunk();
      }
      break;

    case "reply.audio.done":
      setCallState("listening");
      break;

    case "error":
      console.error("AssemblyAI WS error:", msg);
      showToast("Agent error: " + (msg.message || "unknown"));
      break;
  }
}

// ─── Audio I/O ───────────────────────────────────────────────────────────────

async function initAudio() {
  STATE.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  await STATE.audioCtx.audioWorklet.addModule("/worklet.js");

  STATE.sourceNode = STATE.audioCtx.createMediaStreamSource(STATE.stream);
  STATE.workletNode = new AudioWorkletNode(STATE.audioCtx, "pcm16-processor");

  STATE.workletNode.port.onmessage = (e) => {
    if (STATE.ws && STATE.ws.readyState === WebSocket.OPEN) {
      const b64 = arrayBufferToBase64(e.data);
      STATE.ws.send(JSON.stringify({ type: "input.audio", data: b64 }));
    }
  };

  STATE.sourceNode.connect(STATE.workletNode);
  STATE.workletNode.connect(STATE.audioCtx.destination);
}

function playNextChunk() {
  if (!STATE.audioQueue.length || !STATE.audioCtx) {
    STATE.isPlaying = false;
    return;
  }
  STATE.isPlaying = true;
  const raw = STATE.audioQueue.shift();
  const int16 = new Int16Array(raw);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

  const buffer = STATE.audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
  buffer.copyToChannel(float32, 0);

  const src = STATE.audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(STATE.audioCtx.destination);
  src.onended = playNextChunk;
  src.start();
}

function stopPlayback() {
  STATE.audioQueue = [];
  STATE.isPlaying = false;
}

function cleanup() {
  if (STATE.workletNode) { STATE.workletNode.disconnect(); STATE.workletNode = null; }
  if (STATE.sourceNode) { STATE.sourceNode.disconnect(); STATE.sourceNode = null; }
  if (STATE.stream) { STATE.stream.getTracks().forEach(t => t.stop()); STATE.stream = null; }
  if (STATE.audioCtx) { STATE.audioCtx.close().catch(() => {}); STATE.audioCtx = null; }
  if (STATE.ws) { STATE.ws.onclose = null; STATE.ws.close(); STATE.ws = null; }
  stopPlayback();
}

// ─── Tool Event Polling ──────────────────────────────────────────────────────

function startEventPolling() {
  STATE.eventCursor = 0;
  STATE.pollTimer = setInterval(pollEvents, 1500);
}

function stopEventPolling() {
  clearInterval(STATE.pollTimer);
  STATE.pollTimer = null;
}

async function pollEvents() {
  try {
    const res = await fetch(`/api/events?since=${STATE.eventCursor}&tenant_id=${STATE.activeTenantId}`);
    const data = await res.json();
    if (data.events && data.events.length > 0) {
      data.events.forEach(renderToolEvent);
      STATE.eventCursor = data.cursor;
    }
  } catch (e) {
    // silent
  }
}

function renderToolEvent(event) {
  const feed = document.getElementById("tool-feed");

  // Remove empty state
  const empty = feed.querySelector(".empty");
  if (empty) empty.remove();

  const argsStr = JSON.stringify(event.arguments, null, 2);
  const resStr = JSON.stringify(event.result, null, 2);
  const isOk = event.result && event.result.ok !== false;

  const el = document.createElement("div");
  el.className = "tool-event";
  el.innerHTML = `
    <div class="tool-event-header">
      <span class="tool-name-chip">${event.tool}</span>
      <span class="tool-time ${isOk ? "tool-ok" : "tool-err"}">${event.at}</span>
    </div>
    <div class="tool-detail">
      <div class="tool-detail-section">
        <div class="tool-detail-label">Request</div>
        <pre>${htmlEscape(argsStr)}</pre>
      </div>
      <div class="divider"></div>
      <div class="tool-detail-section">
        <div class="tool-detail-label">Response</div>
        <pre>${htmlEscape(resStr)}</pre>
      </div>
    </div>
  `;
  el.addEventListener("click", () => el.classList.toggle("expanded"));

  // Prepend newest to top
  feed.insertBefore(el, feed.firstChild);

  // Detect confirmation code from tool result
  if (event.tool === "book_appointment" && event.result && event.result.confirmation_code) {
    showConfirmationCode(event.result.confirmation_code);
  }
}

function showConfirmationCode(code) {
  if (!code || STATE.lastConfirmationCode === code) return;
  STATE.lastConfirmationCode = code;
  const card = document.getElementById("confirmation-card");
  document.getElementById("confirmation-code-display").textContent = code.split("").join(" ");
  card.classList.add("visible");
  loadAppointments();
}

// ─── Dossiers ────────────────────────────────────────────────────────────────

const URGENCY_LABELS = ["", "Routine", "Moderate", "Important", "Urgent", "Critical"];

async function loadDossiers() {
  try {
    const res = await fetch("/api/dossiers");
    const { dossiers } = await res.json();
    renderDossiers(dossiers || []);
  } catch (e) {
    console.warn("dossier load failed", e);
  }
}

function renderDossiers(dossiers) {
  const grid = document.getElementById("dossier-grid");
  if (!dossiers.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
      </div>
      <span>Dossiers appear here after each call. Complete a call to generate one.</span>
    </div>`;
    return;
  }

  grid.innerHTML = dossiers.map(d => {
    const u = Math.max(1, Math.min(5, d.urgency || 1));
    const actions = (d.actions || []).slice(0, 4).map(a =>
      `<div class="dossier-action-item">${htmlEscape(a)}</div>`
    ).join("");
    return `
      <div class="dossier-card">
        <div class="dossier-head">
          <div>
            <div class="dossier-caller">${htmlEscape(d.caller_name || "Anonymous Caller")}</div>
            ${d.caller_phone ? `<div class="dossier-phone">${htmlEscape(d.caller_phone)}</div>` : ""}
          </div>
          <div class="urgency-badge u${u}">${URGENCY_LABELS[u]}</div>
        </div>
        <div class="dossier-meta">
          ${d.intent ? `<span class="intent-chip">${htmlEscape(d.intent)}</span>` : ""}
          ${d.tenant_name ? `<span class="tenant-chip">${htmlEscape(d.tenant_name)}</span>` : ""}
        </div>
        ${d.summary ? `<div class="dossier-summary">${htmlEscape(d.summary)}</div>` : ""}
        ${d.sentiment ? `<div class="dossier-sentiment">${htmlEscape(d.sentiment)}</div>` : ""}
        ${actions ? `<hr class="dossier-divider"><div class="dossier-actions">${actions}</div>` : ""}
        ${d.draft_message ? `
          <hr class="dossier-divider">
          <div class="dossier-draft">${htmlEscape(d.draft_message)}</div>
          <button class="copy-btn" onclick="copyText(${JSON.stringify(d.draft_message)}, this)">Copy follow-up</button>
        ` : ""}
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">${d.created_at || ""}</div>
      </div>
    `;
  }).join("");
}

// ─── Appointments ────────────────────────────────────────────────────────────

async function loadAppointments() {
  try {
    const res = await fetch("/api/appointments");
    const { appointments } = await res.json();
    renderAppointments(appointments || []);
  } catch (e) {
    console.warn("appointments load failed", e);
  }
}

function renderAppointments(appts) {
  const tbody = document.getElementById("appointments-tbody");
  if (!appts.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">No appointments yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = appts.map(a => `
    <tr>
      <td><span class="mono">${htmlEscape(a.code)}</span></td>
      <td>${htmlEscape(a.tenant_id)}</td>
      <td>${htmlEscape(a.customer_name)}</td>
      <td>${htmlEscape(a.service_label || a.service)}</td>
      <td>${htmlEscape(a.date)} ${htmlEscape(a.time)}</td>
      <td><span class="mono">${htmlEscape(a.phone)}</span></td>
      <td><span class="status-badge status-${a.status}">${htmlEscape(a.status)}</span></td>
    </tr>
  `).join("");
}

// ─── Settings / Tenants ──────────────────────────────────────────────────────

async function loadSettingsTenants() {
  try {
    const res = await fetch("/api/tenants");
    const { tenants } = await res.json();
    STATE.tenants = tenants;
    renderSettingsTenants(tenants);
    loadTenantCallPanel();

    // Populate discord tenant select
    const sel = document.getElementById("discord-tenant-select");
    sel.innerHTML = tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  } catch (e) {
    console.warn("tenant load failed", e);
  }
}

function renderSettingsTenants(tenants) {
  const list = document.getElementById("settings-tenant-list");
  if (!tenants.length) {
    list.innerHTML = `<div class="empty"><span>No tenants yet.</span></div>`;
    return;
  }
  list.innerHTML = tenants.map(t => {
    const services = Object.keys(t.services || {});
    return `
      <div class="tenant-list-item">
        <div>
          <div class="tenant-list-name">${htmlEscape(t.name)}</div>
          <div class="tenant-list-meta">${htmlEscape(t.open_days || "Mon–Fri")} · ${services.length} service${services.length !== 1 ? "s" : ""}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          ${t.discord_webhook ? `<span class="chip" style="color:#5865F2;background:#eef0ff;">Discord</span>` : ""}
          <span class="chip">${htmlEscape(t.id)}</span>
        </div>
      </div>
    `;
  }).join("");
}

async function addTenant() {
  const id = document.getElementById("new-tenant-id").value.trim();
  const name = document.getElementById("new-tenant-name").value.trim();
  const greeting = document.getElementById("new-tenant-greeting").value.trim();
  const status = document.getElementById("tenant-add-status");

  if (!id || !name) {
    status.textContent = "ID and name are required.";
    return;
  }

  try {
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, greeting }),
    });
    const data = await res.json();
    if (data.ok) {
      status.textContent = "Tenant added.";
      document.getElementById("new-tenant-id").value = "";
      document.getElementById("new-tenant-name").value = "";
      document.getElementById("new-tenant-greeting").value = "";
      await loadSettingsTenants();
    }
  } catch (e) {
    status.textContent = "Failed: " + e.message;
  }
}

async function saveDiscordWebhook() {
  const url = document.getElementById("discord-url-input").value.trim();
  const tenantId = document.getElementById("discord-tenant-select").value;
  const status = document.getElementById("discord-status");

  if (!url || !tenantId) {
    status.textContent = "Enter a webhook URL and select a tenant.";
    return;
  }

  const tenant = STATE.tenants.find(t => t.id === tenantId);
  if (!tenant) return;

  const updated = { ...tenant, discord_webhook: url };
  updated.services = tenant.services || {};
  updated.faq = {};

  try {
    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const data = await res.json();
    if (data.ok) {
      status.textContent = "Webhook saved.";
      await loadSettingsTenants();
    }
  } catch (e) {
    status.textContent = "Save failed: " + e.message;
  }
}

async function testDiscord() {
  const url = document.getElementById("discord-url-input").value.trim();
  const btn = document.getElementById("discord-test-btn");
  const status = document.getElementById("discord-status");

  if (!url) { status.textContent = "Enter a webhook URL first."; return; }

  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    const res = await fetch("/api/discord/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhook_url: url }),
    });
    const data = await res.json();
    status.textContent = data.ok ? "Test embed sent — check your Discord channel." : "Webhook test failed. Check the URL.";
  } catch (e) {
    status.textContent = "Request failed: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Test";
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

function showToast(message, duration = 3200) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function htmlEscape(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", boot);
