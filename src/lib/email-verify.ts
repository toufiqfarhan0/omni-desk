import dns from "node:dns/promises";
import { getActiveVerifiedEmail, setActiveVerifiedEmail } from "./db";

const COMMON_DOMAIN_FIXES: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmai.co": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outllok.com": "outlook.com",
  "iclud.com": "icloud.com",
  "iclou.com": "icloud.com",
  "prton.me": "proton.me",
  "protonmai.com": "protonmail.com",
};

const COMMON_TLD_FIXES: Record<string, string> = {
  con: "com",
  cpm: "com",
  xom: "com",
  comm: "com",
  cm: "com",
  ne: "net",
  ner: "net",
  ogr: "org",
  orgg: "org",
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "throwawaymail.com",
  "trashmail.com",
  "sharklasers.com",
  "yopmail.com",
  "fakemailgenerator.com",
  "temp-mail.org",
  "dispostable.com",
  "getairmail.com",
  "mohmal.com",
]);

export interface EmailVerificationResult {
  ok: boolean;
  valid: boolean;
  reason?: string;
  message: string;
  email?: string;
  domain?: string;
  auto_corrected?: boolean;
  original?: string;
  dns_verified?: boolean;
  mailbox_verified?: boolean;
}

export function cleanSpokenEmailText(raw: string): string {
  if (!raw) return "";
  let s = raw.toLowerCase().trim();

  // Strip common conversational prefixes callers might speak
  s = s
    .replace(
      /^(?:my\s+email\s+(?:address\s+)?(?:is|would\s+be)\s*:?|it(?:'s|\s+is)\s*:?|email\s*:?|the\s+email\s+is\s*:?|sure\s*,?\s*it(?:'s|\s+is)\s*:?|you\s+can\s+send\s+it\s+to\s*:?)/i,
      ""
    )
    .trim();

  // Convert spoken number words to digits
  const wordToDigit: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
  };

  for (const [w, d] of Object.entries(wordToDigit)) {
    s = s.replace(new RegExp(`\\b${w}\\b`, "g"), d);
  }

  // Handle "oh" as 0 (e.g. "farhan oh at" -> "farhan 0 at")
  s = s.replace(/\b(?:oh)\b(?=\s*(?:@|at\b|\d|[a-z]))/g, "0");

  // Normalize spoken symbols
  s = s.replace(/\s+(?:at\s+the\s+rate|at\s+sign|at)\s+/g, "@");
  s = s.replace(/@\s+/g, "@");
  s = s.replace(/\s+@/g, "@");

  s = s.replace(/\s+(?:dot|period|point)\s+/g, ".");
  s = s.replace(/\.\s+/g, ".");
  s = s.replace(/\s+\./g, ".");

  s = s.replace(/\s+(?:underscore|under\s+score)\s+/g, "_");
  s = s.replace(/\s+(?:dash|hyphen|minus)\s+/g, "-");
  s = s.replace(/\s+(?:plus)\s+/g, "+");

  if (s.includes("@")) {
    const atParts = s.split("@");
    if (atParts.length === 2) {
      const user = atParts[0].replace(/\s+/g, "");
      const domain = atParts[1].replace(/\s+/g, "");
      s = `${user}@${domain}`;
    } else {
      s = s.replace(/\s+/g, "");
    }
  } else {
    // If no '@', check if a common spoken domain was uttered
    const commonDomains = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
      "proton.me",
      "protonmail.com",
    ];
    for (const dom of commonDomains) {
      const domRegex = new RegExp(
        `(?:\\s+at\\s+|\\s+)(?:${dom.replace(".", "\\.")})`,
        "i"
      );
      if (domRegex.test(s)) {
        s = s.replace(domRegex, `@${dom}`);
        break;
      }
    }
    s = s.replace(/\s+/g, "");
  }

  return s;
}

export async function validateAndVerifyEmail(
  raw: string,
  bizId?: string
): Promise<EmailVerificationResult> {
  const cleaned = (raw || "").trim();
  if (!cleaned) {
    return {
      ok: false,
      valid: false,
      reason: "empty",
      message: "Email address cannot be empty.",
    };
  }

  // Normalize spoken patterns: "toufik dot farhan at gmail dot com", "toufiq farhan zero at gmail dot com"
  let s = cleanSpokenEmailText(cleaned);

  // If there is no '@' and no domain structure
  if (!s.includes("@")) {
    return {
      ok: false,
      valid: false,
      reason: "missing_at",
      message: "Email address must contain '@' (e.g. name@gmail.com).",
    };
  }

  if ((s.match(/@/g) || []).length !== 1) {
    return {
      ok: false,
      valid: false,
      reason: "invalid_at_count",
      message: "Email address must contain exactly one '@' symbol.",
    };
  }

  const [userPart, rawDomainPart] = s.split("@");
  let domainPart = rawDomainPart;
  if (!userPart) {
    return {
      ok: false,
      valid: false,
      reason: "missing_user",
      message: "Missing username before '@' in email address.",
    };
  }
  if (!domainPart || !domainPart.includes(".")) {
    return {
      ok: false,
      valid: false,
      reason: "missing_domain",
      message: "Missing domain in email address (e.g. @gmail.com).",
    };
  }

  if (userPart.startsWith(".") || userPart.endsWith(".") || userPart.includes("..")) {
    return {
      ok: false,
      valid: false,
      reason: "invalid_user",
      message: "Email username cannot start, end with, or contain consecutive dots.",
    };
  }

  let autoFixed = false;
  const originalInput = cleaned;

  if (COMMON_DOMAIN_FIXES[domainPart]) {
    domainPart = COMMON_DOMAIN_FIXES[domainPart];
    s = `${userPart}@${domainPart}`;
    autoFixed = true;
  } else {
    const parts = domainPart.split(".");
    const tld = parts[parts.length - 1];
    if (COMMON_TLD_FIXES[tld]) {
      parts[parts.length - 1] = COMMON_TLD_FIXES[tld];
      domainPart = parts.join(".");
      s = `${userPart}@${domainPart}`;
      autoFixed = true;
    }
  }

  const emailPattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
  if (!emailPattern.test(s)) {
    return {
      ok: false,
      valid: false,
      reason: "invalid_chars",
      message: "Email address contains invalid characters.",
    };
  }

  const tld = domainPart.split(".").pop() || "";
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return {
      ok: false,
      valid: false,
      reason: "invalid_tld",
      message: "Please enter a valid domain extension (e.g. .com, .org).",
    };
  }

  const FAKE_OR_EXAMPLE_DOMAINS = new Set([
    "example.com",
    "test.com",
    "sample.com",
    "domain.com",
    "fake.com",
    "placeholder.com",
    "mailinator.com",
    "tempmail.com",
  ]);

  if (FAKE_OR_EXAMPLE_DOMAINS.has(domainPart)) {
    return {
      ok: false,
      valid: false,
      reason: "example_domain",
      message: "Placeholder or example email domains (like @example.com) are not accepted. Please provide your real, active email address.",
    };
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
    return {
      ok: false,
      valid: false,
      reason: "disposable",
      message:
        "Temporary or disposable email addresses are not accepted. Please provide a standard email address.",
    };
  }

  let dnsVerified = true;
  if (domainPart !== "localhost") {
    try {
      const addresses = await dns.resolve(domainPart, "MX").catch(async () => {
        return await dns.resolve(domainPart, "A");
      });
      if (!addresses || addresses.length === 0) {
        return {
          ok: false,
          valid: false,
          reason: "no_mx_records",
          message: `The domain '@${domainPart}' has no active mail server (no MX or DNS records found). Please check for spelling mistakes.`,
        };
      }
    } catch {
      return {
        ok: false,
        valid: false,
        reason: "domain_not_found",
        message: `The domain '@${domainPart}' does not exist on the internet. Please check for a spelling mistake.`,
      };
    }
  }

  const bizKey = bizId || "default";
  try {
    await setActiveVerifiedEmail(bizKey, s);
  } catch {}

  return {
    ok: true,
    valid: true,
    email: s,
    domain: domainPart,
    auto_corrected: autoFixed,
    original: originalInput,
    dns_verified: dnsVerified,
    mailbox_verified: dnsVerified,
    message: `Email verified: ${s}. Please confirm this with the caller.`,
  };
}

export async function normalizeEmail(
  raw: string,
  bizId?: string
): Promise<{ email: string | null; problem: string }> {
  if (
    !raw ||
    ["unknown", "unknown@unknown.com", "none", "null", ""].includes(
      raw.trim().toLowerCase()
    )
  ) {
    return { email: null, problem: "missing_email" };
  }

  const res = await validateAndVerifyEmail(raw, bizId);
  if (res.ok && res.email) {
    return { email: res.email, problem: "" };
  }

  return { email: null, problem: res.reason || "bad_email" };
}
