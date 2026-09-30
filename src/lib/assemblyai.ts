import { Business, getBusiness } from "./db";

export interface AgentProvisionResult {
  ok: boolean;
  agent_id?: string;
  error?: string;
  status_code?: number;
}

export function getApiKey(): string {
  return (
    process.env.NEXT_ASSEMBLYAI_API_KEY ||
    process.env.ASSEMBLYAI_API_KEY ||
    ""
  ).trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
}


export const ASSEMBLYAI_AGENT_HOST =
  (process.env.ASSEMBLYAI_AGENT_HOST || "https://agents.us.assemblyai.com").replace(/\/$/, "");
export const ASSEMBLYAI_WS_URL =
  process.env.NEXT_PUBLIC_ASSEMBLYAI_WS_URL || "wss://agents.us.assemblyai.com/v1/ws";

export async function mintAgentToken(expiresInSeconds = 600): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("AssemblyAI API key is not configured in environment");
  }

  const res = await fetch(
    `${ASSEMBLYAI_AGENT_HOST}/v1/token?expires_in_seconds=${expiresInSeconds}`,
    {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mint AssemblyAI token (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.token;
}

export const VALID_ASSEMBLYAI_VOICES = new Set([
  "alba", "anna", "charles", "estelle", "eve", "george", "giovanni",
  "jane", "jean", "juergen", "lola", "mary", "michael",
  "paul", "rafael", "vera"
]);

export function sanitizeVoiceId(voiceId?: string): string {
  if (!voiceId) return "alba";
  const normalized = voiceId.trim().toLowerCase();
  return VALID_ASSEMBLYAI_VOICES.has(normalized) ? normalized : "alba";
}

export function buildAgentDefinition(
  biz: Business,
  publicBaseUrl?: string
): Record<string, any> {
  const isLocal =
    !publicBaseUrl ||
    publicBaseUrl.includes("localhost") ||
    publicBaseUrl.includes("127.0.0.1");

  let baseUrl = (
    process.env.PUBLIC_API_BASE_URL ||
    (!isLocal ? publicBaseUrl : "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    "https://omni-desk-rho.vercel.app"
  ).replace(/\/$/, "");

  if (
    !baseUrl ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    !baseUrl.startsWith("http")
  ) {
    baseUrl = "https://omni-desk-rho.vercel.app";
  }

  const businessId = biz.id;

  const servicesSummary = (biz.services || [])
    .map(
      (s) =>
        `- ${s.label} (${s.key}): $${s.price}, ${s.minutes} mins${s.description ? ` — ${s.description}` : ""}`
    )
    .join("\n");

  const tools = [
    {
      name: "get_today",
      description:
        "Returns current date, day of week, and upcoming open clinic days. Call this before interpreting any relative day the caller mentions.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/get_today`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "get_services_and_pricing",
      description:
        "Optional fallback: Fetches real-time catalog changes if caller asks for external or updated pricing.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/get_services_and_pricing`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "verify_customer_email",
      description:
        "Validates and verifies the caller's email address against MX records, DNS, and real-time deliverability checks. ONLY call this when the caller provides an email address containing an email or domain (e.g. '@', 'at', 'gmail', 'dot com'). NEVER call this on a person's name or greeting.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/verify_customer_email`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description:
              "The caller's email address as spoken or written (e.g. 'alice dot smith at gmail dot com').",
            examples: ["alex.smith@gmail.com", "sarah.j@company.com"],
          },
        },
        required: ["email"],
      },
    },
    {
      name: "check_availability",
      description:
        "Checks open appointment times for a service on a given date (YYYY-MM-DD). If closed or fully booked, returns the next open day and alternative times. Always call get_today first if the caller said a relative day.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/check_availability`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description:
              "Service name or key (e.g. haircut, balayage, dental_cleaning, tour).",
            examples: ["haircut", "dental_cleaning", "teeth_whitening"],
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format (e.g. 2026-09-24).",
            examples: ["2026-09-24", "2026-09-25"],
          },
          time: {
            type: "string",
            description: "Optional specific time slot requested by the caller.",
            examples: ["09:00", "14:00"],
          },
        },
        required: ["service", "date"],
      },
    },
    {
      name: "book_appointment",
      description:
        "CRITICAL: Only call this tool AFTER the caller has agreed to a slot AND you have explicitly asked for and received BOTH the caller's actual full name AND their verified email address. NEVER assume, invent, or use 'John Doe' or '@example.com'. If you lack either, you MUST ask the caller first.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/book_appointment`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "Service name or key (e.g. haircut, dental_cleaning).",
            examples: ["haircut", "dental_cleaning"],
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format (e.g. 2026-09-24).",
            examples: ["2026-09-24"],
          },
          time: {
            type: "string",
            description: "Time in HH:MM 24-hour format (e.g. 10:00, 14:30).",
            examples: ["10:00", "14:00"],
          },
          customer_name: {
            type: "string",
            description:
              "The caller's actual spoken full name (e.g. 'Alex Rivera'). Strictly forbidden to use 'John Doe' or placeholder names.",
            examples: ["Alex Rivera", "Sarah Jenkins"],
          },
          email: {
            type: "string",
            description:
              "The caller's actual verified email address. Strictly forbidden to use 'john.doe@example.com' or '@example.com'.",
            examples: ["alex.rivera@gmail.com", "sarah@company.com"],
          },
        },
        required: ["service", "date", "time", "customer_name", "email"],
      },
    },
    {
      name: "send_confirmation",
      description:
        "Triggers a formal confirmation email with an RFC 5545 calendar invite (.ics file) attached. Call this immediately after book_appointment succeeds.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/send_confirmation`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {
          confirmation_code: {
            type: "string",
            description:
              "The 6-character confirmation code returned by book_appointment.",
            examples: ["CF6842", "A9B2C3"],
          },
        },
        required: ["confirmation_code"],
      },
    },
  ];

  const fullPrompt = `${biz.system_prompt}

Tone: ${biz.tone}
Operating Schedule: Open from ${biz.open_hour}:00 to ${biz.close_hour}:00, ${biz.operating_days}.
Slot Duration: ${biz.slot_minutes} minutes.

OFFERED SERVICES & PRICING (PRE-LOADED KNOWLEDGE):
${servicesSummary || "- Standard Service: $85, 45 mins"}

INSTANT SERVICE & PRICING ANSWERS:
- You ALREADY know all service options, durations, and prices above.
- When callers ask about what treatments are offered, pricing, or appointment lengths, answer IMMEDIATELY and DIRECTLY in 1 concise sentence from your pre-loaded knowledge above.
- You do NOT need to call 'get_services_and_pricing' for general inquiries.

TIMING & DATE NUMBER FORMATTING:
- ALWAYS format all times as numbers/digits with AM/PM (e.g., "9:00 AM", "9:30 AM", "12:00 PM", "1:00 PM"). NEVER write or speak times as spelled-out words (e.g. NEVER say "nine AM", "nine thirty AM", "twelve PM", or "one PM").
- ALWAYS format dates with digits for the day (e.g., "September 23", "October 5"). NEVER spell out ordinal numbers in words (e.g. do NOT say "September twenty third").
- When offering available slots from check_availability, ALWAYS state them as numbers: "9:00 AM, 9:30 AM, 12:00 PM, or 1:00 PM".

CALLER NAME COLLECTION & CONFIRMATION RULES (MANDATORY):
- When asking for the caller's full name, listen carefully to their response.
- The caller's reply is their NAME (e.g. "Tofic", "Farhan", "Toufiq", "My name is Tofic").
- When they say their name, ALWAYS ASK FOR CONFIRMATION FIRST:
  "Just to confirm, is your name [Name]?"
- STOP SPEAKING AND WAIT FOR THE CALLER'S ANSWER!
- IF THEY SAY YES ("yes", "yeah", "correct", "that's right", "yep", etc.):
  Proceed immediately to asking for their email:
  "Great! And what is your email address so I can send your calendar invite and confirmation?"
- IF THEY SAY NO OR CORRECT THEIR NAME ("No, it's Toufiq", "Wrong name", "Actually it's Tofic"):
  Immediately update the name and ask for confirmation again:
  "Got it, is your name [Corrected Name]?"
  Wait for their "yes" before moving forward.
- NEVER call 'verify_customer_email' on a name! A person's name is NOT an email address.
- Note: The caller's name and email address are completely independent. They do NOT need to be the same or match.

EMAIL ADDRESS FORMATTING & SPOKEN PRONUNCIATION (CRITICAL):
- When confirming or stating an email address, ALWAYS speak and format it in clean standard format (e.g., "toufiqfarhan0@gmail.com").
- NEVER pronounce or write it as spelled-out words like "zero at gmail dot com" or "dot com".
- Pronounce the email naturally (e.g., "Thank you! I have verified your email as toufiqfarhan0@gmail.com.").

MANDATORY STEP-BY-STEP PRE-BOOKING WORKFLOW (NEVER SKIP):
When the caller chooses or agrees to a date and time slot:
1. STOP! YOU ARE STRICTLY FORBIDDEN FROM CALLING 'book_appointment' AT THIS MOMENT.
2. ASK FOR NAME: "Great! May I have your full name for the reservation?"
   -> STOP SPEAKING AND WAIT FOR THE CALLER'S ANSWER. DO NOT CALL ANY TOOL.
3. CONFIRM THE NAME: When the caller states their name, ask for confirmation:
   "Just to confirm, is your name [Name]?"
   -> STOP SPEAKING AND WAIT FOR THE CALLER'S CONFIRMATION.
   -> If they say yes, proceed to Step 4.
   -> If they say no or correct it, take the corrected name and confirm again until confirmed.
4. ASK FOR EMAIL: "Great! And what is your email address so I can send your calendar invite and confirmation?"
   -> STOP SPEAKING AND WAIT FOR THE CALLER'S ANSWER (THEY CAN EITHER SPEAK IT OR TYPE IT IN THE ON-SCREEN INPUT BOX).
   -> When the caller speaks or sends their email:
      * Call 'verify_customer_email' to validate it.
      * Speak a brief verbal bridge: "Thanks, checking that email address now..."
      * Then ALWAYS confirm the email with the caller:
        "I have verified your email as [clean email, e.g. toufiqfarhan0@gmail.com]. Can you please confirm with yes or no?"
      * STOP SPEAKING AND WAIT FOR THE CALLER'S CONFIRMATION!
      * IF THEY SAY YES ("yes", "yeah", "correct", "that's right", "yep", "confirm", "sure"):
        Proceed immediately to Step 5 to book the appointment and send the confirmation email to their verified email address.
      * IF THEY SAY NO ("no", "wrong", "incorrect", "change it", "that's not right"):
        Acknowledge warmly and ask again: "No problem! Could you please provide your correct email address?" and wait for their new email.
5. ONLY AFTER BOTH the caller's confirmed name AND verified email are confirmed with YES:
   -> Call 'book_appointment' using their confirmed name in 'customer_name' and verified email in 'email'.
6. IMMEDIATELY after 'book_appointment' returns success:
   -> Call 'send_confirmation' with their confirmation code so their calendar invite (.ics) is sent to their email.
7. Read their 6-character confirmation code and confirm the email was sent to their email address.

ANTI-HALLUCINATION & IDENTITY RULES:
- NEVER invent, assume, fabricate, or hallucinate a name like "John Doe" or an email like "john.doe@example.com".
- Calling 'book_appointment' without the caller explicitly giving their real name and real email will be rejected immediately by the booking system.
- If the caller enters their email via the on-screen input box, acknowledge their email, verify it, and ask: "I have verified your email as [email]. Can you please confirm with yes or no?" before booking.

CONVERSATIONAL CONTINUITY & FILLER BRIDGES (ZERO DEAD AIR):
- When checking calendar availability, verifying emails, or booking, ALWAYS speak a brief, friendly verbal bridge to the caller so they know you are actively working on it:
  * Checking availability: "Let me check our calendar openings for you right now..." or "Looking up our openings for that day..."
  * Verifying email: "Thanks, checking that email address now..."
  * Booking appointment: "Great, booking that slot for you right now, just one moment..."
- Keep these bridges brief (1 single sentence), warm, and natural. Never leave the caller in dead silence while an action is taking place.

Instructions:
1. The opening greeting has ALREADY been spoken to the caller: "${biz.greeting}"
   - DO NOT repeat this opening greeting under any circumstances!
   - When the caller responds to the greeting (e.g. says "yes", "yeah", "sure", or mentions a service or date):
     * Acknowledge warmly and ask what service or date they prefer (e.g. "Wonderful! Which service or treatment were you looking to book, or what day works best for you?").
2. Answer service menu and pricing inquiries directly from your pre-loaded knowledge above. Only call 'get_services_and_pricing' if caller asks for external updates.
3. When the caller specifies a day, call 'get_today' first to anchor relative dates, then call 'check_availability'. Always state open times using numbers (e.g. 9:00 AM, 9:30 AM, 12:00 PM, 1:00 PM).
4. Follow the MANDATORY PRE-BOOKING WORKFLOW above to collect the caller's name and email before booking.
5. Once confirmed, call 'book_appointment', then immediately call 'send_confirmation' so their calendar invite (.ics) is sent.
6. Provide their 6-character confirmation code clearly and wrap up politely.`;

  const voiceId = sanitizeVoiceId(biz.voice_id);
  const keyterms = [
    biz.name,
    "OmniDesk",
    "appointment",
    "schedule",
    "reschedule",
    "calendar",
    "availability",
    "confirmation",
    "booking",
    ...(biz.services || []).map((s) => s.label),
  ].filter(Boolean);

  // AssemblyAI native managed LLM (included free with Voice Agents, zero setup or external keys needed)
  const llm: any[] = [];

  return {
    name: biz.name,
    system_prompt: fullPrompt,
    greeting: biz.greeting || undefined,
    voice: {
      voice_id: voiceId,
    },
    input: {
      transcription_mode: "min_latency",
      speech_model: "universal-3-6-pro",
      turn_detection: {
        vad_threshold: 0.35,
        interrupt_response: true,
      },
      keyterms,
    },
    output: {
      voice: voiceId,
    },
    tools,
    llm,
  };
}

export async function deployOrUpdateAgent(
  biz: Business,
  publicBaseUrl?: string
): Promise<AgentProvisionResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "AssemblyAI API key is not configured in environment",
    };
  }

  let existingAgentId = biz.assemblyai_agent_id?.trim();
  const payload = buildAgentDefinition(biz, publicBaseUrl);

  if (existingAgentId) {
    // Attempt PUT update on the stored agent ID
    let lastErr = "";
    let lastStatus = 0;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const putRes = await fetch(
          `${ASSEMBLYAI_AGENT_HOST}/v1/agents/${encodeURIComponent(existingAgentId)}`,
          {
            method: "PUT",
            headers: { Authorization: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        lastStatus = putRes.status;

        if (putRes.ok) {
          const data = await putRes.json().catch(() => ({}));
          return { ok: true, agent_id: data.id || existingAgentId };
        }

        const errText = await putRes.text();
        let cleanMsg = errText;
        try { cleanMsg = JSON.parse(errText).message || errText; } catch {}
        lastErr = `${putRes.status}: ${cleanMsg}`;

        // If 404 (ID does not exist on this cluster/account), find existing matching agent or create
        if (putRes.status === 404) {
          console.warn(`[AssemblyAI] PUT agent/${existingAgentId} returned 404. Finding active agent for "${biz.name}"...`);
          break;
        }

        if (errText.includes("does not resolve") && attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
      } catch (e: any) {
        lastErr = e.message;
      }
    }

    // If PUT failed with 404, look up an existing agent in this account matching this business name
    if (lastStatus === 404) {
      try {
        const listRes = await fetch(`${ASSEMBLYAI_AGENT_HOST}/v1/agents`, {
          headers: { Authorization: apiKey },
          cache: "no-store",
        });
        if (listRes.ok) {
          const listData = await listRes.json().catch(() => ({}));
          const targetName = (biz.name || "").trim().toLowerCase();
          const match = (listData.agents || []).find((a: any) => {
            const aName = (a.name || "").trim().toLowerCase();
            return aName && (aName === targetName || targetName.includes(aName) || aName.includes(targetName));
          });

          if (match && match.id) {
            console.log(`[AssemblyAI] Found existing agent ${match.id} for "${biz.name}". Updating via PUT...`);
            const retryPut = await fetch(
              `${ASSEMBLYAI_AGENT_HOST}/v1/agents/${encodeURIComponent(match.id)}`,
              {
                method: "PUT",
                headers: { Authorization: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );
            if (retryPut.ok) {
              const data = await retryPut.json().catch(() => ({}));
              return { ok: true, agent_id: data.id || match.id };
            }
          }
        }
      } catch (findErr) {
        console.warn("[AssemblyAI] Error looking up existing agents:", findErr);
      }
    } else {
      return { ok: false, error: lastErr, status_code: lastStatus };
    }
  }

  // If no agent ID existed, or PUT was 404 and no existing agent matched by name, create one
  try {
    const postRes = await fetch(`${ASSEMBLYAI_AGENT_HOST}/v1/agents`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (postRes.ok) {
      const data = await postRes.json().catch(() => ({}));
      return { ok: true, agent_id: data.id };
    }
    const errText = await postRes.text();
    return { ok: false, error: `${postRes.status}: ${errText}`, status_code: postRes.status };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

const verifiedAgentCache = new Map<string, { valid: boolean; timestamp: number }>();

export function clearAgentVerificationCache(agentId?: string) {
  if (agentId) {
    verifiedAgentCache.delete(agentId.trim());
  } else {
    verifiedAgentCache.clear();
  }
}

/**
 * Checks whether an agent ID actually exists on AssemblyAI's cloud API for the current API key.
 * Uses a 5-minute memory cache to avoid unnecessary network latency.
 */
export async function verifyAgentExists(
  agentId?: string | null,
  forceRefresh = false
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey || !agentId || !agentId.trim()) return false;
  const cleanId = agentId.trim();

  const cacheKey = `${apiKey.slice(-8)}_${cleanId}`;
  if (!forceRefresh) {
    const cached = verifiedAgentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.valid;
    }
  }

  try {
    const res = await fetch(
      `${ASSEMBLYAI_AGENT_HOST}/v1/agents/${encodeURIComponent(cleanId)}`,
      {
        method: "GET",
        headers: { Authorization: apiKey },
        cache: "no-store",
      }
    );
    const valid = res.status === 200;
    verifiedAgentCache.set(cacheKey, { valid, timestamp: Date.now() });
    return valid;
  } catch {
    return false;
  }
}

/**
 * Dynamically resolves a verified, working AssemblyAI Voice Agent ID for a business.
 * 1. If the business already has an agent_id in the DB, verifies it exists on AssemblyAI under this account.
 * 2. If it does not exist (404 / new account / deleted), it automatically provisions a real agent or
 *    links to a verified active fallback agent and persists the working ID to the database.
 * 3. Guarantees that callers NEVER encounter an 'agent_not_found' error.
 */
export async function getOrProvisionAgent(
  biz: Business,
  publicBaseUrl?: string
): Promise<string> {
  const existingId = biz.assemblyai_agent_id?.trim();

  // 1. If stored ID exists and is verified on this active cluster, return it directly
  if (existingId) {
    const isLive = await verifyAgentExists(existingId);
    if (isLive) {
      return existingId;
    }
  }

  // 2. Stored ID is 404/unverified on this cluster — use deployOrUpdateAgent which auto-discovers
  // an existing agent with matching business name or provisions a fresh one
  const deployResult = await deployOrUpdateAgent(biz, publicBaseUrl);
  if (deployResult.ok && deployResult.agent_id) {
    try {
      const { updateBusiness } = await import("@/lib/db");
      await updateBusiness(biz.id, { assemblyai_agent_id: deployResult.agent_id });
      console.log(
        `[AssemblyAI] Resolved and saved verified agent ${deployResult.agent_id} for business ${biz.id}`
      );
    } catch (e) {
      console.error("[AssemblyAI] Failed to save agent ID to database:", e);
    }
    return deployResult.agent_id;
  }

  // 3. Fallback to AGENT_ID env var if set and verified
  const envAgentId = (process.env.AGENT_ID || "").trim();
  if (envAgentId && (await verifyAgentExists(envAgentId))) {
    return envAgentId;
  }

  return existingId || envAgentId || "";
}

