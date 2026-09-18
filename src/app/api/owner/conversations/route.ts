import { NextResponse } from "next/server";
import { listConversations, recordConversation, Conversation } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || "biz_demo_dental";
    const conversations = await listConversations(businessId);
    return NextResponse.json({ conversations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const conv: Conversation = {
      id,
      business_id: body.business_id || "biz_demo_dental",
      caller_name: body.caller_name || null,
      caller_email: body.caller_email || null,
      started_at: body.started_at || new Date().toISOString(),
      ended_at: body.ended_at || new Date().toISOString(),
      duration_seconds: body.duration_seconds || 0,
      status: body.status || "completed",
      outcome: body.outcome || "inquiry",
      transcript: body.transcript || [],
      tool_calls: body.tool_calls || [],
    };

    await recordConversation(conv);
    return NextResponse.json({ ok: true, conversation: conv }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
