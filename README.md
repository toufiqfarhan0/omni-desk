# assemblyai-voice-agent-scheduler

A voice agent that books real dental appointments, built on AssemblyAI's Voice
Agent API using **server-side HTTP tools** — so there is no tool dispatcher and
nothing of yours stays connected during a call.

Reference implementation for the tutorial *"Ship a Voice Agent That Books
Appointments Without Writing a Tool Dispatcher"*, written for the
[AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon).

## The idea

Most voice-agent tutorials put your program in the middle of every call:

```
caller <-> AssemblyAI <-> your script (connected all call) <-> your logic
                          listens for tool.call, replies with tool.result
```

This one doesn't. You describe the agent once as JSON, hand AssemblyAI a set of
URLs, and it calls your API itself:

```
caller <-> AssemblyAI --HTTP POST--> your booking API
```

Close your laptop and the agent still answers.

## 1. Install and run the API

```bash
python -m venv .venv
.venv/Scripts/activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload   # http://localhost:8000
```

Check it answers:

```bash
curl -X POST http://localhost:8000/tools/get_today
```

## 2. Put the API on the public internet

**This is the step people get stuck on.** AssemblyAI calls your tools from its
own servers, so `http://localhost:8000` is unreachable to it — and the publish
script rejects it rather than letting you find out mid-call. You need a public
**HTTPS** URL. Two easy ways:

### Option A — ngrok

```bash
ngrok http 8000
```

It prints a forwarding line. Copy the **https** one:

```
Forwarding   https://a1b2-102-89-33-14.ngrok-free.app -> http://localhost:8000
```

Your value is `https://a1b2-102-89-33-14.ngrok-free.app`

### Option B — Cloudflare Tunnel

No account needed for a quick tunnel:

```bash
cloudflared tunnel --url http://localhost:8000
```

It prints a URL like:

```
https://formal-tribune-serving-mathematics.trycloudflare.com
```

Your value is `https://formal-tribune-serving-mathematics.trycloudflare.com`

### Either way

Put it in `.env` with **no trailing slash**:

```bash
PUBLIC_API_BASE_URL=https://a1b2-102-89-33-14.ngrok-free.app
```

Confirm the outside world can actually reach it before going further:

```bash
curl -X POST https://a1b2-102-89-33-14.ngrok-free.app/tools/get_today
```

If that returns today's date, AssemblyAI can reach it too.

> **These URLs change.** Both free tiers hand you a new address every restart.
> When yours changes, update `.env` and re-run the publish script with
> `--update <agent_id>` — otherwise the agent keeps calling a dead URL and every
> tool times out mid-conversation.

## 3. Publish the agent

Copy `.env.example` to `.env` and fill in `ASSEMBLYAI_API_KEY`
([free account, $50 of non-expiring credit](https://www.assemblyai.com/dashboard)),
then:

```bash
python scripts/create_agent.py
```

It checks your public URL is live, uploads `agent.json`, and prints an
`agent_id` (also written to `agent_id.txt`). After editing `agent.json`:

```bash
python scripts/create_agent.py --update <agent_id>
```

## 4. Talk to it

Open <http://localhost:8000> and press **Start call**. Ask to book a cleaning
for next Tuesday.

The left pane is the conversation. The right pane fills with the HTTP calls
AssemblyAI makes to your booking API while you talk — no code in the browser
handles them, it is reading your API's own log. Each agent reply carries chips
naming the tool calls behind it; click one to jump to it.

Your API key never reaches the browser: `GET /api/token` mints a 5-minute token
server-side and the socket authenticates with that.

## Layout

| Path | What it is |
| --- | --- |
| `agent.json` | The whole agent: prompt, voice, keyterms, 4 HTTP tools |
| `app/main.py` | Booking API — the endpoints AssemblyAI calls |
| `app/store.py` | In-memory calendar and the demo event log |
| `scripts/create_agent.py` | Publishes `agent.json` to `/v1/agents` |
| `web/` | The demo page: mic capture, transcript, live tool feed |

## The four tools

| Tool | Why it exists |
| --- | --- |
| `get_today` | The model has no clock. Without this it guesses dates, and guesses wrong. |
| `check_availability` | Returns open slots, or the next open day when closed or full. |
| `book_appointment` | Reserves the slot, returns a confirmation code. |
| `send_confirmation` | Texts the caller their code. |

Every response carries an `ok` flag and a `message` written to be read aloud.
Failures are values, not exceptions — `slot_taken` comes back with the times
still free, so the agent recovers inside the conversation instead of
apologising and hanging up.

## Two layers of validation, and which to use

The tool schemas use `pattern`, `enum` and `examples`. Values failing those are
rejected *before* your API is called and the agent re-asks. That is the right
place for anything the agent can fix by listening again.

It is the wrong place for anything the agent needs *explained*. An early version
of this project put strict E.164 (`+` and country code) in the phone `pattern`.
A caller reading a Nigerian number aloud — `091 6383 6950` — failed it, and
because schema rejection is opaque, the agent told the caller the booking system
was broken and offered a callback. The booking was lost.

The fix was to loosen the pattern to "looks like a phone number" and normalise
inside the API, which can answer with something speakable:

```json
{ "ok": false,
  "reason": "needs_country_code",
  "message": "I have the number but not the country code. Ask the caller which
              country they're calling from..." }
```

Now the agent asks the right question and the call completes. **Schema for what
the agent can fix by re-asking; your API for what it needs explained.**

## Deploying it

A tunnel is fine while you build, but the URL dies with your terminal. To put
this somewhere permanent, note one thing first: **the calendar and the tool-call
feed live in memory**, so this wants a long-running process, not a serverless
function.

On Render, Railway or Fly it deploys as-is:

```
Build:  pip install -r requirements.txt
Start:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set `ASSEMBLYAI_API_KEY` in the host's environment, then point the agent at the
new address and re-publish:

```bash
PUBLIC_API_BASE_URL=https://your-app.onrender.com
python scripts/create_agent.py --update <agent_id>
```

Vercel supports FastAPI too, but its functions are ephemeral and can run on
different instances per request. The browser polls `/api/events` several times a
second, so it would keep missing calls that landed elsewhere. Move `store.py`
onto a real database first and it works fine.

You never need server-side WebSockets, whatever you choose. The browser talks
straight to AssemblyAI; your API only ever answers plain HTTP.

## Where to take it next

This is a starting point, not a finished product. Obvious directions:

- **Swap the in-memory store for a real database** so bookings survive restarts.
- **Send a real SMS.** `send_confirmation` currently just marks a flag. Wire it
  to Twilio, Africa's Talking, or whatever covers your region.
- **Add reschedule and cancel tools.** Both need the agent to look an
  appointment up by confirmation code first, which is a good exercise in
  keeping tool sets small — the docs suggest staying under ten per phase.
- **Handle the caller who wants the first available slot** rather than naming a
  day, which means a tool that searches forward instead of checking one date.
- **Put it on a phone number.** Deliberately left out here: Twilio trial numbers
  only dial numbers you have verified in advance, so nobody else could ring it.
  Once you are on a paid number, AssemblyAI connects over SIP.

## Licence

MIT. Use it, fork it, ship it.
