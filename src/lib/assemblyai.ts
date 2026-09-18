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

export function buildAgentDefinition(
  biz: Business,
  publicBaseUrl?: string
): Record<string, any> {
  let baseUrl = (
    publicBaseUrl ||
    process.env.PUBLIC_API_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://omni-desk-rho.vercel.app"
  ).replace(/\/$/, "");

  if (
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
        "Books an appointment slot. Requires service name, date (YYYY-MM-DD), time (HH:MM in 24h), customer full name, and verified email address.",
      http: {
        url: `${baseUrl}/api/tools/${businessId}/book_appointment`,
        http_method: "POST",
      },
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "Service name or key.",
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
            description: "Customer's full name.",
          },
          email: {
            type: "string",
            description:
              "Customer's email address. Call verify_customer_email first to ensure correctness.",
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

Instructions:
1. Always start with: "${biz.greeting}"
2. When the caller asks about pricing or services, call 'get_services_and_pricing'.
3. When the caller specifies a day, call 'get_today' first to anchor relative dates, then call 'check_availability'.
4. Collect the caller's full name and email address. Always verify their email using 'verify_customer_email'.
5. Once confirmed, call 'book_appointment', then immediately call 'send_confirmation' so their calendar invite (.ics) is sent.
6. Provide their 6-character confirmation code clearly and wrap up politely.`;

  return {
    name: biz.name,
    system_prompt: fullPrompt,
    greeting: biz.greeting || undefined,
    voice: {
      voice_id: biz.voice_id || "alba",
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
  // Protect the environment agent (process.env.AGENT_ID) from EVER being overwritten!
  // Only update an agent if the business has its OWN unique agent_id that is NOT the protected env agent.
  const protectedEnvAgentId = process.env.AGENT_ID;
  const existingAgentId =
    biz.assemblyai_agent_id && biz.assemblyai_agent_id !== protectedEnvAgentId
      ? biz.assemblyai_agent_id
      : undefined;

  const url = existingAgentId
    ? `https://agents.assemblyai.com/v1/agents/${existingAgentId}`
    : "https://agents.assemblyai.com/v1/agents";
  const method = existingAgentId ? "PUT" : "POST";

  // Retries for DNS propagation
  let lastErr = "";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

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
