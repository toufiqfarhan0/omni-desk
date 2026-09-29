import { NextResponse } from "next/server";
import { recordConversation, getBookingByCode } from "@/lib/db";
import { getSupabase } from "@/lib/supabase-db";

function isInvalidCallerName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return true;
  const clean = name.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 35) return true;
  const blacklisted = [
    "initial consultation", "consultation", "standard service", "haircut", "styling",
    "blowout", "balayage", "color", "full color", "treatment", "therapy",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "today", "tomorrow", "morning", "afternoon", "evening",
    "yes", "no", "okay", "ok", "yeah", "yep", "sure", "hello", "hi", "hey",
    "thanks", "thank you", "please", "appointment", "booking", "schedule",
    "demo caller", "caller", "unknown"
  ];
  return blacklisted.some(b => clean === b || clean.includes("consultation") || clean.includes("appointment"));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id =
      body.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const businessId = body.business_id || "biz_demo_dental";

    let callerName = body.caller_name || null;
    let callerEmail = body.caller_email || null;
    let status = body.status || "completed";
    let outcome = body.outcome || "inquiry";
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    // Check if there is a confirmation code in the body or inside transcript
    let confirmationCode = body.confirmation_code || null;
    if (!confirmationCode) {
      for (const t of transcript) {
        const text = typeof t?.text === "string" ? t.text : "";
        const m = text.match(/(?:confirmation code is|reservation code is|booking code is|code is)\s*([A-Za-z0-9]{5,7})/i);
        if (m) {
          confirmationCode = m[1].toUpperCase();
          break;
        }
      }
    }

    if (confirmationCode) {
      status = "booked";
      outcome = "appointment_scheduled";

      // 1. Look up real booking details for 100% accurate customer name
      const booking = await getBookingByCode(confirmationCode);
      if (booking) {
        if (!callerName || isInvalidCallerName(callerName)) {
          callerName = booking.customer_name;
        }
        if (!callerEmail) {
          callerEmail = booking.customer_email;
        }
      }

      // 2. Remove duplicate placeholder conv_bkg_${confirmationCode} if created by tools-handler
      try {
        const client = getSupabase();
        if (client) {
          await client.from("conversations").delete().eq("id", `conv_bkg_${confirmationCode}`);
        }
      } catch (delErr) {
        console.warn("[conversations/save] Could not delete duplicate placeholder:", delErr);
      }
    }

    // Fallback if callerName is still invalid
    if (isInvalidCallerName(callerName)) {
      callerName = callerEmail ? callerEmail.split("@")[0] : "Caller";
    }

    const conversation = {
      id,
      business_id: businessId,
      caller_name: callerName,
      caller_email: callerEmail,
      started_at: body.started_at || new Date().toISOString(),
      ended_at: body.ended_at || new Date().toISOString(),
      duration_seconds: body.duration_seconds || 0,
      status,
      outcome,
      transcript,
      tool_calls: Array.isArray(body.tool_calls) ? body.tool_calls : [],
    };

    await recordConversation(conversation);
    return NextResponse.json({ ok: true, conversation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
