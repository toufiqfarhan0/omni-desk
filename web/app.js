const SAMPLE_RATE = 24000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";
const POLL_MS = 400;

const els = {
  talk: document.getElementById("talk"),
  status: document.getElementById("status"),
  transcript: document.getElementById("transcript"),
  calls: document.getElementById("calls"),
  count: document.getElementById("call-count"),
  agentId: document.getElementById("agent-id"),
  timer: document.getElementById("timer"),
  liveEmailBox: document.getElementById("live-email-box"),
  liveEmailForm: document.getElementById("live-email-form"),
  liveEmailInput: document.getElementById("live-email-input"),
  liveEmailCheck: document.getElementById("live-email-check"),
  liveEmailFeedback: document.getElementById("live-email-feedback"),
  btnSendEmail: document.getElementById("btn-send-email"),
  btnToggleEmail: document.getElementById("btn-toggle-email"),
};

let ws = null;
let audioCtx = null;
let micStream = null;
let workletNode = null;
let live = false;

// Playback scheduling. Holding the sources lets barge-in cut the agent off instantly.
let playHead = 0;
let scheduled = [];

// Tool calls arrive out-of-band from the booking API's own log. Buffer them so
// the next agent reply can show which ones fed it.
let eventCursor = 0;
let pollTimer = null;
let pending = [];
let callTotal = 0;

let appCallTranscript = [];
let appCallToolEvents = [];
let appCallerName = "";
let appCallerEmail = "";
let appHasBooked = false;
let awaitingEmailConfirmation = false;
let appBasePrompt = "";

// ---------------------------------------------------------------- helpers

function setStatus(text, state) {
  els.status.textContent = text;
  els.status.dataset.state = state;
}

// ------------------------------------------------------------------ timer

let timerStart = 0;
let timerTick = null;

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function resetTimer() {
  clearInterval(timerTick);
  timerTick = null;
  timerStart = 0;
  els.timer.textContent = "0:00";
  els.timer.dataset.state = "idle";
}

function startTimer() {
  timerStart = Date.now();
  els.timer.textContent = "0:00";
  els.timer.dataset.state = "running";
  timerTick = setInterval(() => {
    els.timer.textContent = formatDuration(Date.now() - timerStart);
  }, 250);
}

function stopTimer() {
  if (!timerTick) return;
  clearInterval(timerTick);
  timerTick = null;
  els.timer.textContent = formatDuration(Date.now() - timerStart);
  els.timer.dataset.state = "ended";
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function clearEmpty(node) {
  const empty = node.querySelector(".empty");
  if (empty) empty.remove();
}

// -------------------------------------------------------- email verification
const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const DOMAIN_TYPOS = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmaik.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yaho.co": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclud.com": "icloud.com",
  "icoud.com": "icloud.com",
};

function isEmailRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (t.includes("is that correct") || t.includes("is that right") || t.includes("did i get that")) {
    return false;
  }
  return (
    t.includes("email address") ||
    t.includes("your email") ||
    t.includes("what's your email") ||
    t.includes("what is your email") ||
    t.includes("spell your email") ||
    t.includes("have your email") ||
    t.includes("provide your email") ||
    t.includes("share your email") ||
    t.includes("tell me your email") ||
    t.includes("need your email")
  );
}

function isEmailRejection(userText) {
  if (!userText) return false;
  const t = userText.trim().toLowerCase();
  return (
    t === "no" ||
    t === "nope" ||
    t === "nah" ||
    t.startsWith("no ") ||
    t.startsWith("no,") ||
    t.startsWith("nope") ||
    t.includes("wrong") ||
    t.includes("incorrect") ||
    t.includes("not correct") ||
    t.includes("not right") ||
    t.includes("change my email") ||
    t.includes("change email") ||
    t.includes("different email") ||
    t.includes("that's not my email") ||
    t.includes("that is not my email") ||
    t.includes("spelled wrong") ||
    t.includes("spelled incorrectly")
  );
}

let appEmailHideTimer = null;

function showLiveEmailBox(customHint) {
  if (appEmailHideTimer) {
    clearTimeout(appEmailHideTimer);
    appEmailHideTimer = null;
  }
  if (!els.liveEmailBox) return;
  els.liveEmailBox.style.display = "block";
  if (customHint && els.liveEmailBox.querySelector(".live-email-guide")) {
    els.liveEmailBox.querySelector(".live-email-guide").textContent = customHint;
  }
  if (els.liveEmailInput) {
    els.liveEmailInput.focus();
  }
}

function hideLiveEmailBox() {
  if (appEmailHideTimer) {
    clearTimeout(appEmailHideTimer);
    appEmailHideTimer = null;
  }
  if (els.liveEmailBox) {
    els.liveEmailBox.style.display = "none";
  }
  if (els.liveEmailFeedback) {
    els.liveEmailFeedback.style.display = "none";
    els.liveEmailFeedback.innerHTML = "";
  }
}


// ------------------------------------------------------------ transcript

function addLine(who, text) {
  clearEmpty(els.transcript);

  const row = document.createElement("div");
  row.className = `line ${who}`;

  const label = document.createElement("span");
  label.className = "who";
  label.textContent = who === "agent" ? "OmniDesk Salon Assistant" : "You";

  const body = document.createElement("p");
  body.textContent = text;
  row.append(label, body);

  // Tie this reply to the tool calls that produced it.
  if (who === "agent" && pending.length) {
    const used = document.createElement("div");
    used.className = "used";
    for (const event of pending) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (event.failed ? " warn" : "");
      chip.textContent = event.tool;
      chip.title = "Show tool call details";
      chip.addEventListener("click", () => revealCall(event.seq));
      used.append(chip);
    }
    row.append(used);
    pending = [];
  }

  els.transcript.append(row);
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

// ------------------------------------------------- server-side tool calls

function formatArgs(args) {
  const keys = Object.keys(args || {});
  if (!keys.length) return "";
  return keys.map((k) => `${k}: ${JSON.stringify(args[k])}`).join("\n");
}

function renderCall(event) {
  clearEmpty(els.calls);

  const failed = event.result && event.result.ok === false;
  event.failed = failed;

  const card = document.createElement("article");
  card.className = `call${failed ? " warn" : ""}`;
  card.dataset.seq = event.seq;

  const head = document.createElement("header");
  head.className = "call-header";

  const nameGroup = document.createElement("div");
  nameGroup.className = "call-method-name";
  const tag = document.createElement("span");
  tag.className = "method-tag";
  tag.textContent = "POST";
  const name = document.createElement("span");
  name.className = "call-name";
  name.textContent = `/tools/${event.tool}`;
  nameGroup.append(tag, name);

  const time = document.createElement("span");
  time.className = "call-time";
  time.textContent = event.at;

  head.append(nameGroup, time);
  card.append(head);

  const args = formatArgs(event.arguments);
  if (args) {
    const pre = document.createElement("pre");
    pre.className = "call-args";
    pre.textContent = args;
    card.append(pre);
  }

  if (failed && event.result.reason) {
    const reason = document.createElement("span");
    reason.className = "call-reason";
    reason.textContent = event.result.reason.replace(/_/g, " ");
    card.append(reason);
  }

  const msg = document.createElement("p");
  msg.className = "call-msg";
  msg.textContent = (event.result && event.result.message) || "(no response message)";
  card.append(msg);

  els.calls.append(card);
  els.calls.scrollTop = els.calls.scrollHeight;

  callTotal += 1;
  els.count.textContent = `${callTotal} call${callTotal === 1 ? "" : "s"}`;

  // Track tool calls for conversation history
  appCallToolEvents.push(event);
  if (event.tool === "book_appointment" && event.arguments) {
    appHasBooked = true;
    if (event.arguments.customer_name) appCallerName = event.arguments.customer_name;
    if (event.arguments.email) appCallerEmail = event.arguments.email;
  }

  // Refresh owner stats if a booking tool was executed
  if (event.tool === "book_appointment" || event.tool === "send_confirmation") {
    loadOwnerStats();
  }

  // If email was reported as invalid or agent is verifying email, surface the live email input
  if (event.tool === "verify_customer_email" && failed) {
    showLiveEmailBox("The agent couldn't verify the email domain. Please type your correct email below:");
  } else if (failed && event.result && event.result.reason === "bad_email") {
    showLiveEmailBox("The agent couldn't verify your email. Please type your correct email below:");
  }
}

function revealCall(seq) {
  const card = els.calls.querySelector(`[data-seq="${seq}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("flash");
  setTimeout(() => card.classList.remove("flash"), 1400);
}

async function pollEvents() {
  try {
    const res = await fetch(`/api/events?since=${eventCursor}`);
    const data = await res.json();
    eventCursor = data.cursor;
    for (const event of data.events) {
      renderCall(event);
      pending.push(event);
    }
  } catch (_) {
    /* retry next poll */
  }
}

// ---------------------------------------------------------------- audio

function playChunk(int16) {
  if (!audioCtx) return;
  const buffer = audioCtx.createBuffer(1, int16.length, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (playHead < now) playHead = now;
  source.start(playHead);
  playHead += buffer.duration;

  scheduled.push(source);
  source.onended = () => {
    const i = scheduled.indexOf(source);
    if (i >= 0) scheduled.splice(i, 1);
  };
}

function stopPlayback() {
  for (const source of scheduled) {
    try {
      source.stop();
    } catch (_) {
      /* already ended */
    }
  }
  scheduled = [];
  playHead = 0;
}

// --------------------------------------------------------------- session

async function start() {
  resetTimer();
  setStatus("Connecting", "busy");
  els.talk.disabled = true;

  let token;
  try {
    const res = await fetch("/api/token");
    if (!res.ok) throw new Error((await res.text()).slice(0, 200));
    token = (await res.json()).token;
  } catch (err) {
    setStatus("No token", "error");
    addLine("agent", `Could not mint AssemblyAI token: ${err.message}`);
    els.talk.disabled = false;
    return;
  }

  const config = await fetch("/api/config").then((r) => r.json());
  if (!config.agent_id) {
    setStatus("No agent", "error");
    addLine("agent", "Agent ID not configured. Run scripts/create_agent.py first.");
    els.talk.disabled = false;
    return;
  }
  els.agentId.textContent = config.agent_id;
  appBasePrompt = config.system_prompt || "";

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        sampleRate: SAMPLE_RATE,
      },
    });
  } catch (err) {
    setStatus("No mic", "error");
    addLine("agent", "Microphone access was denied. Please allow microphone permissions and try again.");
    els.talk.disabled = false;
    return;
  }

  audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  await audioCtx.audioWorklet.addModule("/worklet.js");

  ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        agent_id: config.agent_id,
      },
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case "session.ready":
        live = true;
        setStatus("Live", "live");
        if (els.btnToggleEmail) els.btnToggleEmail.style.display = "inline-flex";
        hideLiveEmailBox();
        els.talk.disabled = false;
        els.talk.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
          </svg>
          End call
        `;
        els.talk.classList.add("ending");
        startTimer();
        pollTimer = setInterval(pollEvents, POLL_MS);
        appCallTranscript = [];
        appCallToolEvents = [];
        appCallerName = "";
        appCallerEmail = "";
        appHasBooked = false;
        awaitingEmailConfirmation = false;
        break;

      case "input.speech.started":
        stopPlayback(); // instantaneous barge-in cut
        break;

      case "transcript.user":
        addLine("user", msg.text);
        appCallTranscript.push({ who: "user", text: msg.text });
        if (isEmailRejection(msg.text) && (awaitingEmailConfirmation || appCallerEmail)) {
          if (appEmailHideTimer) {
            clearTimeout(appEmailHideTimer);
            appEmailHideTimer = null;
          }
          showLiveEmailBox("Email not confirmed. Please type your correct email below to fix it:");
          if (els.liveEmailInput) {
            els.liveEmailInput.value = "";
            els.liveEmailInput.focus();
          }
          const rejectedEmail = appCallerEmail || "";
          appCallerEmail = "";
          awaitingEmailConfirmation = false;
          fetch("/api/verify-email/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "", business_id: "biz_demo_dental" })
          }).catch(() => {});

          if (ws && ws.readyState === WebSocket.OPEN) {
            const promptPrefix = appBasePrompt ? `${appBasePrompt}\n\n` : "";
            ws.send(JSON.stringify({
              type: "session.update",
              session: {
                system_prompt: `${promptPrefix}[CALLER REJECTED EMAIL] The caller stated that the previous email ("${rejectedEmail}") was NOT correct. Do NOT book with that address. Apologize politely (e.g. "My apologies! What is your correct email address?") and wait for the caller to provide or type their corrected email address.`
              }
            }));
          }
        }
        break;

      case "transcript.agent":
        addLine("agent", msg.text);
        appCallTranscript.push({ who: "agent", text: msg.text });
        const agentLower = (msg.text || "").toLowerCase();
        if (
          agentLower.includes("is that correct") ||
          agentLower.includes("is that right") ||
          agentLower.includes("did i get that right") ||
          agentLower.includes("confirm your email")
        ) {
          awaitingEmailConfirmation = true;
        }
        if (isEmailRequest(msg.text)) {
          showLiveEmailBox();
        }
        break;

      case "reply.audio":
        playChunk(fromBase64(msg.data));
        break;

      case "reply.done":
        if (msg.status === "interrupted") stopPlayback();
        break;

      case "session.error":
        setStatus(msg.code || "Error", "error");
        addLine("agent", msg.message || "Session error");
        break;

      case "session.ended":
        cleanup();
        break;
    }
  };

  ws.onerror = () => setStatus("Connection error", "error");
  ws.onclose = () => cleanup();

  workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
  workletNode.port.onmessage = ({ data }) => {
    if (ws && ws.readyState === WebSocket.OPEN && live) {
      ws.send(JSON.stringify({ type: "input.audio", audio: toBase64(data) }));
    }
  };
  audioCtx.createMediaStreamSource(micStream).connect(workletNode);
  workletNode.connect(audioCtx.destination);
}

function stop() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "session.end" }));
    setStatus("Ending", "busy");
    els.talk.disabled = true;
    setTimeout(() => ws && ws.close(), 1200);
  } else {
    cleanup();
  }
}

function cleanup() {
  if (!live && !micStream && !audioCtx) return;
  live = false;
  stopTimer();

  if (els.btnToggleEmail) els.btnToggleEmail.style.display = "none";
  hideLiveEmailBox();

  clearInterval(pollTimer);
  pollTimer = null;
  stopPlayback();

  const elapsed = timerStart > 0 ? Math.max(1, Math.floor((Date.now() - timerStart) / 1000)) : 25;
  const startIso = timerStart > 0
    ? new Date(timerStart).toISOString().replace("T", " ").slice(0, 19)
    : new Date(Date.now() - elapsed * 1000).toISOString().replace("T", " ").slice(0, 19);
  const endIso = new Date().toISOString().replace("T", " ").slice(0, 19);

  fetch("/api/conversations/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_id: "biz_demo_dental",
      caller_name: appCallerName || "Demo Caller",
      caller_email: appCallerEmail || "caller@example.com",
      started_at: startIso,
      ended_at: endIso,
      duration_seconds: elapsed,
      status: "completed",
      outcome: appHasBooked ? "booked" : "inquiry",
      transcript: appCallTranscript.length > 0 ? appCallTranscript : [{ who: "agent", text: "Demo voice call ended." }],
      tool_calls: appCallToolEvents
    })
  }).then(() => loadOwnerStats()).catch(() => {});
  pollTimer = null;
  stopPlayback();

  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  micStream = null;

  if (workletNode) workletNode.disconnect();
  workletNode = null;

  if (audioCtx) audioCtx.close();
  audioCtx = null;

  ws = null;
  els.talk.disabled = false;
  els.talk.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
    Start call
  `;
  els.talk.classList.remove("ending");
  setStatus("Idle", "idle");
  pollEvents();
}

els.talk.addEventListener("click", () => (live ? stop() : start()));

fetch("/api/config")
  .then((r) => r.json())
  .then((c) => {
    els.agentId.textContent = c.agent_id || "not published";
  })
  .catch(() => {
    els.agentId.textContent = "api offline";
  });

// ------------------------------------------------------------ OWNER DASHBOARD SHEET

const sheet = {
  btn: document.getElementById("owner-btn"),
  panel: document.getElementById("owner-sheet"),
  backdrop: document.getElementById("owner-backdrop"),
  closeBtn: document.getElementById("sheet-close-btn"),
  tabs: document.querySelectorAll(".tab-btn"),
  panes: document.querySelectorAll(".tab-pane"),
  kpiToday: document.getElementById("kpi-today"),
  kpiUpcoming: document.getElementById("kpi-upcoming"),
  kpiRev: document.getElementById("kpi-rev"),
  overviewTodayTable: document.getElementById("overview-today-table"),
  calendarTable: document.getElementById("calendar-table"),
  calendarCount: document.getElementById("calendar-count"),
  customersTable: document.getElementById("customers-table"),
  servicesGrid: document.getElementById("services-grid"),
  keytermsRow: document.getElementById("sheet-keyterms"),
};

function openSheet() {
  sheet.panel.classList.add("active");
  sheet.backdrop.classList.add("active");
  loadOwnerStats();
  document.addEventListener("keydown", onSheetKey);
}

function closeSheet() {
  sheet.panel.classList.remove("active");
  sheet.backdrop.classList.remove("active");
  document.removeEventListener("keydown", onSheetKey);
}

function onSheetKey(e) {
  if (e.key === "Escape") closeSheet();
}

if (sheet.btn) sheet.btn.addEventListener("click", openSheet);
if (sheet.closeBtn) sheet.closeBtn.addEventListener("click", closeSheet);
if (sheet.backdrop) sheet.backdrop.addEventListener("click", closeSheet);

// Tab switching
sheet.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    sheet.tabs.forEach((t) => t.classList.remove("active"));
    sheet.panes.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    const target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.add("active");
  });
});

async function loadOwnerStats() {
  try {
    const res = await fetch("/api/owner-stats");
    if (!res.ok) return;
    const data = await res.json();

    // 1. Overview KPIs
    sheet.kpiToday.textContent = data.today_bookings_count;
    sheet.kpiUpcoming.textContent = data.upcoming_bookings_count;
    sheet.kpiRev.textContent = `$${data.estimated_revenue.toLocaleString()}`;

    // 2. Today's table
    if (data.today_appointments && data.today_appointments.length) {
      sheet.overviewTodayTable.innerHTML = data.today_appointments
        .map(
          (a) => `
        <tr>
          <td><strong style="font-family: var(--mono);">${a.time}</strong></td>
          <td>${a.customer_name}</td>
          <td>${a.service_label}</td>
          <td><span class="badge-success">Confirmed</span></td>
        </tr>`
        )
        .join("");
    } else {
      sheet.overviewTodayTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 18px;">No bookings scheduled for today</td></tr>`;
    }

    // 3. All Appointments / Calendar Table
    sheet.calendarCount.textContent = `${data.all_appointments.length} total`;
    if (data.all_appointments && data.all_appointments.length) {
      sheet.calendarTable.innerHTML = data.all_appointments
        .map(
          (a) => `
        <tr>
          <td><code style="font-family: var(--mono); font-weight: 600; color: var(--accent-text); background: var(--accent-soft); padding: 2px 6px; border-radius: 4px;">${a.confirmation_code}</code></td>
          <td><strong>${a.date}</strong> &middot; ${a.time}</td>
          <td>${a.customer_name}</td>
          <td>${a.service_label} <span style="color: var(--text-muted); font-size: 11.5px;">($${a.price})</span></td>
          <td><span style="font-family: var(--mono); font-size: 12px; color: var(--text-secondary);">${a.email ? `${a.email} <span style="color:#16a34a; font-weight:600; font-size:10px;">✓ Verified</span>` : "—"}</span></td>
        </tr>`
        )
        .join("");
    } else {
      sheet.calendarTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">No appointments on record yet</td></tr>`;
    }

    // 4. Customers Table
    if (data.customers && data.customers.length) {
      sheet.customersTable.innerHTML = data.customers
        .map(
          (c) => `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td><span style="font-family: var(--mono); font-size: 12px;">${c.email ? `${c.email} <span style="color:#16a34a; font-weight:600; font-size:10px;">✓ Verified</span>` : "—"}</span></td>
          <td><span class="tenant-badge">${c.appointments_count} visit${c.appointments_count === 1 ? "" : "s"}</span></td>
          <td>${c.last_service || "Signature Haircut"} <span style="color: var(--text-muted); font-size: 11px;">(${c.last_date})</span></td>
        </tr>`
        )
        .join("");
    } else {
      sheet.customersTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 18px;">No customer profiles recorded yet</td></tr>`;
    }

    // 5. Services Grid
    if (data.services && data.services.length) {
      sheet.servicesGrid.innerHTML = data.services
        .map(
          (s) => `
        <div class="service-card">
          <div class="service-head">
            <span class="service-name">${s.label}</span>
            <span class="service-price">$${s.price}</span>
          </div>
          <p class="service-desc">${s.description || "Salon service offering for luxury hair styling and care."}</p>
          <span class="service-dur">Duration: ${s.minutes} minutes</span>
        </div>`
        )
        .join("");
    }

    // 6. AI Agent Keyterms
    fetch("/api/demo-info")
      .then((r) => r.json())
      .then((info) => {
        if (info.agent && info.agent.keyterms) {
          sheet.keytermsRow.innerHTML = info.agent.keyterms
            .map((term) => `<span class="pill">${term}</span>`)
            .join("");
        }
      })
      .catch(() => {});
  } catch (err) {
    console.error("Error loading owner stats:", err);
  }
}

// ----------------------------------------------------------- demo data modal

const infoEls = {
  btn: document.getElementById("info-btn"),
  modal: document.getElementById("info"),
  body: document.getElementById("info-body"),
};

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function block(title, source, note) {
  const wrap = el("section");
  const head = el("div", "block-head");
  head.append(el("h3", null, title), el("span", "src", source));
  wrap.append(head);
  if (note) wrap.append(el("p", "block-note", note));
  return wrap;
}

function pills(items, cls) {
  const row = el("div", "pillrow");
  for (const item of items) row.append(el("span", cls ? `pill ${cls}` : "pill", item));
  return row;
}

function kv(pairs) {
  const dl = el("dl", "kv");
  for (const [key, value] of pairs) {
    dl.append(el("dt", null, key), el("dd", null, value));
  }
  return dl;
}

function renderInfo(data) {
  infoEls.body.textContent = "";

  const config = block(
    "Who it is",
    "agent.json",
    "Uploaded once by scripts/create_agent.py. AssemblyAI stores this as the agent's identity."
  );
  config.append(
    kv([
      ["Name", data.agent.name],
      ["Voice", data.agent.voice],
    ])
  );
  config.append(el("p", "block-note", "Tools it is allowed to call:"));
  config.append(pills(data.agent.tools.map((t) => t.name), "tool"));
  if (data.agent.keyterms.length) {
    config.append(el("p", "block-note", "Boosted vocabulary for accurate transcription:"));
    config.append(pills(data.agent.keyterms));
  }

  const live = block(
    "What it can see",
    "your booking API",
    "Dynamic availability fetched live during the conversation via HTTP tool calls."
  );
  live.append(
    kv([
      ["Open", `${data.hours.days}, ${data.hours.open} to ${data.hours.close}`],
      ["Slots", `${data.hours.slot_minutes} minutes long`],
    ])
  );
  live.append(el("p", "block-note", "Available Hair Salon Services:"));
  live.append(pills(data.services.map((s) => s.key)));
  live.append(el("p", "block-note", "Upcoming open days & live availability:"));
  for (const day of data.days) {
    const card = el("div", "day");
    const head = el("div", "day-head");
    head.append(
      el("span", "day-name", day.label),
      el("span", "day-count", `${day.total} free`)
    );
    const slots = el("div", "slots");
    for (const slot of day.slots) slots.append(el("span", "slot", slot));
    card.append(head, slots);
    live.append(card);
  }

  infoEls.body.append(config, live);
}

function onInfoKey(event) {
  if (event.key === "Escape") closeInfo();
}

async function openInfo() {
  infoEls.modal.hidden = false;
  document.addEventListener("keydown", onInfoKey);

  try {
    renderInfo(await fetch("/api/demo-info").then((r) => r.json()));
  } catch (_) {
    infoEls.body.textContent = "Could not load demo data. Is the server running?";
  }
}

function closeInfo() {
  infoEls.modal.hidden = true;
  document.removeEventListener("keydown", onInfoKey);
  infoEls.btn.focus();
}

if (infoEls.btn) infoEls.btn.addEventListener("click", openInfo);
if (infoEls.modal) {
  for (const node of infoEls.modal.querySelectorAll("[data-close]")) {
    node.addEventListener("click", closeInfo);
  }
}

// -------------------------------------------------------- live email form init
function initLiveEmailBox() {
  if (els.btnToggleEmail) {
    els.btnToggleEmail.addEventListener("click", () => {
      if (!els.liveEmailBox) return;
      if (els.liveEmailBox.style.display === "none") {
        showLiveEmailBox();
      } else {
        hideLiveEmailBox();
      }
    });
  }

  if (els.liveEmailInput) {
    els.liveEmailInput.addEventListener("input", () => {
      const val = els.liveEmailInput.value.trim();
      if (!val) {
        els.liveEmailInput.className = "live-email-input";
        if (els.liveEmailCheck) els.liveEmailCheck.textContent = "";
        if (els.liveEmailFeedback) els.liveEmailFeedback.style.display = "none";
        return;
      }
      const clean = val.replace(/\s+/g, "").toLowerCase();
      const parts = clean.split("@");
      if (parts.length === 2 && DOMAIN_TYPOS[parts[1]]) {
        const fixed = `${parts[0]}@${DOMAIN_TYPOS[parts[1]]}`;
        els.liveEmailFeedback.className = "live-email-feedback suggestion";
        els.liveEmailFeedback.style.display = "block";
        els.liveEmailFeedback.innerHTML = `Did you mean <strong>${fixed}</strong>? <span style="text-decoration:underline; cursor:pointer;">Click to apply</span>`;
        els.liveEmailFeedback.onclick = () => {
          els.liveEmailInput.value = fixed;
          els.liveEmailInput.dispatchEvent(new Event("input"));
        };
        return;
      }
      if (EMAIL_REGEX.test(clean)) {
        els.liveEmailInput.className = "live-email-input valid";
        if (els.liveEmailCheck) {
          els.liveEmailCheck.textContent = "✓";
          els.liveEmailCheck.style.color = "#16a34a";
        }
        if (els.liveEmailFeedback) els.liveEmailFeedback.style.display = "none";
      } else {
        els.liveEmailInput.className = "live-email-input invalid";
        if (els.liveEmailCheck) {
          els.liveEmailCheck.textContent = "•";
          els.liveEmailCheck.style.color = "#ef4444";
        }
        if (els.liveEmailFeedback) {
          els.liveEmailFeedback.className = "live-email-feedback error";
          els.liveEmailFeedback.style.display = "block";
          els.liveEmailFeedback.textContent = "Incomplete email address (e.g. name@gmail.com)";
          els.liveEmailFeedback.onclick = null;
        }
      }
    });
  }

  if (els.liveEmailForm) {
    els.liveEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = els.liveEmailInput.value.trim();
      if (!raw) return;

      if (els.btnSendEmail) {
        els.btnSendEmail.disabled = true;
        els.btnSendEmail.textContent = "Verifying...";
      }

      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: raw, business_id: "biz_demo_dental" })
        });
        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.message || "Invalid email address");
        }

        const cleanEmail = data.email;
        els.liveEmailInput.value = cleanEmail;
        els.liveEmailInput.className = "live-email-input valid";
        if (els.liveEmailCheck) els.liveEmailCheck.textContent = "✓";
        if (els.liveEmailFeedback) {
          els.liveEmailFeedback.className = "live-email-feedback success";
          els.liveEmailFeedback.style.display = "block";
          els.liveEmailFeedback.innerHTML = `✓ Verified email: <strong>${cleanEmail}</strong> ${data.auto_corrected ? '<span style="color:#0284c7; font-size:11px;">(auto-corrected)</span>' : ''} ${data.mailbox_verified ? '<span style="color:#16a34a; font-weight:600; font-size:11px;">• Mailbox Active ✓</span>' : (data.dns_verified ? '<span style="color:#16a34a; font-size:11px;">• DNS Valid</span>' : '')}`;
        }

        addLine("user", `My email address is ${cleanEmail}`);
        appCallerEmail = cleanEmail;

        if (ws && ws.readyState === WebSocket.OPEN) {
          const promptPrefix = appBasePrompt ? `${appBasePrompt}\n\n` : "";
          // 1. Update mutable system_prompt with customer email and require verbal confirmation
          ws.send(JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: `${promptPrefix}[CUSTOMER EMAIL PROVIDED: "${cleanEmail}"] The caller provided their email: "${cleanEmail}". Say: "Thank you. I have your email as ${cleanEmail}, is that correct?" and WAIT for the caller's verbal confirmation. Do NOT call book_appointment until the caller confirms yes. If caller says no, apologize and ask for the corrected email.`
            }
          }));

          // 2. Trigger agent's verbal turn to confirm the email
          ws.send(JSON.stringify({
            type: "reply.create",
            instructions: `The caller provided their email: "${cleanEmail}". Say warmly: "Thank you. I have your email as ${cleanEmail}, is that correct?" and wait for the caller to confirm.`
          }));
        }

        if (appEmailHideTimer) clearTimeout(appEmailHideTimer);
        appEmailHideTimer = setTimeout(() => {
          hideLiveEmailBox();
        }, 4000);

      } catch (err) {
        if (els.liveEmailFeedback) {
          els.liveEmailFeedback.className = "live-email-feedback error";
          els.liveEmailFeedback.style.display = "block";
          els.liveEmailFeedback.textContent = err.message;
        }
      } finally {
        if (els.btnSendEmail) {
          els.btnSendEmail.disabled = false;
          els.btnSendEmail.innerHTML = `<span>Verify &amp; Send</span> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        }
      }
    });
  }
}

initLiveEmailBox();
