# OmniDesk — Autonomous Voice Receptionist & Booking Platform

OmniDesk is an autonomous voice receptionist platform built on the AssemblyAI Voice Agent API. It uses direct server-side HTTP tools to handle dynamic appointment scheduling, live calendar lookups, and customer confirmations without requiring a persistent runtime tool dispatcher during the call.

The platform includes a sleek, light-mode web dashboard featuring live voice streaming with instantaneous barge-in, a real-time HTTP tool inspector, and an Owner Console slide-over sheet for practice management.

---

## System Architecture

```text
                  OMNIDESK PLATFORM
                          |
           +--------------+--------------+
           |                             |
     BUSINESS OWNER                   CUSTOMER
           |                             |
           v                             v
     Create Business               Visit / Call
           |                             |
           v                             v
     Configure AI Agent ----------> Voice Agent
           |                             |
           |                             v
           |                        Conversation
           |                             |
           |                             v
           |                       Booking Request
           |                             |
           +-----------------------------+
                                         |
                                         v
                                  Booking Engine
                                         |
                                         v
                                      Database
                                         |
                          +--------------+--------------+
                          v                             v
                    Owner Dashboard                  Customer
                    (sees booking)              (gets confirmation via
                                              Resend Email + .ics Invite)
```

---

## Key Capabilities

- **Server-Side HTTP Tools**: AssemblyAI executes tool endpoints directly against your booking API. No client-side tool dispatcher is required.
- **Ultra-Low Latency & Instant Barge-In**: Audio playback is managed through Web Audio scheduling (`playHead = Math.max(playHead, audioCtx.currentTime)`), cutting off agent speech instantaneously when the caller begins speaking (`input.speech.started`).
- **Owner Console (Slide-over Sheet)**: A slide-over panel designed with Emil Kowalski design engineering principles and Better UI standards, providing:
  - **Overview**: Real-time KPI cards for today's bookings, upcoming schedule, and confirmed revenue.
  - **Calendar**: Complete tabular log of all confirmed appointments, confirmation codes, and slot times.
  - **Customers**: Caller directory tracking client visit frequency and previous services.
  - **Services**: Clinical service catalog with configurable pricing and duration.
  - **AI Agent**: Phonetic boost vocabulary (keyterms), voice parameters, and tool endpoints.
  - **Settings**: Practice hours and Resend confirmation engine configuration.
- **Transactional Confirmation Engine**: Sends HTML booking receipts accompanied by native `.ics` calendar events for 1-tap addition to Google Calendar, Apple Calendar, and Microsoft Outlook.

---

## Directory Structure

```text
assemblyai-voice-agent-scheduler/
|-- app/
|   |-- __init__.py
|   |-- main.py           # FastAPI application & HTTP tool endpoints
|   |-- store.py          # In-memory booking store & deterministic slot engine
|-- scripts/
|   |-- create_agent.py   # Registers or updates the agent definition on AssemblyAI
|-- web/
|   |-- index.html        # Light-mode dashboard with Owner Console sheet
|   |-- app.js            # AudioWorklet client, WebSocket stream & sheet logic
|   |-- worklet.js        # Float32 to PCM16 audio converter worklet
|-- agent.json            # Agent identity, voice settings, and HTTP tool schemas
|-- requirements.txt      # Python dependencies
|-- .env.example          # Environment variable template
```

---

## Prerequisites

- Python 3.10+
- AssemblyAI API Key ([assemblyai.com](https://www.assemblyai.com/))
- Public HTTPS tunneling utility (Cloudflare Tunnel or ngrok)

---

## Getting Started

### 1. Environment Setup

Clone the repository and install dependencies into a virtual environment:

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create your `.env` configuration:

```bash
cp .env.example .env
```

Set your AssemblyAI API key inside `.env`:

```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

---

### 2. Start the Booking API

Launch the local FastAPI service:

```bash
uvicorn app.main:app --port 8000 --reload
```

Verify the service is running:

```bash
curl http://localhost:8000/health
```

---

### 3. Expose the API to the Public Internet

Because AssemblyAI executes HTTP tools directly from its cloud infrastructure, your local server must be reachable via a public HTTPS URL.

#### Option A: Cloudflare Tunnel (Recommended)

```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the generated URL (e.g., `https://your-tunnel-subdomain.trycloudflare.com`) and add it to `.env`:

```env
PUBLIC_API_BASE_URL=https://your-tunnel-subdomain.trycloudflare.com
```

#### Option B: ngrok

```bash
ngrok http 8000
```

Copy the forwarding HTTPS URL and add it to `.env`:

```env
PUBLIC_API_BASE_URL=https://your-subdomain.ngrok-free.app
```

Verify public connectivity:

```bash
curl -X POST https://your-tunnel-subdomain.trycloudflare.com/tools/get_today
```

---

### 4. Publish the Voice Agent

Run the provisioning script to upload `agent.json` and tool schemas to AssemblyAI:

```bash
python scripts/create_agent.py
```

The script will output your unique `agent_id` (e.g., `agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) and save it to `agent_id.txt` and `.env`.

To update an existing agent after modifying `agent.json`:

```bash
python scripts/create_agent.py --update <agent_id>
```

---

### 5. Open the Dashboard

Navigate to `http://localhost:8000` in your web browser.

1. **Start Call**: Click "Start Call" to initiate a real-time bidirectional audio stream.
2. **Talk Naturally**: Speak to the agent (e.g., *"Hi, I'd like to schedule a dental cleaning for next Tuesday morning"*).
3. **Interrupt Any Time**: Speak while the agent is replying; barge-in cuts the agent's playback instantly.
4. **Live Tool Stream**: Observe real-time HTTP tool hits on the right pane.
5. **Owner Dashboard**: Click "Owner Dashboard" in the top header to slide open the management sheet and view live bookings, customer metrics, and services.

---

## HTTP Tool Specifications

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/tools/get_today` | POST | Returns current system date and upcoming open weekdays. Prevents date hallucinations. |
| `/tools/check_availability` | POST | Validates service key, checks practice hours, and returns open slots. |
| `/tools/book_appointment` | POST | Reserves the requested slot, prevents double booking, and generates a 6-character confirmation code. |
| `/tools/send_confirmation` | POST | Triggers the customer confirmation dispatch (Resend Email with `.ics` calendar invite). |

---

## License

MIT License.
