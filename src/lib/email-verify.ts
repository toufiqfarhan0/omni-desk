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

  // Normalize spoken patterns: "alex dot smith at gmail dot com"
  let s = cleaned.toLowerCase();
  s = s.replace(/\s+at\s+/g, "@");
  s = s.replace(/\s+dot\s+/g, ".");
  s = s.replace(/\s+underscore\s+/g, "_");
  s = s.replace(/\s+dash\s+|\s+hyphen\s+/g, "-");
  s = s.replace(/\s+/g, "");

  if (!s.includes("@") || (s.match(/@/g) || []).length !== 1) {
    return {
      ok: false,
      valid: false,
      reason: "missing_at",
      message: "Email address must contain exactly one '@' symbol (e.g. name@gmail.com).",
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
  if (!["localhost", "example.com", "test.com"].includes(domainPart)) {
    try {
      const addresses = await dns.resolve(domainPart, "MX").catch(async () => {
        return await dns.resolve(domainPart, "A");
      });
      if (!addresses || addresses.length === 0) {
        dnsVerified = false;
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

  let mailboxVerified = false;
  const abstractKey =
    process.env.ABSTRACT_EMAIL_API_KEY || process.env.ABSTRACT_API_KEY;

  if (abstractKey) {
    try {
      const res = await fetch(
        `https://emailreputation.abstractapi.com/v1/?api_key=${encodeURIComponent(
          abstractKey
        )}&email=${encodeURIComponent(s)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const rep = await res.json();
        const deliverability = rep.email_deliverability || {};
        const status = String(deliverability.status || "").toLowerCase();
        const detail = String(deliverability.status_detail || "").toLowerCase();
        const isSmtpValid = deliverability.is_smtp_valid;
        const quality = rep.email_quality || {};

        if (quality.is_disposable) {
          return {
            ok: false,
            valid: false,
            reason: "disposable",
            message:
              "Temporary or disposable email addresses are not accepted. Please provide a standard personal or work email address.",
          };
        }

        if (
          status === "undeliverable" ||
          detail === "invalid_mailbox" ||
          isSmtpValid === false
        ) {
          return {
            ok: false,
            valid: false,
            reason: "invalid_mailbox",
            message: `The email address '${s}' does not appear to exist or cannot receive mail. Please provide an active email.`,
          };
        }

        if (status === "deliverable" || isSmtpValid === true) {
          mailboxVerified = true;
        }

        const suggested = rep.suggested_correction;
        if (suggested && suggested.toLowerCase() !== s.toLowerCase()) {
          s = suggested.toLowerCase();
          autoFixed = true;
        }
      }
    } catch {
      // Gracefully continue if Abstract API times out or errors
    }
  }

  const bizKey = bizId || "default";
  try {
    setActiveVerifiedEmail(bizKey, s);
    setActiveVerifiedEmail("default", s);
  } catch {}

  return {
    ok: true,
    valid: true,
    email: s,
    domain: domainPart,
    auto_corrected: autoFixed,
    original: originalInput,
    dns_verified: dnsVerified,
    mailbox_verified: mailboxVerified,
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

  const cached = getActiveVerifiedEmail(bizId || "default");
  if (cached) {
    return { email: cached, problem: "" };
  }

  return { email: null, problem: res.reason || "bad_email" };
}
