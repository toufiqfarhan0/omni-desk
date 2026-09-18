# OmniDesk — Autonomous Voice Receptionist & Scheduling Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-omni--desk--rho.vercel.app-blue?style=flat&logo=vercel)](https://omni-desk-rho.vercel.app)
[![AssemblyAI](https://img.shields.io/badge/Powered%20by-AssemblyAI%20Voice%20Agents-blueviolet?style=flat)](https://www.assemblyai.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20App%20Router-black?style=flat&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react)](https://react.dev)

OmniDesk is an autonomous, full-stack voice receptionist and appointment scheduling platform powered by the **AssemblyAI Voice Agent API**. It pairs real-time bidirectional 16kHz Web Audio streaming with deterministic server-side webhook tools to execute live calendar checks, appointment bookings, spoken email deliverability validation, and automated RFC 5545 calendar invite dispatch.

- **Live Production URL**: [https://omni-desk-rho.vercel.app](https://omni-desk-rho.vercel.app)
- **Premier Showcase**: **OmniDesk Hair Salon & Studio (Luxe & Mane)** at [`/demo/salon`](https://omni-desk-rho.vercel.app/demo/salon)
- **Management Console**: [`/dashboard`](https://omni-desk-rho.vercel.app/dashboard)

> **Unified Next.js Full-Stack Architecture**: OmniDesk is self-contained within `src/`. All client interfaces, WebSocket voice streaming, serverless API route handlers, database persistence, and AssemblyAI tool integrations run without separate Python or microservice backends.

---

## Technical Architecture

```text
+==================================================================================================+
|                                          CLIENT TIER                                             |
|                                                                                                  |
|   Caller / Web Visitor                                Business Owner                             |
|  [ Mic / Speaker Audio ]                           [ Owner Dashboard ]                           |
|          |                                                  |                                    |
|          | (1. Request Session Token)                       | (Manage Prompts / View Bookings)   |
|          v                                                  v                                    |
|  +--------------------------------------------------------------------------------------------+  |
|  | NEXT.JS FRONTEND (React 19 / App Router)                                                   |  |
|  |   - Landing Page (/) & Premier Hair Salon Showcase (/demo/salon)                           |  |
|  |   - Floating Voice Widget (<VoiceWidget /> & /widget.js embed script)                      |  |
|  |   - Practice Owner Dashboard (/dashboard) with SSE Live Feed & Live Voice Tester           |  |
|  +--------------------------------------------------------------------------------------------+  |
+=============================================|====================================================+
                                              |
               (2. 16kHz Bidirectional Audio |
                   Streaming via WebSocket)   |
                                              v
+==================================================================================================+
|                              ASSEMBLYAI CLOUD (Voice Agent Engine)                               |
|                                                                                                  |
|   +-------------------+       +-----------------------+       +------------------------------+   |
|   | Universal-1 / STT | ----> | LLM Reasoning Engine  | ----> | Cartesia / ElevenLabs (TTS)  |   |
|   | (Voice to Text)   |       | (Prompt + Tool Calls) |       | (Text to Voice Streaming)    |   |
|   +-------------------+       +-----------------------+       +------------------------------+   |
|                                           |                                                      |
|                                           | (3. Function Webhook POST                            |
|                                           |     https://omni-desk-rho.vercel.app/tools/...)      |
+===========================================|======================================================+
                                            v
+==================================================================================================+
|                            NEXT.JS BACKEND (API Route Handlers)                                  |
|                                                                                                  |
|   /api/token                       --> Mints temporary AssemblyAI WebSocket session tokens       |
|   /tools/[id]/get_today            --> Real calendar reference & upcoming open business days     |
|   /tools/[id]/get_services         --> Dynamic pricing, duration & service catalog               |
|   /tools/[id]/verify_email         --> Normalizes spoken emails, DNS/MX check & spam validation  |
|   /tools/[id]/check_avail          --> Computes open time slots for operating schedule           |
|   /tools/[id]/book_appointment     --> Commits reservation, generates 6-char confirmation code   |
|   /tools/[id]/send_confirm         --> Dispatches calendar invite with .ics (Gmail SMTP)         |
|   /api/owner/businesses/[id]/deploy--> Syncs agent instructions & webhook tools to AssemblyAI    |
|   /api/events                      --> Server-Sent Events (SSE) real-time dashboard notifications|
+===========================================|======================================================+
                                            |
                      (4. Reads / Writes)   |
                                            v
+==================================================================================================+
|                        ADAPTIVE DATABASE ENGINE (Supabase vs SQLite)                             |
|                                                                                                  |
|   [ PRODUCTION / VERCEL DEPLOYMENT ]                [ LOCAL TESTING / JUDGES EVALUATION ]        |
|    - Automatic Cloud Mode                            - Automatic Zero-Setup SQLite Mode          |
|    - All changes populate Supabase PostgreSQL        - No external accounts or setup needed      |
|    - Persistent multi-region cloud storage           - Uses built-in 'data/omnidesk.db'          |
|    - SQLite bypassed completely on Vercel            - Pre-seeded with Hair Salon demo business  |
|                      |                                                     |                     |
|                      v                                                     v                     |
|   +------------------------------------+                +------------------------------------+   |
|   |          SUPABASE POSTGRES         |                |            LOCAL SQLITE            |   |
|   |     (Multi-Region Cloud DB)        |                |      (Built-In 'omnidesk.db')      |   |
|   +------------------------------------+                +------------------------------------+   |
+==================================================================================================+
```

---

## Key Capabilities

### 1. AssemblyAI Voice Agent Integration
- **Real-Time Bidirectional Streaming**: Ultra-low-latency 16kHz PCM audio streaming directly between the caller's browser and AssemblyAI via WebSockets.
- **Server Token Minting**: Tokens are securely minted server-side (`GET https://agents.assemblyai.com/v1/token`) so private API keys are never exposed to the client.
- **Instant Interruption Handling**: The voice engine automatically silences agent speech and clears playback buffers the millisecond the caller starts speaking.
- **Live Tool Event Visualizer**: Transcripts, tool execution arguments, and results stream in real time.

### 2. Autonomous Webhook Tools
The voice agent executes deterministic server tools during natural conversation:
- **`get_today`**: Anchors relative date references ("tomorrow", "this Friday") to the real calendar and returns upcoming open days.
- **`get_services_and_pricing`**: Returns exact service catalog keys, labels, pricing, and duration metadata.
- **`verify_customer_email`**: Converts spoken email representations (`"alex dot smith at gmail dot com"` &rarr; `"alex.smith@gmail.com"`), autocorrects common domain typos, and checks DNS/MX records.
- **`check_availability`**: Evaluates operating hours, business days, and existing reservations to present open appointment slots.
- **`book_appointment`**: Commits verified reservations, generates a unique 6-character confirmation code, and prevents double-booking.
- **`send_confirmation`**: Dispatches a transactional email (via Free Gmail SMTP) with an RFC 5545 `.ics` calendar file attached for Google Calendar, Apple Calendar, and Outlook sync.

### 3. Practice Management Dashboard (`/dashboard`)
- **AI Agent Builder**: Persona editor, voice picker, dynamic service catalog, operating hours schedule, and one-click **"Save & Deploy"** to sync tools with AssemblyAI. Includes a **read-only AssemblyAI Agent ID display** with one-click copy, automated agent provisioning, and environment agent protection.
- **Multi-Tenant Agent Isolation**: Each business maintains its own distinct `assemblyai_agent_id` in the database. Deploying a new business automatically provisions a brand-new agent ID via `POST`, strictly protecting the default salon agent (`process.env.AGENT_ID`) from being overwritten.
- **Live Voice Tester**: Interactive in-browser tester with frequency visualizer, real-time transcript stream, and an **agent deployment guard** (verifies agent is deployed before starting calls).
- **Bookings CRM**: Search, filter by status, and one-click manual Resend `.ics` confirmation trigger.
- **Call History**: Recorded conversation logs with duration, token counts, and full transcript dialogs.

---

## Directory Structure

```text
assemblyai-voice-agent-scheduler/
├── .env.example                 # Example template for environment variables
├── package.json                 # Next.js 16 & React 19 dependencies
├── public/
│   ├── widget.js                # Standalone embeddable launcher script
│   └── favicon.svg              # OmniDesk brand favicon
├── data/
│   └── omnidesk.db              # Zero-setup local SQLite database
└── src/
    ├── app/
    │   ├── page.tsx             # Marketing landing page
    │   ├── dashboard/page.tsx   # Practice management console (4 tabs)
    │   ├── demo/
    │   │   ├── page.tsx         # Interactive showroom index
    │   │   └── salon/page.tsx   # Premier Hair Salon & Studio voice booking page
    │   ├── tools/[...slug]/     # Direct root webhook tool endpoints
    │   └── api/
    │       ├── token/route.ts   # Temporary WebSocket session token minting
    │       ├── tools/[...slug]/ # API webhook tool route handlers
    │       ├── owner/           # Businesses, bookings, deployment API routes
    │       └── events/          # Server-Sent Events (SSE) live feed
    ├── components/
    │   ├── voice-widget.tsx     # Embeddable floating voice widget
    │   └── dashboard/
    │       ├── agent-builder.tsx# Persona prompt, voice picker, catalog manager
    │       ├── voice-tester.tsx # Live audio tester with deployment guard
    │       ├── bookings-crm.tsx # Appointments table & calendar invite trigger
    │       └── call-history.tsx # Recorded conversation logs & transcripts
    └── lib/
        ├── assemblyai.ts        # Token minting, tool registration, agent deploy
        ├── audio.ts             # Browser PCM16 audio capture, playback & visualizer
        ├── calendar.ts          # RFC 5545 .ics generator & Gmail SMTP client
        ├── email-verify.ts      # Spoken email normalizer & DNS MX validator
        ├── db.ts                # Local SQLite persistence (better-sqlite3)
        ├── supabase-db.ts       # Cloud Supabase PostgreSQL persistence
        └── tools-handler.ts     # Core tool execution business logic
```

---

## Quick Setup Guide

### 1. Install Dependencies
```bash
pnpm install
# or: npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure the variables:
```env
# [REQUIRED] AssemblyAI API Key (from https://www.assemblyai.com/dashboard)
NEXT_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# [REQUIRED FOR DEMO OUT-OF-THE-BOX]
# Pre-configured AssemblyAI Voice Agent ID (e.g. agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794)
# Strictly protected & immutable: new businesses auto-provision their own new IDs without overwriting this.
AGENT_ID=agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794

# [OPTIONAL] Public HTTPS Base URL for AssemblyAI Webhook Tools
# In production on Vercel: NOT NEEDED. Tools auto-route to https://omni-desk-rho.vercel.app!
# In local dev: Leave empty to route tools to the production deployment,
# or set to your Cloudflare Tunnel URL if actively modifying local tool code.
PUBLIC_API_BASE_URL=

# [OPTIONAL] Free Gmail SMTP for Calendar Invites (.ics)
SMTP_USER=omni.desk.com@gmail.com
SMTP_PASS=your_16_char_google_app_password

# [OPTIONAL] Supabase Cloud Database (Required for Vercel deployment)
# Local testing: Leave blank to use zero-setup SQLite (data/omnidesk.db).
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

### 3. Start Development Server
```bash
pnpm dev
```
- **Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Hair Salon Showcase**: [http://localhost:3000/demo/salon](http://localhost:3000/demo/salon)
- **Owner Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## Understanding Webhook Tools & Agent Provisioning

### Multi-Agent Isolation & Environment Protection
- **Protected Environment Agent**: The default `AGENT_ID` in `.env` is strictly immutable.
- **No Manual Typing or Accidental Overwrite**: The Agent ID input in the dashboard is strictly **read-only** with a one-click copy button. When clicking **"Save & Deploy"** on any new business, OmniDesk automatically calls AssemblyAI's `POST /v1/agents` API to provision a fresh, independent Agent ID and saves it directly to that business's record in the database. The Hair Salon demo agent is never overwritten.

### Why Webhooks Need a Public HTTPS URL
During a call, the caller's audio streams to AssemblyAI's cloud. When the AI decides to call a tool (like `check_availability` or `book_appointment`), AssemblyAI sends an HTTP POST request to your server's tool URL.

### Do You Need `PUBLIC_API_BASE_URL`?
- **In Production (Vercel)**: **NO**. OmniDesk automatically resolves its own production host (`https://omni-desk-rho.vercel.app` or `VERCEL_URL`). You do not need to configure `PUBLIC_API_BASE_URL`.
- **In Local Development**:
  - **Standard Testing**: **NO**. The pre-configured demo agent routes tool calls to the live production endpoint (`https://omni-desk-rho.vercel.app/tools/...`), so local voice testing works instantly without setting up any tunnels.
  - **Modifying Tool Logic Locally**: If you make edits to the local tool handler code and want AssemblyAI to call your local machine, start a tunnel (`cloudflared tunnel --url http://localhost:3000`), paste the URL into `PUBLIC_API_BASE_URL`, and click **"Save & Deploy"** in the Dashboard.

---

## How to Test as an Evaluator

### 1. Test the Hair Salon Voice Receptionist (`/demo/salon`)
1. Open [https://omni-desk-rho.vercel.app/demo/salon](https://omni-desk-rho.vercel.app/demo/salon) (or [http://localhost:3000/demo/salon](http://localhost:3000/demo/salon)).
2. Click **"Start Voice Call"** and grant microphone access.
3. Converse naturally with the AI receptionist:
   - *"Hi, what hair services do you offer and what are your prices?"* &rarr; Calls `get_services_and_pricing`.
   - *"What times are open tomorrow afternoon?"* &rarr; Calls `get_today` and `check_availability`.
   - *"Can I book the Signature Haircut for tomorrow at 2 PM? My name is Alex and my email is alex at gmail dot com"* &rarr; Calls `verify_customer_email`, `book_appointment`, and speaks your 6-character confirmation code.
4. Watch the real-time transcript and tool event logs update live in the interface.

### 2. Test Practice Owner Dashboard (`/dashboard`)
1. Open [https://omni-desk-rho.vercel.app/dashboard](https://omni-desk-rho.vercel.app/dashboard).
2. **AI Agent Builder**: Customize the persona instructions, voice, service pricing, or operating hours. Click **"Save & Deploy"** to sync changes to AssemblyAI.
3. **Live Voice Tester**: Live audio tester with frequency visualizer. Notice the **Deployment Guard**: if a new custom business is undeployed, it requires clicking "Deploy Agent" first.
4. **Bookings CRM**: View all confirmed appointments, filter by status, or click **"Send Invite"** to manually dispatch a calendar `.ics` email.
5. **Call History**: Review past call durations, tool invocations, and read full conversation transcripts.

---

## Transactional Email & Calendar Sync (.ics)

OmniDesk includes automated calendar synchronization powered by **Free Google Gmail SMTP**:
- **Rich HTML Confirmation**: Client name, business, service, date, time, price, and confirmation code.
- **Attached Native iCalendar (`appointment.ics`)**: Direct sync with Google Calendar, Apple Calendar, and Microsoft Outlook with a 1-hour advance reminder alarm.
- **1-Minute Setup**: Create a Google App Password ([myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)) and add `SMTP_USER` and `SMTP_PASS` to `.env`.
- **Zero-Setup Offline Fallback**: If SMTP credentials are not configured, bookings still succeed 100%, codes are spoken aloud, and appointments appear immediately in the Bookings CRM.

---

## Database Modes: Cloud vs Local

| Environment | Engine | Configuration | Behavior |
| :--- | :--- | :--- | :--- |
| **Production (Vercel)** | **Supabase PostgreSQL** | `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Serverless-safe, multi-region cloud persistence. SQLite is completely bypassed. |
| **Local Testing** | **Local SQLite** | None (leave Supabase keys empty) | Instant zero-setup evaluation using built-in `data/omnidesk.db` pre-seeded with the Hair Salon demo. |

---

## Tool API Specifications

All webhook tools accept `POST` requests and respond with structured JSON:

```text
POST /tools/[businessId]/get_today
Response: { "ok": true, "business": "OmniDesk Hair Salon & Studio", "today": "2026-09-18", "weekday": "Friday", "next_open_days": [...] }

POST /tools/[businessId]/get_services_and_pricing
Response: { "ok": true, "services": [{ "key": "haircut", "label": "Signature Haircut & Styling", "minutes": 45, "price": 85 }, ...] }

POST /tools/[businessId]/verify_customer_email
Body:     { "email": "alex dot smith at gmail dot com" }
Response: { "ok": true, "valid": true, "email": "alex.smith@gmail.com", "auto_corrected": false }

POST /tools/[businessId]/check_availability
Body:     { "service": "haircut", "date": "2026-09-19" }
Response: { "ok": true, "slots": ["09:30", "10:00", "10:30", "14:00"], "price": 85, "duration_minutes": 45 }

POST /tools/[businessId]/book_appointment
Body:     { "service": "haircut", "date": "2026-09-19", "time": "10:00", "customer_name": "Alex", "email": "alex.smith@gmail.com" }
Response: { "ok": true, "confirmation_code": "7JFREK", "service_label": "Signature Haircut & Styling", "date": "2026-09-19", "time": "10:00" }

POST /tools/[businessId]/send_confirmation
Body:     { "confirmation_code": "7JFREK" }
Response: { "ok": true, "sent": true, "email": "alex.smith@gmail.com" }
```

---

## Embeddable Website Widget

Embed the OmniDesk voice receptionist into any external website with a single script tag:

```html
<script 
  src="https://omni-desk-rho.vercel.app/widget.js" 
  data-business="biz_demo_dental" 
  data-theme="dark" 
  data-position="bottom-right" 
  defer>
</script>
```

Or as a React component:

```tsx
import { VoiceWidget } from "@/components/voice-widget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <VoiceWidget businessId="biz_demo_dental" theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
```

---

## Build Verification

To verify the production build locally:

```bash
pnpm build
# or: npm run build
```

---

## License

MIT License.
