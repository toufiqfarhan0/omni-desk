import { NextResponse } from "next/server";
import { mintAgentToken } from "@/lib/assemblyai";
import { getBusiness } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || "biz_demo_dental";

    const biz = await getBusiness(businessId);
    let agentId = biz?.assemblyai_agent_id;

    // Only allow default AGENT_ID fallback for the official pre-configured hair salon demo
    if (!agentId && (businessId === "biz_demo_dental" || !biz)) {
      agentId = process.env.AGENT_ID || "";
    }

    if (!agentId) {
      return NextResponse.json(
        {
          error: "NOT_DEPLOYED",
          message: "This agent has not been deployed to AssemblyAI yet. Please click 'Deploy to AssemblyAI' in the AI Agent Builder first.",
        },
        { status: 400 }
      );
    }

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
