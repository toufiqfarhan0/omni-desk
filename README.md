# OmniDesk — Autonomous Voice Receptionist & Scheduling Platform

OmniDesk is a modern, full-stack Next.js application powered by the **AssemblyAI Voice Agent API**. It pairs real-time 24kHz bidirectional Web Audio streaming with server-side webhook tools to execute deterministic appointment availability checks, calendar booking validation, real-time email deliverability verification, and automated RFC 5545 calendar invite dispatch.

Built with **Next.js 16 (App Router, React 19, Turbopack, TypeScript)**, **Tailwind CSS v4**, and **shadcn/ui** components, OmniDesk operates as an enterprise-grade multi-tenant voice receptionist system for salons, wellness medspas, and real estate brokerages.

> **Architecture Guarantee**: OmniDesk is a unified, standalone **Next.js full-stack platform**. All application logic, customer interfaces, backend API routes, database operations, and AssemblyAI voice integrations are developed and maintained **exclusively within the Next.js app (`src/`)**. No external backend service is needed.

---

## Technical Architecture

```text
                                  OMNIDESK NEXT.JS PLATFORM
                                             |
                      +----------------------+----------------------+
                      |                                             |
                 PRACTICE OWNER                                  CALLER
                      |                                             |
                      v                                             v
             Agent Builder Console                         Web Voice / Inbound Call
                      |                                             |
                      v                                             v
             Deploy to AssemblyAI ------------------------> AssemblyAI Voice Agent
             (System Prompt, Voice, Tools)                 (24kHz Bidirectional PCM)
                      |                                             |
                      |                                             v
                      |                                     Natural Speech Turn
                      |                                             |
                      |                                             v
                      |                                   AssemblyAI Tool Call
                      |                                 (HTTP Webhook Request)
                      |                                             |
                      +---------------------------------------------+
                                                    |
                                                    v
                                      Next.js App Router Webhooks
                                  (/api/tools/[...slug] & /tools/[...slug])
                                                    |
                                                    +---> /get_today
                                                    +---> /get_services_and_pricing
                                                    +---> /verify_customer_email
                                                    +---> /check_availability
                                                    +---> /book_appointment
                                                    +---> /send_confirmation
                                                    |
                                                    v
                                         Local Database / Supabase
                                         (data/omnidesk.db SQLite)
                                                    |
                      +-----------------------------+-----------------------------+
                      |                                                           |
                      v                                                           v
             Real-Time Bookings CRM                                     Transactional Email
           (KPI Metrics, Search, Status)                                (Resend API with Attached
                                                                         RFC 5545 .ics Calendar)
```

---

## Key Capabilities

### 1. AssemblyAI Voice Agent API Integration
- **24kHz Bidirectional Audio**: Low-latency PCM16 audio recording and streaming playback using the Web Audio API (`AudioContext`, `ScriptProcessorNode`).
- **Dynamic Token Minting**: Session authentication tokens minted securely via server-side `/api/token` route handlers (`GET https://agents.assemblyai.com/v1/token?expires_in_seconds=600`).
- **Sub-Second Interruption Handling**: Automatically clears audio queues and pauses agent output the millisecond caller speech is detected.
- **Live Tool Event Streaming**: Live UI updates display tool calls, input arguments, and execution results in real time as the caller speaks.

### 2. Autonomous Server-Side Webhook Tools
The voice agent executes deterministic server tools during natural speech turns without client-side intervention:
- **`get_today`**: Anchors relative date references ("tomorrow", "next Tuesday", "this Friday") to the practice's real calendar and outputs upcoming open business days.
- **`get_services_and_pricing`**: Dynamically ingests exact catalog service keys, labels, pricing, and duration metadata into the conversational context.
- **`verify_customer_email`**: Normalizes spoken email representations (`"alex dot smith at gmail dot com"` &rarr; `"alex.smith@gmail.com"`), autocorrects common domain typos, verifies DNS/MX records, and checks deliverability via Abstract API.
- **`check_availability`**: Validates operating hours, business days, and existing calendar reservations to present open 30-minute appointment slots.
- **`book_appointment`**: Commits verified reservations, generates a unique 6-character confirmation code, and prevents scheduling conflicts.
- **`send_confirmation`**: Dispatches a transactional email through Resend with an RFC 5545 `.ics` calendar file attached for Google Calendar, Apple Calendar, and Outlook sync.

### 3. Unified Practice Management Dashboard (`/dashboard`)
- **Agent Builder**:
  - Persona & system prompt editor with token counter and live autosave.
  - ElevenLabs voice switcher with speed and pitch controls.
  - Dynamic Services & Pricing catalog (add, edit, and delete services on the fly).
  - Business operating hours configuration.
  - One-click "Save Settings" (database update) and "Save & Deploy" (AssemblyAI sync).
- **Voice Agent Tester**:
  - Live 24kHz interactive audio tester with animated frequency visualizer.
  - Real-time conversation transcript stream with caller/agent turn indicators.
  - Tool call trace logs showing exact arguments and outputs during speech.
  - Embeddable script generator with customizable themes (`dark`, `light`, `minimal`) and position picker (`bottom-right`, `bottom-left`).
  - React `<VoiceWidget />` component snippet ready for copy-pasting.
- **Bookings CRM**:
  - Real-time KPI metrics: Total Appointments, Confirmed Bookings, Pipeline Revenue, Confirmation Rate.
  - Search by customer name, email, confirmation code, or service.
  - Status filters (`All`, `Confirmed`, `Pending`, `Cancelled`).
  - One-click manual Resend `.ics` confirmation trigger.
- **Call History**:
  - Comprehensive call logs with duration, token counts, and tool invocation tallies.
  - Full transcript viewer dialog for audit and review.

### 4. Multi-Tenant Architecture & Preset Showcases
OmniDesk supports instant tenant switching with tenant-isolated database records, prompts, and catalogs:
- **OmniDesk Hair Salon & Studio** (`biz_demo_dental` - Default)
- **OmniDesk Real Estate & Property Advisory** (`biz_demo_realestate`)
- **OmniDesk Wellness & MedSpa** (`biz_demo_wellness`)

### 5. Embeddable Website Widget
Embed the voice agent into any external website in seconds:
- **HTML Script Tag**:
  ```html
  <script src="https://yourdomain.com/widget.js" data-business-id="biz_demo_dental" defer></script>
  ```
- **React Component**:
  ```tsx
  import { VoiceWidget } from "@/components/voice-widget";

  export default function Layout() {
    return <VoiceWidget businessId="biz_demo_dental" theme="dark" position="bottom-right" />;
  }
  ```

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
    │   │   └── tools/[...slug]/ # Server-side HTTP webhook tools called by AssemblyAI
    │   └── tools/[...slug]/     # Direct root webhook fallback route
    ├── components/
    │   ├── navbar.tsx           # Top navigation bar with tenant switcher
    │   ├── voice-widget.tsx     # Standalone embeddable floating voice widget
    │   ├── dashboard/
    │   │   ├── sidebar.tsx      # Sidebar navigation & business tenant selector
    │   │   ├── agent-builder.tsx# Persona prompt, voice picker, catalog manager
    │   │   ├── voice-tester.tsx # 24kHz live audio tester & website embedder
    │   │   ├── bookings-crm.tsx # KPI metric cards, appointments table, .ics sender
    │   │   └── call-history.tsx # Recorded conversation logs & transcript dialog
    │   └── ui/                  # shadcn/ui accessible Radix primitives
    └── lib/
        ├── db.ts                # Multi-tenant SQLite persistence & Supabase sync
        ├── assemblyai.ts        # AssemblyAI token minting, provisioning, DNS retries
        ├── audio.ts             # Browser 24kHz PCM16 audio capture, player & visualizer
        ├── calendar.ts          # RFC 5545 .ics generator & Resend email client
        ├── email-verify.ts      # Multi-stage spoken email validator & DNS resolver
        ├── tools-handler.ts     # Core tool execution business logic
        └── utils.ts             # Tailwind class merging utility (clsx + twMerge)
```

---

## Getting Started

### Prerequisites
- **Node.js**: 20.x or 22.x LTS
- **Package Manager**: `pnpm` (recommended: `npm install -g pnpm`) or `npm`
- **AssemblyAI API Key**: Free tier available from the [AssemblyAI Dashboard](https://www.assemblyai.com/dashboard)

---

### Step 1: Install Dependencies

```bash
pnpm install
# or: npm install
```

---

### Step 2: Configure Environment Variables

Create your `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Open `.env` and add your **AssemblyAI API Key**:

```env
# Required for Voice Agent WebSocket streaming and token minting
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Optional: Auto-filled on deploy, or paste your agent ID from AssemblyAI dashboard
AGENT_ID=

# Optional: Public HTTPS URL for AssemblyAI to invoke webhook tools
# (e.g. from Cloudflare Tunnel or your production deployment domain)
PUBLIC_API_BASE_URL=

# Optional: Resend API key for automated calendar invites (.ics)
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev

# Optional: Abstract API key for live mailbox deliverability checks
ABSTRACT_EMAIL_API_KEY=

# Optional: Supabase cloud backup (Built-in SQLite data/omnidesk.db is used by default)
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

> **Note**: Only `ASSEMBLYAI_API_KEY` is required to run the application and test live voice interactions in the browser. All other integrations (Resend, Abstract API, Supabase) are optional enhancements.

---

### Step 3: Run the Development Server

Start the Next.js development server:

```bash
pnpm dev
# or: npm run dev
```

The application is now live at:
- **Public Landing Page**: [http://localhost:3000/](http://localhost:3000/)
- **Owner Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Interactive Voice Demo Showroom**: [http://localhost:3000/demo](http://localhost:3000/demo)

---

## How to Test as a Judge

### 1. Test Live Voice Receptionist (`/demo`)
Navigate to [http://localhost:3000/demo](http://localhost:3000/demo):
- Select a business archetype (e.g., **Hair Salon**, **Real Estate**, or **Wellness MedSpa**).
- Click **"Start Voice Call"** and grant microphone permissions.
- Speak naturally to the receptionist (e.g., *"Hi, what services do you offer and what are your prices?"* or *"Can I book an appointment for tomorrow?"*).
- Observe sub-second responses and automated tool execution in the live transcript.

### 2. Test Practice Owner Dashboard (`/dashboard`)
Navigate to [http://localhost:3000/dashboard](http://localhost:3000/dashboard):
- **Agent Builder Tab**: Customize the business name, prompt instructions, voice persona, and add/remove services and pricing from the live catalog.
- **Voice Tester Tab**: Test the agent directly with live frequency visualizations, tool trace logs, and copy embeddable widget code.
- **Bookings CRM Tab**: Inspect customer appointments, check availability statuses, and trigger manual `.ics` calendar invite dispatches.
- **Call History Tab**: View caller session durations, token consumption metrics, and complete conversation transcripts.

---

## Connecting Webhook Tools to AssemblyAI Cloud

AssemblyAI Voice Agents execute server tools (like `get_today`, `check_availability`, `book_appointment`) via HTTP `POST` requests from AssemblyAI's cloud infrastructure to your server.

When developing locally, expose your local Next.js server to the internet using Cloudflare Tunnel or localtunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the generated public HTTPS URL (e.g. `https://your-tunnel-name.trycloudflare.com`) and paste it into `PUBLIC_API_BASE_URL` in `.env`:

```env
PUBLIC_API_BASE_URL=https://your-tunnel-name.trycloudflare.com
```

Then, click **"Save & Deploy"** in the **Agent Builder** tab on your dashboard. OmniDesk will automatically register all webhook tools with AssemblyAI pointed at your active tunnel URL.

*(Optional convenience helper)*: If you have Python installed, you can also run `python run.py`, which launches the Next.js server and Cloudflare Tunnel simultaneously in one terminal and auto-syncs the tools.

---

## Tool API Specifications

All webhook tools accept `POST` requests and respond with clean JSON. They can be invoked at either `/api/tools/[businessId]/[toolName]` or `/tools/[businessId]/[toolName]`.

### 1. `get_today`
Returns the current date, weekday, and the next open calendar days with available booking slots.
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
  ],
  "message": "Our available services and pricing are: Signature Haircut & Styling ($85, 45 mins)..."
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
  "message": "Email verified: alex.smith@gmail.com. Please confirm this with the caller."
}
```

### 4. `check_availability`
Evaluates availability for a specific service and date against operating hours and booked appointments.
```json
// Request
{ "service": "haircut", "date": "2026-09-17" }

// Response
{
  "ok": true,
  "date": "2026-09-17",
  "service": "Signature Haircut & Styling",
  "price": 85,
  "duration_minutes": 45,
  "slots": ["09:30", "10:00", "10:30", "11:00", "14:00", "14:30"],
  "message": "On Thursday, September 17 for Signature Haircut & Styling ($85, 45 mins), we have open times at 9:30 am, 10:00 am, or 10:30 am."
}
```

### 5. `book_appointment`
Validates slot availability and saves the reservation to SQLite.
```json
// Request
{
  "service": "haircut",
  "date": "2026-09-17",
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
  "date": "2026-09-17",
  "time": "10:00",
  "customer_name": "Eleanor Vance",
  "email": "eleanor.vance@gmail.com",
  "price": 85,
  "message": "I have scheduled your Signature Haircut & Styling for Thursday, September 17 at 10:00 am. Your confirmation code is 7JFREK."
}
```

### 6. `send_confirmation`
Triggers Resend email delivery with the attached `.ics` calendar file.
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

## Transactional Email & Calendar Sync (.ics)

When an appointment is finalized, OmniDesk automatically formats an RFC 5545 compliant `.ics` calendar object:
- **Organizer / Business**: Name and contact of the active tenant.
- **Timestamps**: `DTSTART` and `DTEND` computed dynamically from service duration.
- **Valarm Trigger**: `-PT60M` (Triggers native device notifications 1 hour prior to appointment).
- **Attachment Encoding**: Base64 `.ics` attachment delivered through the Resend REST API.

---

## Production Build & Verification

To compile and validate the production bundle:

```bash
pnpm build
# or: npm run build
```

The build runs TypeScript validation, static page generation, and Turbopack bundle optimization with zero errors.

---

## License

MIT License.
