import { Business, getBusiness } from "./db";

export interface AgentProvisionResult {
  ok: boolean;
  agent_id?: string;
  error?: string;
  status_code?: number;
}

export async function mintAgentToken(expiresInSeconds = 600): Promise<string> {
  const apiKey = process.env.NEXT_ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_ASSEMBLYAI_API_KEY is not configured in environment");
  }

  const res = await fetch(
    `https://agents.assemblyai.com/v1/token?expires_in_seconds=${expiresInSeconds}`,
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
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
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
        "Returns the full list of offered services, their exact pricing, and appointment durations for this business. Call this whenever a customer asks about costs, available options, or what treatments are offered.",
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
        "Validates and verifies the caller's email address against MX records, DNS, and real-time deliverability checks. Call this as soon as the caller states their email address (even spoken like 'john dot doe at gmail dot com'). Confirm whether it is valid or if they need to clarify.",
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
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format.",
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
            description: "Service name or key (e.g. haircut).",
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format.",
          },
          time: {
            type: "string",
            description: "Time in HH:MM 24-hour format (e.g. 10:00, 14:30).",
          },
          customer_name: {
            type: "string",
            description:
              "The caller's actual spoken full name (e.g. 'Alex Rivera'). Strictly forbidden to use 'John Doe' or placeholder names.",
          },
          email: {
            type: "string",
            description:
              "The caller's actual verified email address. Strictly forbidden to use 'john.doe@example.com' or '@example.com'.",
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

TIMING & DATE NUMBER FORMATTING:
- ALWAYS format all times as numbers/digits with AM/PM (e.g., "9:00 AM", "9:30 AM", "12:00 PM", "1:00 PM"). NEVER write or speak times as spelled-out words (e.g. NEVER say "nine AM", "nine thirty AM", "twelve PM", or "one PM").
- ALWAYS format dates with digits for the day (e.g., "September 23", "October 5"). NEVER spell out ordinal numbers in words (e.g. do NOT say "September twenty third").
- When offering available slots from check_availability, ALWAYS state them as numbers: "9:00 AM, 9:30 AM, 12:00 PM, or 1:00 PM".

MANDATORY STEP-BY-STEP PRE-BOOKING WORKFLOW (NEVER SKIP):
When the caller chooses or agrees to a date and time slot:
1. STOP! YOU ARE STRICTLY FORBIDDEN FROM CALLING 'book_appointment' AT THIS MOMENT.
2. ASK FOR NAME: "Great! May I have your full name for the reservation?"
   -> STOP SPEAKING AND WAIT FOR THE CALLER'S ANSWER. DO NOT CALL ANY TOOL.
3. ASK FOR EMAIL: "And what is your email address so I can send your calendar invite and confirmation?"
   -> STOP SPEAKING AND WAIT FOR THE CALLER'S ANSWER.
   -> When the caller speaks or enters their email, call 'verify_customer_email' to validate it.
4. ONLY AFTER BOTH the caller's actual spoken name AND verified email are received:
   -> Call 'book_appointment' using their real name and verified email.
5. IMMEDIATELY after 'book_appointment' returns success:
   -> Call 'send_confirmation' with their confirmation code.
6. Read their 6-character confirmation code and confirm the email was sent.

ANTI-HALLUCINATION & IDENTITY RULES:
- NEVER invent, assume, fabricate, or hallucinate a name like "John Doe" or an email like "john.doe@example.com".
- Calling 'book_appointment' without the caller explicitly giving their real name and real email will be rejected immediately by the booking system.
- If the caller enters their email via the on-screen input box, acknowledge their email and proceed with booking.

Instructions:
1. Always start with: "${biz.greeting}"
2. When the caller asks about pricing or services, call 'get_services_and_pricing'.
3. When the caller specifies a day, call 'get_today' first to anchor relative dates, then call 'check_availability'. Always state open times using numbers (e.g. 9:00 AM, 9:30 AM, 12:00 PM, 1:00 PM).
4. Follow the MANDATORY PRE-BOOKING WORKFLOW above to collect the caller's name and email before booking.
5. Once confirmed, call 'book_appointment', then immediately call 'send_confirmation' so their calendar invite (.ics) is sent.
6. Provide their 6-character confirmation code clearly and wrap up politely.`;

  const voiceId = sanitizeVoiceId(biz.voice_id);
  return {
    name: biz.name,
    system_prompt: fullPrompt,
    greeting: biz.greeting || undefined,
    voice: {
      voice_id: voiceId,
    },
    output: {
      voice: voiceId,
    },
    tools,
  };
}

export async function deployOrUpdateAgent(
  biz: Business,
  publicBaseUrl: string
): Promise<AgentProvisionResult> {
  const apiKey = process.env.NEXT_ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "NEXT_ASSEMBLYAI_API_KEY is not set in environment",
    };
  }

  const payload = buildAgentDefinition(biz, publicBaseUrl);
  // If the business already has an agent ID, update the existing agent!
  // Only generate a new agent ID if the business does NOT have an agent ID yet.
  const existingAgentId =
    biz.assemblyai_agent_id && biz.assemblyai_agent_id.trim()
      ? biz.assemblyai_agent_id.trim()
      : undefined;

  let url = existingAgentId
    ? `https://agents.assemblyai.com/v1/agents/${existingAgentId}`
    : "https://agents.assemblyai.com/v1/agents";
  let method = existingAgentId ? "PUT" : "POST";

  // Retries for DNS propagation
  let lastErr = "";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      let res = await fetch(url, {
        method,
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // If existing agent ID was deleted or not found on AssemblyAI, fallback to creating a new one
      if (res.status === 404 && method === "PUT") {
        url = "https://agents.assemblyai.com/v1/agents";
        method = "POST";
        res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      lastStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        const finalAgentId = data.id || existingAgentId;
        return { ok: true, agent_id: finalAgentId };
      }

      const errText = await res.text();
      let cleanMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        cleanMsg = parsed.message || parsed.error || errText;
      } catch {}
      lastErr = `${res.status}: ${cleanMsg}`;

      // Check if it's a DNS resolution error that might fix after a short wait
      if (errText.includes("does not resolve") && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      break;
    } catch (e: any) {
      lastErr = e.message;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  return { ok: false, error: lastErr, status_code: lastStatus };
}
