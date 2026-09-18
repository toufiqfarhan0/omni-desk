import { NextResponse } from "next/server";
import { recordConversation } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id =
      body.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const businessId = body.business_id || "biz_demo_dental";

    const conversation = {
      id,
      business_id: businessId,
      caller_name: body.caller_name || null,
      caller_email: body.caller_email || null,
      started_at: body.started_at || new Date().toISOString(),
      ended_at: body.ended_at || new Date().toISOString(),
      duration_seconds: body.duration_seconds || 0,
      status: body.status || "completed",
      outcome: body.outcome || "inquiry",
      transcript: Array.isArray(body.transcript) ? body.transcript : [],
      tool_calls: Array.isArray(body.tool_calls) ? body.tool_calls : [],
    };

    await recordConversation(conversation);
    return NextResponse.json({ ok: true, conversation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
