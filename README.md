# OmniDesk

**A general-purpose, multi-tenant voice receptionist platform built on AssemblyAI's Voice Agent API.**

Any business — a legal firm, a plumbing company, a dental clinic — can register a profile. From that point, calls are handled automatically: the agent checks availability, books appointments, answers FAQs, and escalates emergencies. When the call ends, AssemblyAI's LeMUR engine processes the full transcript and delivers a structured executive dossier to the business owner's Discord channel in under three seconds.

No WebSocket dispatcher. No long-lived server process. No per-call backend maintenance.

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) on lablab.ai.

---

## How it works

OmniDesk runs two complementary patterns in sequence.

**During the call — Pattern 1: Stored Agent + HTTP Tools**

The agent is defined once as a JSON document and uploaded to AssemblyAI. When a caller asks anything that requires live data — availability, business hours, pricing, a booking — AssemblyAI's cloud servers send an HTTP POST to your FastAPI backend directly. Your server answers with a sentence the agent reads aloud. There is no dispatcher loop, no session-scoped WebSocket handler, and no code that has to stay running on your machine for the agent to function.

**After the call — Pattern 6: Async LeMUR Intelligence**

The moment the caller hangs up, the full transcript is piped to AssemblyAI's LeMUR engine. LeMUR extracts a structured dossier: caller intent, urgency score, sentiment trajectory, a two-sentence executive summary, a checklist of action items, and a pre-written follow-up message. The dossier appears in the owner's Discord channel and on the live dashboard within seconds.

```
Caller Browser  ──── WebSocket ────►  AssemblyAI Voice Agent (Stored agent.json)
                                                  │
                                      HTTP POST (Zero Dispatcher)
                                                  │
                     Cloudflare Tunnel  ──►  FastAPI /tools/*
                                                  │
                                         SQLite  +  Tool Logger
                                                  │
                                       Call ends (session.end)
                                                  │
                                        Async LeMUR Pipeline
                                                  │
                                 ┌────────────────┼──────────────┐
                            Dossier JSON      SQLite         Discord
                                              Stored         Rich Embed
```

---

## Architecture

### Two patterns, one product

| Layer | Technology | Role |
| :--- | :--- | :--- |
| Voice Interaction | AssemblyAI Voice Agent API (Universal-3 Pro) | STT, VAD, LLM reasoning, TTS, turn-taking |
| Post-Call Intelligence | AssemblyAI LeMUR | Transcript analysis, dossier extraction |
| API Backend | FastAPI + Uvicorn | REST endpoints for all HTTP tools and dashboard APIs |
| Data Persistence | SQLite (built-in) | Tenants, bookings, call records, LeMUR dossiers, tool event log |
| Public HTTPS Ingress | Cloudflare Tunnel (cloudflared) | Free public HTTPS so AssemblyAI can reach local tool endpoints |
| Notifications | Discord Webhooks | Rich embed cards delivered to the business owner's channel at call end |
| Frontend | Vanilla HTML5 + CSS + JS | Light-mode SPA — Call view, Dossiers, Tenants, Appointments |

### Multi-tenancy without overhead

Each business is a row in the `tenants` SQLite table:

```json
{
  "tenant_id": "apex-legal",
  "business_name": "Apex Legal Partners",
  "persona": "A formal, professional legal intake receptionist.",
  "greeting": "Thank you for contacting Apex Legal Partners. Are you a new or existing client?",
  "operating_hours": { "days": "Monday to Friday", "open": "08:30", "close": "18:00" },
  "services": {
    "consultation": { "label": "Initial Legal Consultation", "minutes": 45 },
    "case-review": { "label": "Document and Case Review", "minutes": 60 }
  },
  "faq": {
    "retainer": "Initial retainers start at $2,500 depending on case type.",
    "parking": "Validated parking is available underground at 400 Madison Ave."
  },
  "discord_webhook": "https://discord.com/api/webhooks/..."
}
```

The same `agent.json` serves every tenant. When the agent needs to answer a question or check a calendar, the `query_business_info` and `check_availability` tools read the active tenant's profile from SQLite and return a sentence shaped for speech. No re-deployment, no code change, no agent re-publish.

### The five HTTP tools

| Tool | Parameters | What it does |
| :--- | :--- | :--- |
| `get_today` | — | Returns the current date and next three open business days. Prevents LLM date hallucinations. |
| `query_business_info` | `topic`, `tenant_id` | Reads FAQ entries, pricing, and policies from the tenant profile. Returns a spoken sentence. |
| `check_availability` | `service`, `date`, `tenant_id` | Checks live slot availability. Returns open times or, if full, the next day with openings. |
| `book_appointment` | `service`, `date`, `time`, `customer_name`, `phone`, `tenant_id` | Locks the slot, writes the booking to SQLite, returns a confirmation code. |
| `escalate_urgent_issue` | `caller_name`, `phone`, `reason`, `tenant_id` | Fires an immediate Discord alert to the business owner without waiting for the call to end. |

### Discord alert flow

The business owner sets this up once:

1. Discord: Channel Settings > Integrations > Webhooks > New Webhook > Copy URL.
2. OmniDesk Settings page: paste the URL into the Discord Webhook field and save.
3. Done. Every call that ends posts a rich embed to that channel. No bot, no OAuth, no server required.

Emergency escalations (`escalate_urgent_issue`) fire during the call. Standard dossiers fire at call end. Both land in the same channel, building a searchable call history the owner can scroll through on any device.

---

## Setup

### Requirements

- Python 3.11+
- An AssemblyAI account with an API key. [Sign up](https://www.assemblyai.com/dashboard) — new accounts receive $50 in non-expiring credit.
- Cloudflare Tunnel (`cloudflared`) for a free public HTTPS address. [Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
- A browser with microphone access (Chrome or Edge recommended).
- A Discord server with a webhook URL if you want call notifications.

### Installation

```bash
git clone https://github.com/toufiqfarhan0/omni-desk.git
cd omni-desk
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```env
ASSEMBLYAI_API_KEY=your_key_here
AGENT_ID=                        # filled in after create_agent.py runs
PUBLIC_API_BASE_URL=             # filled in after cloudflared tunnel starts
DISCORD_WEBHOOK_URL=             # optional — paste your Discord webhook URL
```

### Running locally

Open three terminals in the project directory.

**Terminal 1 — API server:**
```bash
.venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 — Public HTTPS tunnel:**
```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the `https://...trycloudflare.com` URL from the output and paste it into `.env` as `PUBLIC_API_BASE_URL`.

**Terminal 3 — Publish the agent:**
```bash
.venv\Scripts\activate
python scripts/create_agent.py
```

This verifies the API is reachable, uploads the agent definition to AssemblyAI, and writes the returned `agent_id` to `agent_id.txt` and your `.env`.

Open `http://localhost:8000`, select a demo tenant, and press Start call.

### Updating the agent after a tunnel restart

Cloudflare's free tunnels issue a new URL on every restart. When the URL changes:

```bash
# Update PUBLIC_API_BASE_URL in .env, then:
python scripts/create_agent.py --update <agent_id>
```

---

## Project structure

```
omni-desk/
├── agent.json              Universal agent definition (uploaded once to AssemblyAI)
├── app/
│   ├── main.py             FastAPI application — all tool and dashboard endpoints
│   ├── store.py            Multi-tenant SQLite store — tenants, bookings, events
│   ├── db.py               Schema creation and connection factory
│   ├── lemur.py            Async LeMUR wrapper — dossier extraction and parsing
│   └── discord.py          Discord webhook embed builder and sender
├── web/
│   ├── index.html          Light-mode SPA — 4 views served by FastAPI StaticFiles
│   ├── app.js              Navigation, WebSocket audio, polling, dossier rendering
│   └── worklet.js          AudioWorklet PCM processor for 24kHz microphone capture
├── scripts/
│   └── create_agent.py     Publishes or updates the agent on AssemblyAI
├── .env.example
├── requirements.txt
└── README.md
```

---

## Dashboard views

**Call**
The active voice session. Left column shows selectable tenant profiles. Center shows the audio waveform, agent state, and live transcript. Right column shows each HTTP tool hit as AssemblyAI fires it — request, response, timing — updating in real time without any browser-side tool handling.

**Dossiers**
The post-call intelligence feed. One card per completed call. Each card shows the caller, intent, urgency level (1 low to 5 critical), sentiment, the executive summary, action items, and a copy-ready follow-up message. Cards animate in at call end.

**Tenants**
Business profile manager. Create or edit a tenant: name, persona, greeting, operating hours, services, FAQ entries, and Discord webhook. A test button fires a sample embed to confirm the webhook is live before the next real call.

**Appointments**
A ledger of all bookings across all tenants with status tracking: Confirmed, Pending, Escalated.

---

## Known constraints

The Cloudflare free-tier tunnel URL changes on every process restart. For a stable public URL, deploy the FastAPI app to Render, Railway, or Fly.io and set `PUBLIC_API_BASE_URL` to that domain permanently.

The in-memory event log resets when the server restarts. Tool events older than the current process are not available, though all bookings and dossiers persist in SQLite.

`send_confirmation` simulates an SMS — it marks the booking as confirmed and returns a message indicating the text was sent. Integrating a real SMS provider (Twilio, Africa's Talking) requires replacing that endpoint's body and adding the provider's credentials to `.env`.

---

## Deployment

The API is a standard ASGI application. Deploy on any platform that runs a persistent Python process:

```
Build command:  pip install -r requirements.txt
Start command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set `ASSEMBLYAI_API_KEY` and `DISCORD_WEBHOOK_URL` as environment variables on the host, then update and re-publish the agent:

```bash
PUBLIC_API_BASE_URL=https://your-app.onrender.com
python scripts/create_agent.py --update <agent_id>
```

Avoid serverless platforms (Vercel functions, AWS Lambda cold-start configs) for the demo panel — the `/api/events` polling endpoint is hit several times per second during a live call and requires a single persistent process to maintain the in-memory event buffer.

---

## Frequently asked questions

**Does OmniDesk need a WebSocket connection to stay open during a call?**
No. The browser maintains a WebSocket to AssemblyAI for audio only. Your server receives only plain HTTP POST requests from AssemblyAI's cloud when a tool is invoked. The server can restart mid-call and tool calls will resume normally once it is back up.

**What happens if the Discord webhook is not set?**
The webhook field is optional. When empty, dossiers are saved to SQLite and displayed in the dashboard only. The rest of the call flow is unaffected.

**Can I add a new tenant without restarting the server?**
Yes. Tenants are created via the Settings view or the `POST /api/tenants` endpoint at runtime. No server restart or agent re-publish is required.

**Can I add more tools?**
Yes. Add a FastAPI endpoint under `/tools/`, add the schema and `http` block to `agent.json`, and re-run `create_agent.py --update`. The agent picks up the new tool on the next call without any dispatcher change.

**Can I use a real LLM instead of AssemblyAI's built-in model?**
Yes. Add an `llm` block to `agent.json` with `base_url`, `model`, and `api_key` pointing to any OpenAI-compatible endpoint. Latency becomes your responsibility; keep first-token time under 400ms for natural conversation.

---

## License

MIT
