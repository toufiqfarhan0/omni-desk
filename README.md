# OmniDesk — Autonomous Voice Receptionist & Scheduling Platform

OmniDesk is a modern, full-stack Next.js platform powered by the **AssemblyAI Voice Agent API**. It pairs real-time 24kHz bidirectional Web Audio streaming with server-side webhook tools to execute deterministic appointment availability checks, calendar booking validation, real-time email deliverability verification, and automated RFC 5545 calendar invite dispatch.

Built with **Next.js 16 (App Router, React 19, Turbopack, TypeScript)**, **Tailwind CSS v4**, and **shadcn/ui** components, OmniDesk operates as an enterprise-grade multi-tenant voice receptionist system for salons, wellness medspas, and real estate brokerages.

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
- **Automated DNS Retry & Provisioning**: Resilient backoff and retry during agent creation to accommodate Cloudflare Tunnel DNS propagation.

### 2. Autonomous Server-Side Webhook Tools
The voice agent executes deterministic server tools during natural speech turns without client-side intervention:
- **`get_today`**: Anchors relative date references ("tomorrow", "next Tuesday", "this Friday") to the practice's real calendar and outputs upcoming open business days.
- **`get_services_and_pricing`**: Dynamically ingests exact catalog service keys, labels, pricing, and duration metadata into the conversational context.
- **`verify_customer_email`**: Normalizes spoken email representations (`"alex dot smith at gmail dot com"` &rarr; `"alex.smith@gmail.com"`), autocorrects common domain typos, verifies DNS/MX records, and checks deliverability via Abstract API.
- **`check_availability`**: Validates operating hours, business days, and existing calendar reservations to present open 30-minute appointment slots.
- **`book_appointment`**: Commits verified reservations, generates a unique 6-character confirmation code, and prevents scheduling conflicts.
- **`send_confirmation`**: Dispatches a transactional email through Resend with an RFC 5545 `.ics` calendar file attached for Google Calendar, Apple Calendar, and Outlook sync.

### 3. Unified Practice Management Dashboard
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
├── .env                         # API keys & tunnel URLs
├── .gitignore                   # Ignores build artifacts, databases, and archived legacy code
├── components.json              # shadcn/ui configuration
├── package.json                 # Next.js 16 & React 19 dependencies
├── pnpm-lock.yaml               # Deterministic pnpm lockfile
├── tsconfig.json                # TypeScript path aliases (@/* -> src/*)
├── run.py                       # Unified one-command runner (Next.js + Cloudflare)
├── public/
│   ├── widget.js                # Standalone embeddable launcher script
│   ├── favicon.svg              # OmniDesk brand favicon
│   └── logo.svg                 # OmniDesk brand logo
├── data/
│   └── omnidesk.db              # Multi-tenant SQLite database
└── src/
    ├── app/
    │   ├── layout.tsx           # Root layout with TooltipProvider & Sonner Toaster
    │   ├── page.tsx             # High-conversion public landing page
    │   ├── globals.css          # Tailwind CSS v4 design system tokens
    │   ├── dashboard/
    │   │   └── page.tsx         # Full 4-tab SaaS practice management console
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

> [!IMPORTANT]
> **Independent Next.js Full-Stack Architecture**: OmniDesk solely depends on the Next.js platform located in `src/`. Next.js handles all client interface pages, 24kHz bidirectional Web Audio, multi-tenant SQLite database persistence, AssemblyAI session token minting, and all server-side webhook tools.
> 
> All initial prototype files and directories (`web/`, `legacy_app/`, `app/`, `scripts/`, `agent.json`, `requirements.txt`, `public/app.js`, and `public/worklet.js`) are **preserved locally on disk** for your reference, but are registered in [`.gitignore`](.gitignore) so they are never tracked by Git or bundled into production.

---

## Getting Started

### Prerequisites
- **Node.js**: 20.x or 22.x LTS
- **Package Manager**: `pnpm` (recommended: `npm install -g pnpm`) or `npm`
- **Python**: 3.10+ (for one-command launcher `run.py`)
- **AssemblyAI API Key**: Obtain from the [AssemblyAI Console](https://www.assemblyai.com/dashboard)

### 1. Installation
Clone the repository and install all dependencies:

```bash
pnpm install
# or: npm install
```

### 2. Environment Configuration
Create or configure your `.env` file in the project root:

```env
# Required for Voice Agent WebSocket connection and token minting
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Filled in automatically or manually from AssemblyAI dashboard
AGENT_ID=your_assemblyai_agent_id_here

# Public HTTPS URL accessible by AssemblyAI for webhook tools
# (Updated automatically by run.py when cloudflared is running)
PUBLIC_API_BASE_URL=https://your-domain.trycloudflare.com

# Optional: Resend API key for automated calendar invites (.ics)
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev

# Optional: Abstract API key for live mailbox deliverability checks
ABSTRACT_EMAIL_API_KEY=your_abstract_api_key

# Optional: Supabase credentials for cloud backup sync
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Launching the Application

#### Option A: One-Command Runner (Recommended)
The runner starts the Next.js development server, automatically launches a Cloudflare Tunnel for AssemblyAI tool webhooks, updates `PUBLIC_API_BASE_URL` in `.env`, syncs the active agent tools, and displays accessible URLs:

```bash
python run.py
```

#### Option B: Standard Next.js Development Server
If you prefer running Next.js directly:

```bash
pnpm dev
# or: npm run dev
```

Once running, navigate to:
- **Public Landing Page**: [http://localhost:3000/](http://localhost:3000/)
- **Practice Owner Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Interactive Voice Demo Showroom**: [http://localhost:3000/demo](http://localhost:3000/demo)

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
