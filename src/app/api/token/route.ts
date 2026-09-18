import { NextResponse } from "next/server";
import { mintAgentToken } from "@/lib/assemblyai";
import { getBusiness } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || "biz_demo_dental";

    const biz = await getBusiness(businessId);
    const agentId =
      biz?.assemblyai_agent_id ||
      process.env.AGENT_ID ||
      "";

    const token = await mintAgentToken(600);

    return NextResponse.json({
      token,
      agent_id: agentId,
      business_id: businessId,
      business_name: biz?.name || "OmniDesk",
      greeting: biz?.greeting,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to mint token" },
      { status: 500 }
    );
  }
}
