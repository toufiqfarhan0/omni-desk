# OmniDesk — Autonomous Voice Receptionist & Scheduling Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-omni--desk--rho.vercel.app-blue?style=flat&logo=vercel)](https://omni-desk-rho.vercel.app)
[![npm version](https://img.shields.io/npm/v/omnidesk-voice.svg?color=blue)](https://www.npmjs.com/package/omnidesk-voice)
[![AssemblyAI](https://img.shields.io/badge/Powered%20by-AssemblyAI%20Voice%20Agents-blueviolet?style=flat)](https://www.assemblyai.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20App%20Router-black?style=flat&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

---

**Quick Links:**&nbsp;
[Live Demos](#live-external-client-deployments) &nbsp;·&nbsp;
[npm SDK](#embeddable-voice-widget--npm-package-omnidesk-voice) &nbsp;·&nbsp;
[Architecture & Pipeline](#architecture--pipeline) &nbsp;·&nbsp;
[Key Capabilities](#key-capabilities) &nbsp;·&nbsp;
[Autonomous Tools](#step-3-server-side-autonomous-tool-execution--pre-loaded-knowledge) &nbsp;·&nbsp;
[Widget Customizer](#1-react--nextjs-installation) &nbsp;·&nbsp;
[Database Modes](#database-modes-cloud-vs-local) &nbsp;·&nbsp;
[Quick Start](#quick-setup-guide)


---

OmniDesk is an autonomous, full-stack voice receptionist and appointment scheduling platform powered by the **AssemblyAI Voice Agent API**. It pairs real-time bidirectional 16kHz Web Audio streaming with deterministic server-side webhook tools to execute live calendar checks, appointment bookings, spoken email deliverability validation, and automated RFC 5545 calendar invite dispatch.


- **Live Production URL**: [https://omni-desk-rho.vercel.app](https://omni-desk-rho.vercel.app)
- **npm Package**: [`omnidesk-voice@0.1.4`](https://www.npmjs.com/package/omnidesk-voice) — Embeddable React widget & Vanilla JS SDK
- **Live Script Embed Demo**: [https://salon-demo-script.vercel.app](https://salon-demo-script.vercel.app) (GitHub: [toufiqfarhan0/salon-demo-script](https://github.com/toufiqfarhan0/salon-demo-script))
- **Live React npm Demo**: [https://salon-demo-react.vercel.app](https://salon-demo-react.vercel.app) (GitHub: [toufiqfarhan0/salon-demo-react](https://github.com/toufiqfarhan0/salon-demo-react))
- **Management Console**: [`/dashboard`](https://omni-desk-rho.vercel.app/dashboard)
- **Under The Hood / Code Architecture**: [`/demo`](https://omni-desk-rho.vercel.app/demo)

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
|  |   - Landing Page (/) & Client Showcase Links                                                |  |
|  |   - Floating Voice Widget (<VoiceWidget /> & Published npm SDK / CDN embed)                 |  |
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
|   +-----------------------------+       +-----------------------+       +----------------------+ |
|   | Universal-3.5 Pro Streaming | ----> | LLM Reasoning Engine  | ----> | ElevenLabs / Cartesia| |
|   | (min_latency / 700ms Turn)  |       | (Prompt + Tool Calls) |       | (Text to Voice)      | |
|   +-----------------------------+       +-----------------------+       +----------------------+ |
|                                           |                                                      |
|                                           | (3. Function Webhook POST                            |
|                                           |     https://omni-desk-rho.vercel.app/tools/...)      |
+===========================================|======================================================+
                                            v
+==================================================================================================+
|                            NEXT.JS BACKEND (API Route Handlers)                                  |
|                                                                                                  |
|   /api/token                       --> Mints temporary AssemblyAI WebSocket session tokens       |
|   /api/owner/conversations/:id/rec --> Fetches pre-signed S3 call audio recording (.ogg)         |
|   /tools/[id]/get_today            --> Real calendar reference & upcoming open business days     |
|   /tools/[id]/get_services         --> Dynamic pricing, duration & service catalog fallback      |
|   /tools/[id]/verify_email         --> Normalizes spoken emails, DNS/MX check & spam validation  |
|   /tools/[id]/check_avail          --> Computes open time slots for operating schedule           |
|   /tools/[id]/book_appointment     --> Commits reservation, generates 6-char confirmation code   |
|   /tools/[id]/send_confirm         --> Dispatches calendar invite with .ics (Gmail SMTP)         |
|   /api/owner/businesses            --> Auto-provisions AssemblyAI agent upon business creation   |
|   /api/owner/businesses/[id]/deploy--> Syncs agent instructions & webhook tools to AssemblyAI    |
|   /api/events                      --> Server-Sent Events (SSE) real-time dashboard notifications|
+===========================================|======================================================+
                                            |
                      (4. Reads / Writes:   |
                          businesses,       |
                          agent_id,         |
                          bookings,         |
                          conversations)    v
+==================================================================================================+
|                        ADAPTIVE DATABASE ENGINE (Supabase vs SQLite)                             |
|                                                                                                  |
|   [ PRODUCTION / VERCEL DEPLOYMENT ]                [ LOCAL TESTING / JUDGES EVALUATION ]        |
|    - Automatic Cloud Mode                            - Automatic Zero-Setup SQLite Mode          |
|    - Queries & commits to Supabase PostgreSQL        - No external accounts or setup needed      |
|    - Stores assemblyai_agent_id persistently in cloud- Uses built-in 'data/omnidesk.db'          |
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

## Architecture & Pipeline

### End-to-End System Flow

```mermaid
flowchart TD
    subgraph SG1["1. Client Audio & Webhook Engine"]
        A1["Caller / Web Visitor\n(Mic + Speaker)"]
        A2["Business Owner\n(Owner Dashboard /dashboard)"]
        A3["OmniDesk Widget\n&lt;VoiceWidget /&gt; · npm SDK · CDN Embed"]
        A4["/api/token\nMints short-lived session token"]
        A5["Next.js Frontend\n(React 19 / App Router)"]
        A1 -->|"(1) Request Session Token"| A4
        A4 -->|"Token Response"| A3
        A2 -->|"Manage Prompts / View Bookings"| A5
        A3 -->|"Floating Voice UI"| A5
    end

    subgraph SG2["2. AssemblyAI Universal-3.5 Engine"]
        B1["Universal-3.5 Pro STT\n(min_latency · 700ms turn)"]
        B2["LLM Reasoning Engine\n(System Prompt + Tool Calls)"]
        B3["Voice Synthesis\n(ElevenLabs / Cartesia TTS)"]
        B1 -->|"Transcribed Text"| B2
        B2 -->|"Agent Speech"| B3
    end

    subgraph SG3["3. Next.js Autonomous Webhook Tools"]
        C1["/tools/get_today\nCalendar anchor · open days"]
        C2["/tools/check_availability\nSlot engine · operating hours"]
        C3["/tools/verify_customer_email\nSpoken→normalized · DNS/MX check"]
        C4["/tools/book_appointment\nDB commit · 6-char confirm code"]
        C5["/tools/send_confirmation\nRFC 5545 .ics · Gmail SMTP"]
        C1 & C2 & C3 & C4 & C5
    end

    subgraph SG4["4. Multi-Tenant Adaptive Database"]
        D1["PRODUCTION\nSupabase PostgreSQL\n(Cloud · Multi-Region)"]
        D2["LOCAL / EVALUATION\nSQLite — data/omnidesk.db\n(Zero-Setup · Pre-Seeded)"]
        D1 & D2
    end

    subgraph SG5["5. Real-Time Event Dispatch & Calendar Sync"]
        E1["/api/events SSE\nLive Dashboard Feed"]
        E2["S3 Audio Recording\n.ogg Playback"]
        E3["Calendar Invite\nRFC 5545 .ics → Google / Apple / Outlook"]
        E1 & E2 & E3
    end

    A3 -->|"(2) 16kHz PCM Bidirectional\nWebSocket Stream"| B1
    B2 -->|"(3) Function Webhook POST\n/tools/[businessId]/..."| SG3
    SG3 -->|"(4) Reads / Writes\nbusinesses · agent_id\nbookings · conversations"| SG4
    SG4 -->|"(5) SSE + Audio + Email Dispatch"| SG5
    SG5 -->|"(6) Live Updates"| A5
```

---

## How OmniDesk Works (Step-by-Step Flow)

```text
[1. User Initiates Call] ──> [2. Ephemeral Token Minted] ──> [3. 24kHz/16kHz WebSocket Stream]
                                                                        │
[6. Dashboard & Audio Recording] <── [5. Calendar Sync (.ics)] <── [4. Autonomous Webhook Tools]
```


### Step 1: Session Initiation & Automatic Cloud Provisioning
1. The user clicks **"Start Voice Call"** on `/demo/salon`, via the embeddable `<VoiceWidget />`, or inside the Dashboard.
2. The browser requests a short-lived token from `/api/token?businessId=...`.
3. If the business is brand new or undeployed, the server dynamically provisions a dedicated cloud agent on AssemblyAI in ~1 second via `getOrProvisionAgent()`, configuring `min_latency`, tuned turn detection, and pre-loading its service catalog.
4. The server retrieves the business's `assemblyai_agent_id` from the database (**Supabase PostgreSQL** in production or **SQLite** locally).
5. The server calls AssemblyAI's token API (`GET https://agents.assemblyai.com/v1/token`) with the private `NEXT_ASSEMBLYAI_API_KEY` to mint a temporary 10-minute session token. Secret keys are never exposed to the client browser.

### Step 2: Bidirectional Audio Streaming & Real-Time Voice Processing
1. The client browser opens a direct WebSocket to AssemblyAI (`wss://agents.assemblyai.com/v1/stream?token=...`).
2. The browser's Web Audio API captures microphone input, resamples it to 16-bit linear PCM at 24kHz, and streams audio packets.
3. AssemblyAI's **Universal-3.5 Pro Streaming Speech-to-Text (STT)** transcribes spoken words in real time with `input.transcription_mode: "min_latency"`, eliminating buffer waits.
4. **Tuned Turn Detection**: Configured with `vad_threshold: 0.5`, `min_silence: 700ms`, and `max_silence: 2500ms`, allowing human-speed conversation turnarounds (<700ms).
5. **Real-Time Word Streaming**: Client receives `transcript.agent.delta` and displays message bubbles word-by-word simultaneously with speech playback (zero visual delay).
6. **Instant Barge-In / Interruption**: If the caller speaks while the agent is talking, playback halts in under 48ms and the agent immediately pivots to the caller's new intent.

### Step 3: Server-Side Autonomous Tool Execution & Pre-Loaded Knowledge
- **Pre-Loaded Services & Pricing Knowledge Base**: Standard treatments, pricing, and clinic hours are pre-compiled directly into the agent's system prompt, allowing the agent to answer catalog questions immediately without making an HTTP request.
- **Conversational Continuity & Bridge Fillers (Zero Dead Air)**: During background calendar lookups or bookings, the agent speaks brief natural verbal bridges (*"Looking up our calendar right now..."*, *"Checking that email address now..."*) so callers are never left in silence.
- **`get_today`**: Anchors relative terms ("tomorrow", "this Friday") to the practice's real calendar.
- **`check_availability`**: Evaluates operating hours, business days, and existing reservations to present available time slots.
- **`verify_customer_email`**: Normalizes spoken email formats (`"alex dot smith at gmail dot com"` &rarr; `"alex.smith@gmail.com"`) and verifies deliverability against DNS/MX records.
- **`book_appointment`**: Validates the selected slot, commits the reservation to the database, generates a unique 6-character confirmation code, and dispatches the calendar confirmation email with `.ics` attachment.
- **`send_confirmation`**: Dispatches the confirmation email with the calendar invite file with strict deduplication (`isAlreadySent`).

### Step 4: Multi-Tenant Database Storage & Auto-Sync
- All reservation commits, customer details, and conversation logs are immediately saved to the database.
- **In Production**: Committed directly to **Supabase Cloud PostgreSQL** across serverless instances.
- **In Local Dev**: Committed to **SQLite** (`data/omnidesk.db`).

### Step 5: Transactional Email & RFC 5545 Calendar Dispatch (.ics)
- The system generates an RFC 5545 compliant `.ics` iCalendar file containing start time, end time, timezone, and a 1-hour alarm reminder.
- Dispatches a transactional HTML email via Google Gmail SMTP to the verified customer email address.
- The customer clicks the `.ics` file to instantly add the reservation to **Google Calendar, Apple Calendar, or Microsoft Outlook**.

### Step 6: Real-Time Practice Dashboard & Audio Recording Playback
- The Owner Dashboard (`/dashboard`) receives live updates over Server-Sent Events (SSE) via `/api/events`.
- **Call History & S3 Audio Player**: Full audio recordings stored by AssemblyAI in `.ogg` format are streamable directly inside the Call History transcript modal via `/api/owner/conversations/[id]/recording`, with one-click audio downloads.
- Practice managers see instant KPI updates, review live transcripts, search bookings, or manually resend calendar invites.

---

## Agent ID Architecture: Local (SQLite) vs. Production (Supabase)

To ensure multi-tenant security, privacy, and zero risk of accidental overwrites, **OmniDesk treats the Database as the single source of truth for Agent IDs**:

```text
+-------------------------------------------------------------------------------+
|                       DATABASE AS SOURCE OF TRUTH                             |
|                                                                               |
|   LOCAL DEVELOPMENT (SQLite)               PRODUCTION / VERCEL (Supabase)     |
|   Table: businesses                        Table: businesses                  |
|   Column: assemblyai_agent_id              Column: assemblyai_agent_id        |
|                                                                               |
|   - Saved in 'data/omnidesk.db'            - Saved in Supabase PostgreSQL     |
|   - Read directly by /api/token            - Read directly by /api/token      |
|   - Updated on 'Save & Deploy'             - Updated on 'Save & Deploy'       |
+-------------------------------------------------------------------------------+
```

### 1. Why `AGENT_ID=` is Kept Blank in `.env`
- **Security & Privacy**: Hardcoding an active AssemblyAI agent ID in `.env` or in a public repository exposes it to unauthorized usage and quota exhaustion.
- **Independent Provisioning**: OmniDesk does not require a hardcoded `AGENT_ID` in `.env`. Each business stores its own dedicated `assemblyai_agent_id` inside the database.

### 2. How the Agent ID is Handled in Local SQLite
- The local database (`data/omnidesk.db`) stores the `assemblyai_agent_id` column for each business.
- When running locally, `/api/token` looks up the business in SQLite. If a developer provides an optional `AGENT_ID` in their private `.env`, it can serve as a local fallback, but the database value always takes precedence.
- When you click **"Save & Deploy"** in the Dashboard, OmniDesk calls AssemblyAI's API, receives a new agent ID, and writes it directly to SQLite.

### 3. How the Agent ID is Handled in Production (Supabase)
- On Vercel, OmniDesk connects directly to **Supabase Cloud PostgreSQL**.
- The `businesses` table in Supabase persistently holds `assemblyai_agent_id` for every tenant.
- When an owner clicks **"Save & Deploy"** on the deployed URL, OmniDesk provisions the agent on AssemblyAI and writes the returned `agent_id` into Supabase.
- All serverless API routes (`/api/token`, `/api/owner/businesses`) query Supabase directly, providing multi-region cloud persistence without depending on local environment files.

### 4. Strict Overwrite Protection
- The **AssemblyAI Voice Agent ID** field in the dashboard is strictly **`readOnly`** with a one-click copy button, preventing manual tampering.
- When deploying any new business, OmniDesk issues a `POST` request to AssemblyAI (`https://agents.assemblyai.com/v1/agents`) to create a **brand-new, independent agent**. Existing agents are never overwritten.

---

## Key Capabilities

### 1. AssemblyAI Voice Agent Integration
- **Universal-3.5 Pro Realtime STT**: Powered by AssemblyAI's flagship Universal-3.5 Pro speech foundation model with `transcription_mode: "min_latency"` for instantaneous audio transcription.
- **Real-Time Bidirectional Streaming**: Ultra-low-latency 24kHz/16kHz PCM audio streaming directly between the caller's browser and AssemblyAI via WebSockets and AudioWorklet ring buffers.
- **Tuned Human Turn Detection**: Tuned VAD thresholds (0.5), 700ms silence detection, and 2500ms max silence for natural conversational cadence (<700ms handoffs).
- **Simultaneous Word Streaming**: Instant visual display using `transcript.agent.delta` — text bubbles appear word-by-word simultaneously with speech audio.
- **Server Token Minting**: Tokens are securely minted server-side (`GET https://agents.assemblyai.com/v1/token`) so private API keys are never exposed to the client.
- **Instant Interruption Handling (<48ms)**: The voice engine automatically silences agent speech and clears playback buffers the millisecond the caller starts speaking.
- **Live Tool Event Visualizer**: Transcripts, tool execution arguments, and results stream in real time.

### 2. Autonomous Webhook Tools & Pre-Loaded Knowledge
- **Pre-Loaded Knowledge Base**: Service catalog, pricing, and operating schedule are pre-loaded directly into the agent's prompt, allowing instant answers without HTTP delay.
- **Conversational Continuity & Bridge Fillers**: Natural bridging phrases spoken during tool lookups completely eliminate awkward dead air.
- **`get_today`**: Anchors relative date references to the real calendar and returns upcoming open days.
- **`get_services_and_pricing`**: Optional fallback returning exact service catalog keys, labels, pricing, and duration metadata.
- **`verify_customer_email`**: Converts spoken email representations (`"alex dot smith at gmail dot com"` &rarr; `"alex.smith@gmail.com"`), autocorrects common domain typos, and checks DNS/MX records.
- **`check_availability`**: Evaluates operating hours, business days, and existing reservations to present open appointment slots.
- **`book_appointment`**: Commits verified reservations, generates a unique 6-character confirmation code, and prevents double-booking.
- **`send_confirmation`**: Dispatches a transactional email (via Free Gmail SMTP) with an RFC 5545 `.ics` calendar file attached for Google Calendar, Apple Calendar, and Outlook sync.

### 3. Practice Management Dashboard (`/dashboard`)
- **AI Agent Builder**: Persona editor, voice picker, dynamic service catalog, operating hours schedule, read-only Agent ID display with copy button, and one-click **"Save & Deploy"**.
- **Instant Auto-Provisioning**: Brand-new businesses created in the dashboard automatically deploy dedicated cloud agents to AssemblyAI with all low-latency optimizations.
- **Multi-Tenant Agent Isolation**: Each business maintains its own distinct `assemblyai_agent_id` in the database.
- **Live Voice Tester**: Interactive in-browser tester with frequency visualizer, real-time word-by-word transcript stream, and automatic session recording capture.
- **Bookings CRM**: Search, filter by status, and one-click manual Resend `.ics` confirmation trigger.
- **Call History with In-Browser Audio Player**: Full audio recordings stored by AssemblyAI on S3 (`.ogg`) are playable directly inside the transcript modal, complete with one-click audio downloads.

---

## Directory Structure

```text
assemblyai-voice-agent-scheduler/
├── .env.example                 # Example template for environment variables
├── package.json                 # Next.js 16 & React 19 dependencies
├── packages/
│   └── widget/                  # 'omnidesk-voice' npm package (0.1.4)
│       ├── src/                 # Audio client, React widget & vanilla launcher
│       └── tsup.config.ts       # CJS, ESM & IIFE multi-format bundler
├── public/
│   ├── widget.js                # Standalone embeddable launcher script
│   └── favicon.svg              # OmniDesk brand favicon
├── data/
│   └── omnidesk.db              # Zero-setup local SQLite database
└── src/
    ├── proxy.ts                 # Next.js 16 proxy routing & dashboard auth protection
    ├── app/
    │   ├── page.tsx             # Marketing landing page with live deployment showcases
    │   ├── dashboard/page.tsx   # Practice management console (4 tabs)
    │   ├── demo/
    │   │   └── page.tsx         # Interactive showroom & under-the-hood architecture
    │   ├── docs/
    │   │   └── page.tsx         # In-depth technical documentation & API guides
    │   ├── tools/[...slug]/     # Direct root webhook tool endpoints
    │   └── api/
    │       ├── token/route.ts   # Temporary WebSocket session token minting
    │       ├── tools/[...slug]/ # API webhook tool route handlers
    │       ├── owner/           # Businesses, bookings, deployment & conversation APIs
    │       │   └── conversations/[id]/recording/route.ts # S3 audio recording endpoint
    │       └── events/          # Server-Sent Events (SSE) live feed
    ├── components/
    │   ├── voice-widget.tsx     # Embeddable floating voice widget
    │   └── dashboard/
    │       ├── agent-builder.tsx# Persona prompt, voice picker (18 voices), catalog manager
    │       ├── voice-tester.tsx # Live audio tester with real-time delta streaming
    │       ├── bookings-crm.tsx # Appointments table & calendar invite trigger
    │       └── call-history.tsx # Recorded conversation logs, transcripts & audio player
    ├── scripts/
    │   └── update-assemblyai-agents.mjs # Batch agent instruction & tool updater
    └── lib/
        ├── assemblyai.ts        # Token minting, tool registration, agent deploy & latency tuning
        ├── audio.ts             # Browser PCM16 audio capture, playback & delta visualizer
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

# [REQUIRED FOR INSTANT DEMO & LIVE TESTER]
# Provide an existing AssemblyAI Voice Agent ID so calls work immediately.
AGENT_ID=your_assemblyai_agent_id_here

# [ONLY NEEDED IF deploying a brand-new agent from localhost or running update script]
# ✅ JUDGES: Leave this BLANK! The pre-configured AGENT_ID above already has tools
#    pointing to the live Vercel deployment — zero tunnels needed for local testing.
PUBLIC_API_BASE_URL=

# [OPTIONAL] Free Gmail SMTP for Calendar Invites (.ics)
# Leave blank to test bookings with on-screen confirmation code
SMTP_USER=your_email@gmail.com
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

## Understanding Webhook Tools & `PUBLIC_API_BASE_URL`

### Why Webhooks Need a Public HTTPS URL
During a call, the caller's audio streams to AssemblyAI's cloud. When the AI decides to call a tool (like `check_availability` or `book_appointment`), AssemblyAI sends an HTTP POST request to your server's tool URL.

### Do You Need `PUBLIC_API_BASE_URL`?
- **In Production (Vercel)**: **NO**. OmniDesk automatically resolves its own production host (`https://omni-desk-rho.vercel.app` or `VERCEL_URL`). You do not need to configure `PUBLIC_API_BASE_URL`.
- **In Local Development**: **NO**. OmniDesk automatically falls back to `https://omni-desk-rho.vercel.app`, so local voice testing and agent deployments work instantly with zero configuration or tunnels required.

#### Why We Do Not Require Local Tunnels
Under the [AssemblyAI Voice Agent HTTP Tools architecture](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/http-tools), AssemblyAI's cloud server dispatches HTTP POST webhooks to your server whenever the model executes a function (like checking available booking slots or scheduling an appointment).

Normally, testing cloud webhooks locally requires running third-party tunneling software to expose `localhost:3000` to the internet. OmniDesk eliminates this setup friction entirely:
- Local development automatically routes tool webhooks through the live production endpoint (`https://omni-desk-rho.vercel.app`).
- Evaluators and developers can simply clone the repository, run `pnpm dev`, and immediately test real end-to-end voice scheduling with zero tunnel setup.
- For technical details on how AssemblyAI executes server-side functions, refer to the [AssemblyAI HTTP Tools Documentation](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/http-tools).

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
| **Production (Vercel)** | **Supabase PostgreSQL** | `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Serverless-safe, multi-region cloud persistence. Stores `assemblyai_agent_id` in cloud. SQLite is completely bypassed. |
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

## Embeddable Voice Widget & npm Package (`omnidesk-voice`)

OmniDesk ships with a standalone, production-ready npm package: **[`omnidesk-voice`](https://www.npmjs.com/package/omnidesk-voice)** (v0.1.3). It includes a 24kHz Web Audio streaming client, waveform audio visualizers, full-screen expandable dialogs, and a built-in **Verified Mailbox Entry** banner for anti-hallucinated email capture.

### 1. React & Next.js Installation

```bash
npm install omnidesk-voice
# or: pnpm add omnidesk-voice
```

```tsx
import { OmniDeskWidget } from "omnidesk-voice";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Floating AI Voice Receptionist */}
        <OmniDeskWidget
          host="https://omni-desk-rho.vercel.app"
          businessId="biz_demo_dental"
          theme="dark"
          position="bottom-right"
          label="Talk to Receptionist"
          accent="emerald"
          onCallStart={() => console.log("Voice call connected")}
          onCallEnd={(duration) => console.log(`Call lasted ${duration}s`)}
        />
      </body>
    </html>
  );
}
```

### 2. Zero-Install Vanilla HTML / CDN (Global ESM)

No bundler or build step needed:

```html
<script type="module">
  import { initOmniDeskWidget } from "https://esm.sh/omnidesk-voice@0.1.3";

  initOmniDeskWidget({
    host: "https://omni-desk-rho.vercel.app",
    businessId: "biz_demo_dental",
    theme: "dark",
    position: "bottom-right",
    label: "Talk to Receptionist"
  });
</script>
```

### 3. Headless Audio Client SDK

If you are building your own custom voice UI:

```ts
import { AssemblyAIVoiceClient } from "omnidesk-voice";

const client = new AssemblyAIVoiceClient({
  onTranscript: ({ who, text }) => console.log(`${who}: ${text}`),
  onAudioLevel: (userLevel, agentLevel) => updateWaveforms(userLevel, agentLevel),
  onStatusChange: (status) => console.log("Call status:", status),
  onToolEvent: (event) => console.log("Tool invoked:", event.tool, event.args),
});

// Mint temporary token & connect
const { token, agent_id } = await fetch("/api/token?businessId=biz_demo_dental").then(r => r.json());
await client.start(token, agent_id);
```

### 4. Standalone Universal Script Tag (CDN Embed)

Zero build tools or node setup required. Works in WordPress, Webflow, Shopify, or plain HTML:

```html
<script 
  src="https://cdn.jsdelivr.net/npm/omnidesk-voice@0.1.3/dist/widget.global.global.js" 
  data-host="https://omni-desk-rho.vercel.app"
  data-business-id="biz_demo_dental"
  data-agent="agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794"
  data-position="bottom-right"
  data-theme="dark"
  data-label="Talk to Receptionist"
  defer>
</script>
```

---

## Live External Client Deployments

Two independent production websites demonstrate both integration methods in the wild:

| Website | Integration Type | Live URL | Repository |
| :--- | :--- | :--- | :--- |
| **AURA Hair & Beauty** | Universal `<script>` Embed | [salon-demo-script.vercel.app](https://salon-demo-script.vercel.app/) | [toufiqfarhan0/salon-demo-script](https://github.com/toufiqfarhan0/salon-demo-script) |
| **Lumière Studio** | React 19 / npm component | [salon-demo-react.vercel.app](https://salon-demo-react.vercel.app/) | [toufiqfarhan0/salon-demo-react](https://github.com/toufiqfarhan0/salon-demo-react) |

---

## Build Verification

To verify the production build locally:

```bash
pnpm build
# or: npm run build
```

---

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

Copyright (c) 2026 [toufiqfarhan0](https://github.com/toufiqfarhan0)

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for full details.

> Submissions must be original and MIT-compliant per [lablab.ai participation terms](https://lablab.ai/terms-of-use#16-participation-terms).
