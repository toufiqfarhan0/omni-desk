# OmniDesk — Autonomous Voice Receptionist & Scheduling Platform

OmniDesk is an autonomous, full-stack voice receptionist and appointment scheduling platform powered by the **AssemblyAI Voice Agent API**. It combines real-time bidirectional Web Audio streaming with deterministic server-side webhook tools to execute live calendar availability checks, appointment booking, spoken email deliverability validation, and automated RFC 5545 calendar invite dispatch.

Built with **Next.js 16 (App Router, React 19, Turbopack, TypeScript)**, **Tailwind CSS v4**, and **shadcn/ui** components, OmniDesk is an enterprise-grade multi-tenant voice platform designed for salons, wellness medspas, clinics, and professional service firms.

> **Architecture Guarantee**: OmniDesk is a unified, standalone **Next.js full-stack platform**. All client interfaces, voice audio streaming, server API routes, database operations, and AssemblyAI voice integrations are developed and maintained **exclusively within `src/`**. No separate Python or external microservice backend is required.

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
|  |   - Landing Page (/) & Interactive Sandbox (/demo)                                         |  |
|  |   - Floating Voice Widget (<VoiceWidget /> & /widget.js embed script)                      |  |
|  |   - Live Dashboard (/dashboard) with Server-Sent Events (SSE) Live Feed                    |  |
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
|                                           |     https://yourdomain.com/api/tools/...)            |
+===========================================|======================================================+
                                            v
+==================================================================================================+
|                            NEXT.JS BACKEND (API Route Handlers)                                  |
|                                                                                                  |
|   /api/token                       --> Mints temporary AssemblyAI WebSocket session tokens       |
|   /api/tools/[id]/get_today        --> Returns calendar reference & upcoming open business days  |
|   /api/tools/[id]/get_services     --> Dynamic pricing & duration service catalog                |
|   /api/tools/[id]/verify_email     --> Normalizes voice emails, DNS/MX check, spam validation    |
|   /api/tools/[id]/check_avail      --> Computes open time slots for operating schedule           |
|   /api/tools/[id]/book_appointment --> Commits reservation, generates 6-char confirmation code   |
|   /api/tools/[id]/send_confirm     --> Triggers Resend transactional email with .ics calendar    |
|   /api/owner/businesses/[id]/deploy--> Syncs agent instructions & webhook tools to AssemblyAI    |
|   /api/events                      --> Server-Sent Events (SSE) real-time dashboard notifications|
+===========================================|======================================================+
                                            |
                      (4. Reads / Writes)   |
                                            v
+==================================================================================================+
|                              DUAL-LAYER PERSISTENCE ARCHITECTURE                                 |
|                                                                                                  |
|         +--------------------------------------------------------------------+                   |
|         |                   PRIMARY STORAGE (Local SQLite)                   |                   |
|         |                     path: 'data/omnidesk.db'                       |                   |
|         |                                                                    |                   |
|         |  - Zero network latency (< 1ms read/write).                        |                   |
|         |  - Tables: owners, businesses, services, bookings, conversations.   |                   |
|         |  - Auto-created and seeded with sample businesses on startup.      |                   |
|         +--------------------------------------------------------------------+                   |
|                                            |                                                     |
|                                            | (5. Optional Background Sync)                       |
|                                            v                                                     |
|         +--------------------------------------------------------------------+                   |
|         |                  CLOUD MIRROR (Supabase Postgres)                  |                   |
|         |  - Automatically mirrors all bookings, businesses, and call        |                   |
|         |    transcripts to Supabase when SUPABASE_URL is configured.        |                   |
|         |  - Silently skipped if left blank (no external DB required).       |                   |
|         +--------------------------------------------------------------------+                   |
+==================================================================================================+
```

---

## Key Capabilities

### 1. AssemblyAI Voice Agent Integration
- **Real-Time Bidirectional Streaming**: Ultra-low-latency 16kHz PCM audio streaming directly between the caller's browser and AssemblyAI via WebSockets.
- **Dynamic Token Minting**: Authentication tokens are securely minted on the server (`GET https://agents.assemblyai.com/v1/token`) so API keys are never exposed to the client.
- **Instant Interruption Handling**: The voice engine automatically silences agent speech and clears playback buffers the millisecond the caller starts speaking.
- **Live Tool Event Visualizer**: Transcripts, tool arguments, and execution results appear in the UI in real time as the caller speaks.

### 2. Autonomous Webhook Tools
The voice agent executes deterministic server tools during natural conversation without user intervention:
- **`get_today`**: Anchors relative date references ("tomorrow", "next Tuesday", "this Friday") to the practice's real calendar and outputs upcoming open business days.
- **`get_services_and_pricing`**: Returns exact service catalog keys, labels, pricing, and duration metadata.
- **`verify_customer_email`**: Converts spoken email representations (`"alex dot smith at gmail dot com"` &rarr; `"alex.smith@gmail.com"`), autocorrects common domain typos, verifies DNS/MX records, and checks deliverability.
- **`check_availability`**: Evaluates operating hours, business days, and existing calendar reservations to present open appointment slots.
- **`book_appointment`**: Commits verified reservations, generates a unique 6-character confirmation code, and prevents double-booking.
- **`send_confirmation`**: Dispatches a transactional email through Resend with an RFC 5545 `.ics` calendar file attached for Google Calendar, Apple Calendar, and Outlook sync.

### 3. Practice Management Dashboard (`/dashboard`)
- **Agent Builder**:
  - Persona & system prompt editor with live configuration.
  - ElevenLabs voice picker with speed and pitch controls.
  - Dynamic Services & Pricing catalog (add, edit, and delete services on the fly).
  - Business operating schedule and slot duration configuration.
  - One-click **"Save Settings"** (saves to database) and **"Save & Deploy"** (registers webhook tools with AssemblyAI).
- **Voice Agent Tester**:
  - Live interactive audio tester with animated frequency visualizer.
  - Real-time conversation transcript stream with caller/agent turn indicators.
  - Tool call trace logs showing exact arguments and outputs during speech.
  - Embeddable script generator with customizable themes (`dark`, `light`, `minimal`) and position picker.
- **Bookings CRM**:
  - Real-time KPI metrics: Total Appointments, Confirmed Bookings, Pipeline Revenue, Confirmation Rate.
  - Search by customer name, email, confirmation code, or service.
  - Status filters (`All`, `Confirmed`, `Pending`, `Cancelled`).
  - One-click manual Resend `.ics` confirmation trigger.
- **Call History**:
  - Comprehensive call logs with duration, token counts, and tool invocation tallies.
  - Full transcript viewer dialog for audit and review.

---

## Directory Structure

```text
assemblyai-voice-agent-scheduler/
├── .env                         # Local environment variables (ASSEMBLYAI_API_KEY, etc.)
├── .env.example                 # Example template for environment variables
├── .gitignore                   # Ignores build artifacts, databases, and local secrets
├── components.json              # shadcn/ui configuration
├── package.json                 # Next.js 16 & React 19 dependencies
├── pnpm-lock.yaml               # Deterministic pnpm lockfile
├── tsconfig.json                # TypeScript path aliases (@/* -> src/*)
├── public/
│   ├── widget.js                # Standalone embeddable launcher script
│   ├── favicon.svg              # OmniDesk brand favicon
│   └── logo.svg                 # OmniDesk brand logo
├── data/
│   └── omnidesk.db              # Multi-tenant SQLite database (auto-migrated)
└── src/
    ├── app/
    │   ├── layout.tsx           # Root layout with TooltipProvider & Sonner Toaster
    │   ├── page.tsx             # Public marketing landing page
    │   ├── globals.css          # Tailwind CSS v4 design tokens
    │   ├── dashboard/
    │   │   └── page.tsx         # Full 4-tab practice management console
    │   ├── demo/
    │   │   └── page.tsx         # Interactive voice showroom with archetype switchers
    │   ├── api/
    │   │   ├── token/route.ts   # Temporary WebSocket session token minting
    │   │   ├── verify-email/    # Direct email validation & session reset
    │   │   ├── owner/           # Businesses, bookings, conversations API routes
    │   │   ├── events/          # Server-Sent Events (SSE) live feed
    │   │   └── tools/[...slug]/ # Server-side HTTP webhook tools called by AssemblyAI
    │   └── tools/[...slug]/     # Direct root webhook fallback route
    ├── components/
    │   ├── voice-widget.tsx     # Standalone embeddable floating voice widget
    │   ├── dashboard/
    │   │   ├── sidebar.tsx      # Sidebar navigation & business tenant selector
    │   │   ├── agent-builder.tsx# Persona prompt, voice picker, catalog manager
    │   │   ├── voice-tester.tsx # Live audio tester & website embedder
    │   │   ├── bookings-crm.tsx # KPI metric cards, appointments table, .ics sender
    │   │   └── call-history.tsx # Recorded conversation logs & transcript dialog
    │   └── ui/                  # shadcn/ui accessible Radix primitives
    └── lib/
        ├── db.ts                # Multi-tenant SQLite persistence & Supabase sync
        ├── assemblyai.ts        # AssemblyAI token minting, provisioning, DNS retries
        ├── audio.ts             # Browser PCM16 audio capture, player & visualizer
        ├── calendar.ts          # RFC 5545 .ics generator & Resend email client
        ├── email-verify.ts      # Spoken email normalizer & DNS MX validator
        ├── store.ts             # In-memory fast state store for active sessions
        ├── tools-handler.ts     # Core tool execution business logic
        └── utils.ts             # Tailwind class merging utility (clsx + twMerge)
```

---

## Local Setup Guide

Getting OmniDesk running locally takes **less than 2 minutes**.

### Prerequisites
- **Node.js**: 20.x or 22.x LTS installed
- **Package Manager**: `pnpm` (recommended) or `npm`
- **AssemblyAI API Key**: Free key from the [AssemblyAI Dashboard](https://www.assemblyai.com/dashboard)

---

### Step 1: Install Dependencies

```bash
pnpm install
# or: npm install
```

---

### Step 2: Configure Environment Variables

Create your `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Open `.env` and paste your **AssemblyAI API Key**:

```env
# [REQUIRED] AssemblyAI API Key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# [OPTIONAL] AssemblyAI Voice Agent ID
# Leave blank to auto-create via the dashboard, or paste an existing agent ID
AGENT_ID=

# [OPTIONAL] Public HTTPS URL for AssemblyAI Webhook Tools
# Required if you want AssemblyAI to call your local tools (see Tunnel section below)
PUBLIC_API_BASE_URL=

# [OPTIONAL] Resend API Key (for real calendar .ics emails)
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev

# [OPTIONAL] Abstract API Key (for live mailbox deliverability checks)
ABSTRACT_EMAIL_API_KEY=

# [OPTIONAL] Supabase Cloud Backup (SQLite data/omnidesk.db is used by default)
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

> **What is required?** Only `ASSEMBLYAI_API_KEY` is required! The local SQLite database (`data/omnidesk.db`) initializes automatically with zero external database setup.

---

### Step 3: Start the Development Server

```bash
pnpm dev
# or: npm run dev
```

The application is now live at:
- **Landing Page**: [http://localhost:3000/](http://localhost:3000/)
- **Practice Owner Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Interactive Voice Sandbox**: [http://localhost:3000/demo](http://localhost:3000/demo)

---

## Enabling Webhook Tools for Local Development

When you speak to the voice agent in your browser, AssemblyAI’s cloud brain decides when to call tools (e.g. `check_availability` or `book_appointment`). Because AssemblyAI runs in the cloud, it needs an HTTPS URL to reach your local computer.

Follow these simple steps to connect AssemblyAI to your local server:

### 1. Start a Free Tunnel (Cloudflare Tunnel)
In a separate terminal, expose your local port 3000:

```bash
cloudflared tunnel --url http://localhost:3000
```
*(Alternatively, use `npx localtunnel --port 3000` or ngrok).*

### 2. Copy the HTTPS URL into `.env`
Cloudflare will output a public URL like:
```text
https://random-words.trycloudflare.com
```

Add it to your `.env` file:
```env
PUBLIC_API_BASE_URL=https://random-words.trycloudflare.com
```

### 3. Click "Save & Deploy" on the Dashboard
1. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).
2. Go to the **Agent Builder** tab.
3. Click the **"Save & Deploy"** button.

OmniDesk will instantly call AssemblyAI (`POST https://agents.assemblyai.com/v1/agents`), register your tools pointing to your tunnel URL, and save the active `AGENT_ID` into your local database. Now AssemblyAI can execute your local tools in real time during live voice calls!

---

## How to Test as a Judge

### 1. Test the Live Voice Receptionist (`/demo`)
1. Navigate to [http://localhost:3000/demo](http://localhost:3000/demo).
2. Select a business archetype (e.g., **Hair Salon**, **Real Estate**, or **Wellness MedSpa**).
3. Click **"Start Voice Call"** and grant microphone access.
4. Speak naturally:
   - *"Hi, what services do you offer and how much do they cost?"* &rarr; Agent calls `get_services_and_pricing`.
   - *"What's your availability tomorrow afternoon?"* &rarr; Agent calls `get_today` and `check_availability`.
   - *"Can I book the signature haircut for tomorrow at 2 PM? My name is Alex and my email is alex at gmail dot com"* &rarr; Agent validates email, books the slot, and generates a confirmation code.
5. Watch the real-time transcript and tool call logs update live in the UI.

### 2. Test Practice Owner Dashboard (`/dashboard`)
1. Navigate to [http://localhost:3000/dashboard](http://localhost:3000/dashboard).
2. **Agent Builder Tab**: Edit the business prompt, switch voice personas, add or remove services from the pricing catalog, and click **"Save Settings"**.
3. **Voice Tester Tab**: Test the agent with the live frequency visualizer and copy the embeddable `<VoiceWidget />` or `<script>` snippet.
4. **Bookings CRM Tab**: View booked appointments, search by confirmation code, filter by status, and click **"Send Invite"** to manually re-send a calendar invite.
5. **Call History Tab**: Review call duration metrics and inspect complete conversation transcripts.

---

## Tool API Specifications

All webhook tools accept `POST` requests and respond with structured JSON:

### 1. `get_today`
Returns the current date, weekday, and the next open calendar days.
```json
// Response
{
  "ok": true,
  "business": "OmniDesk Hair Salon & Studio",
  "today": "2026-09-17",
  "weekday": "Thursday",
  "next_open_days": [
    { "date": "2026-09-18", "weekday": "Friday" },
    { "date": "2026-09-21", "weekday": "Monday" }
  ],
  "message": "Today is Thursday, September 17."
}
```

### 2. `get_services_and_pricing`
Returns the complete service catalog with durations and fees.
```json
// Response
{
  "ok": true,
  "business": "OmniDesk Hair Salon & Studio",
  "services": [
    { "key": "haircut", "label": "Signature Haircut & Styling", "minutes": 45, "price": 85 },
    { "key": "color", "label": "Full Color & Highlights", "minutes": 90, "price": 160 },
    { "key": "blowout", "label": "Blowout & Conditioning", "minutes": 30, "price": 55 },
    { "key": "keratin", "label": "Keratin Smoothing Treatment", "minutes": 120, "price": 250 }
  ]
}
```

### 3. `verify_customer_email`
Validates spoken or written customer emails, autocorrects common domain mistakes, and runs DNS/MX resolution.
```json
// Request
{ "email": "alex dot smith at gmail dot com" }

// Response
{
  "ok": true,
  "valid": true,
  "email": "alex.smith@gmail.com",
  "auto_corrected": false,
  "message": "Email verified: alex.smith@gmail.com."
}
```

### 4. `check_availability`
Evaluates availability for a specific service and date against operating hours and booked appointments.
```json
// Request
{ "service": "haircut", "date": "2026-09-18" }

// Response
{
  "ok": true,
  "date": "2026-09-18",
  "service": "Signature Haircut & Styling",
  "price": 85,
  "duration_minutes": 45,
  "slots": ["09:30", "10:00", "10:30", "11:00", "14:00", "14:30"],
  "message": "On Friday, September 18 for Signature Haircut & Styling, we have open times at 9:30 am, 10:00 am, or 10:30 am."
}
```

### 5. `book_appointment`
Validates slot availability and commits the reservation to the database.
```json
// Request
{
  "service": "haircut",
  "date": "2026-09-18",
  "time": "10:00",
  "customer_name": "Eleanor Vance",
  "email": "eleanor.vance@gmail.com"
}

// Response
{
  "ok": true,
  "confirmation_code": "7JFREK",
  "service": "haircut",
  "service_label": "Signature Haircut & Styling",
  "date": "2026-09-18",
  "time": "10:00",
  "customer_name": "Eleanor Vance",
  "email": "eleanor.vance@gmail.com",
  "price": 85,
  "message": "I have scheduled your Signature Haircut & Styling for Friday, September 18 at 10:00 am. Your confirmation code is 7JFREK."
}
```

### 6. `send_confirmation`
Triggers transactional email delivery with the attached `.ics` calendar file.
```json
// Request
{ "confirmation_code": "7JFREK" }

// Response
{
  "ok": true,
  "sent": true,
  "email": "eleanor.vance@gmail.com",
  "message": "Confirmation email with calendar invite (.ics) sent to eleanor.vance@gmail.com."
}
```

---

## Embeddable Website Widget

Embed the voice receptionist into any external website with a single `<script>` tag:

```html
<script 
  src="https://yourdomain.com/widget.js" 
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

The build compiles TypeScript, optimizes Turbopack bundles, and generates all static pages with zero errors.

---

## License

MIT License.
