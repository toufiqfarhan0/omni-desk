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

// ------------------------------------------------------------ transcript

function addLine(who, text) {
  clearEmpty(els.transcript);

  const row = document.createElement("div");
  row.className = `line ${who}`;

  const label = document.createElement("span");
  label.className = "who";
  label.textContent = who === "agent" ? "Brightsmile Assistant" : "You";

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

  // Refresh owner stats if a booking tool was executed
  if (event.tool === "book_appointment" || event.tool === "send_confirmation") {
    loadOwnerStats();
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
        turn_detection: {
          interrupt_response: true,
          interruption_delay: 0,
        },
      },
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case "session.ready":
        live = true;
        setStatus("Live", "live");
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
        break;

      case "input.speech.started":
        stopPlayback(); // instantaneous barge-in cut
        break;

      case "transcript.user":
        addLine("user", msg.text);
        break;

      case "transcript.agent":
        addLine("agent", msg.text);
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

  clearInterval(pollTimer);
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

sheet.btn.addEventListener("click", openSheet);
sheet.closeBtn.addEventListener("click", closeSheet);
sheet.backdrop.addEventListener("click", closeSheet);

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
          <td><span style="font-family: var(--mono); font-size: 12px; color: var(--text-secondary);">${a.phone}</span></td>
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
          <td><span style="font-family: var(--mono); font-size: 12px;">${c.phone}</span></td>
          <td><span class="tenant-badge">${c.appointments_count} visit${c.appointments_count === 1 ? "" : "s"}</span></td>
          <td>${c.last_service || "Dental Checkup"} <span style="color: var(--text-muted); font-size: 11px;">(${c.last_date})</span></td>
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
          <p class="service-desc">${s.description || "Clinical service offering for oral health and patient care."}</p>
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
  live.append(el("p", "block-note", "Available Dental Services:"));
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

infoEls.btn.addEventListener("click", openInfo);
for (const node of infoEls.modal.querySelectorAll("[data-close]")) {
  node.addEventListener("click", closeInfo);
}
