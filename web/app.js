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

// Playback scheduling. Holding the sources lets barge-in cut the agent off.
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
  if (!timerTick) return; // never connected, so nothing to hold
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
  label.textContent = who === "agent" ? "Agent" : "You";

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
      chip.title = "Show this call";
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
  const name = document.createElement("span");
  name.className = "call-name";
  name.textContent = event.tool;
  const time = document.createElement("span");
  time.className = "call-time";
  time.textContent = event.at;
  head.append(name, time);
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
  msg.textContent = (event.result && event.result.message) || "(no message)";
  card.append(msg);

  els.calls.append(card);
  els.calls.scrollTop = els.calls.scrollHeight;

  callTotal += 1;
  els.count.textContent = `${callTotal} call${callTotal === 1 ? "" : "s"}`;
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
    /* transient; the next tick retries */
  }
}

// ---------------------------------------------------------------- audio

function playChunk(int16) {
  const buffer = audioCtx.createBuffer(1, int16.length, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (playHead < now) playHead = now + 0.04;
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
      /* already finished */
    }
  }
  scheduled = [];
  playHead = 0;
}

// --------------------------------------------------------------- session

async function start() {
  resetTimer(); // clear the previous call's duration
  setStatus("Connecting", "busy");
  els.talk.disabled = true;

  let token;
  try {
    const res = await fetch("/api/token");
    if (!res.ok) throw new Error((await res.text()).slice(0, 200));
    token = (await res.json()).token;
  } catch (err) {
    setStatus("No token", "error");
    addLine("agent", `Could not mint a token: ${err.message}`);
    els.talk.disabled = false;
    return;
  }

  const config = await fetch("/api/config").then((r) => r.json());
  if (!config.agent_id) {
    setStatus("No agent", "error");
    addLine("agent", "Run scripts/create_agent.py first, then reload this page.");
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
    setStatus("No microphone", "error");
    addLine("agent", "Microphone access was blocked. Allow it and try again.");
    els.talk.disabled = false;
    return;
  }

  audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  await audioCtx.audioWorklet.addModule("/worklet.js");

  ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "session.update", session: { agent_id: config.agent_id } }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case "session.ready":
        live = true;
        setStatus("Live", "live");
        els.talk.disabled = false;
        els.talk.textContent = "End call";
        els.talk.classList.add("ending");
        startTimer();
        pollTimer = setInterval(pollEvents, POLL_MS);
        break;

      case "input.speech.started":
        stopPlayback(); // the caller cut in
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
  workletNode.connect(audioCtx.destination); // keeps the graph pulling
}

function stop() {
  // Closing the socket bare leaves a 30s resume window that still bills.
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
  stopTimer(); // freeze the duration, don't clear it

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
  els.talk.textContent = "Start call";
  els.talk.classList.remove("ending");
  setStatus("Idle", "idle");
  pollEvents(); // catch anything that landed as the call closed
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

// ----------------------------------------------------------- demo data

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
    "Uploaded once by scripts/create_agent.py. AssemblyAI stores this and never asks you for it again — it is the agent's identity, not its data."
  );
  config.append(kv([
    ["Name", data.agent.name],
    ["Voice", data.agent.voice],
  ]));
  config.append(el("p", "block-note", "Tools it is allowed to call:"));
  config.append(pills(data.agent.tools.map((t) => t.name), "tool"));
  if (data.agent.keyterms.length) {
    config.append(el("p", "block-note", "Words boosted so the transcriber hears them correctly:"));
    config.append(pills(data.agent.keyterms));
  }

  const live = block(
    "What it can see",
    "your booking API",
    "None of this is in the JSON. The agent has no calendar of its own — it finds all of this out by calling your API while you talk to it."
  );
  live.append(kv([
    ["Open", `${data.hours.days}, ${data.hours.open} to ${data.hours.close}`],
    ["Slots", `${data.hours.slot_minutes} minutes long`],
  ]));
  live.append(el("p", "block-note", "Services you can ask for:"));
  live.append(pills(data.services.map((s) => s.key)));
  live.append(el("p", "block-note", "Next open days, and what is genuinely free right now:"));
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
  infoEls.modal.querySelector(".icon-btn").focus();

  // Always refetch — slots change as the agent books them.
  try {
    renderInfo(await fetch("/api/demo-info").then((r) => r.json()));
  } catch (_) {
    infoEls.body.textContent = "Could not load demo data. Is the booking API running?";
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
