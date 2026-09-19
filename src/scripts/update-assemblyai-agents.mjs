const apiKey = process.env.NEXT_ASSEMBLYAI_API_KEY;
if (!apiKey) {
  console.error("❌  NEXT_ASSEMBLYAI_API_KEY is not set. Run: export NEXT_ASSEMBLYAI_API_KEY=<your_key>");
  process.exit(1);
}
const agentIdsRaw = process.env.AGENT_ID || process.env.AGENT_IDS;
if (!agentIdsRaw) {
  console.error("❌  AGENT_ID is not set. Set AGENT_ID=agent_xxx in your .env");
  process.exit(1);
}
const agentIds = agentIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);

const baseUrl = process.env.PUBLIC_API_BASE_URL || "https://omni-desk-rho.vercel.app";

const bizId = process.env.BIZ_ID || "biz_demo_dental";

const tools = [
  {
    name: "get_today",
    description:
      "Returns current date, day of week, and upcoming open clinic days. Call this before interpreting any relative day the caller mentions.",
    http: {
      url: `${baseUrl}/api/tools/${bizId}/get_today`,
      http_method: "POST",
    },
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_services_and_pricing",
    description:
      "Returns the full list of offered services, their exact pricing, and appointment durations for this business. Call this whenever a customer asks about costs, available options, or what treatments are offered.",
    http: {
      url: `${baseUrl}/api/tools/${bizId}/get_services_and_pricing`,
      http_method: "POST",
    },
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "verify_customer_email",
    description:
      "Validates and verifies the caller's email address against MX records, DNS, and real-time deliverability checks. Call this as soon as the caller states their email address (even spoken like 'john dot doe at gmail dot com'). Confirm whether it is valid or if they need to clarify.",
    http: {
      url: `${baseUrl}/api/tools/${bizId}/verify_customer_email`,
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
      url: `${baseUrl}/api/tools/${bizId}/check_availability`,
      http_method: "POST",
    },
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Service name or key (e.g. haircut, balayage).",
        },
        date: { type: "string", description: "Date in YYYY-MM-DD format." },
      },
      required: ["service", "date"],
    },
  },
  {
    name: "book_appointment",
    description:
      "CRITICAL: Only call this tool AFTER the caller has agreed to a slot AND you have explicitly asked for and received BOTH the caller's actual full name AND their verified email address. NEVER assume, invent, or use 'John Doe' or '@example.com'. If you lack either, you MUST ask the caller first.",
    http: {
      url: `${baseUrl}/api/tools/${bizId}/book_appointment`,
      http_method: "POST",
    },
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Service name or key (e.g. haircut).",
        },
        date: { type: "string", description: "Date in YYYY-MM-DD format." },
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
      url: `${baseUrl}/api/tools/${bizId}/send_confirmation`,
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

const prompt = `You are an autonomous receptionist for OmniDesk Hair Salon & Studio. You speak in a warm, welcoming tone. You answer questions about salon services, check real calendar slots using your tools, and book appointments for clients.

Tone: warm
Operating Schedule: Open from 9:00 to 17:00, mon-fri.
Slot Duration: 30 minutes.

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
1. Always start with: "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?"
2. When the caller asks about pricing or services, call 'get_services_and_pricing'.
3. When the caller specifies a day, call 'get_today' first to anchor relative dates, then call 'check_availability'. Always state open times using numbers (e.g. 9:00 AM, 9:30 AM, 12:00 PM, 1:00 PM).
4. Follow the MANDATORY PRE-BOOKING WORKFLOW above to collect the caller's name and email before booking.
5. Once confirmed, call 'book_appointment', then immediately call 'send_confirmation' so their calendar invite (.ics) is sent.
6. Provide their 6-character confirmation code clearly and wrap up politely.`;

async function main() {
  for (const agentId of agentIds) {
    try {
      const res = await fetch(`https://agents.assemblyai.com/v1/agents/${agentId}`, {
        method: "PUT",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "OmniDesk Hair Salon & Studio",
          system_prompt: prompt,
          greeting:
            "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?",
          voice: { voice_id: "alba" },
          output: { voice: "alba" },
          tools,
        }),
      });
      const data = await res.json();
      console.log(`Agent ${agentId}: Status=${res.status}, ID=${data.id}, Tools=${data.tools?.length}`);
    } catch (err) {
      console.error(`Failed ${agentId}:`, err);
    }
  }
}

main();
