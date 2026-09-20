import { NextResponse } from "next/server";
import { mintAgentToken } from "@/lib/assemblyai";
import { getBusiness } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || "biz_demo_dental";

    const biz = await getBusiness(businessId);
    let agentId = "";

    // For the pre-configured hair salon demo, prioritize explicit AGENT_ID env variable,
    // followed by database assemblyai_agent_id, followed by the verified default demo agent ID.
    if (businessId === "biz_demo_dental" || !biz) {
      agentId =
        process.env.AGENT_ID ||
        biz?.assemblyai_agent_id ||
        "agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794";
    } else {
      agentId = biz?.assemblyai_agent_id || process.env.AGENT_ID || "";
    }

    if (!agentId) {
      return NextResponse.json(
        {
          error: "NOT_DEPLOYED",
          message: "This agent has not been deployed to AssemblyAI yet. Please click 'Deploy to AssemblyAI' in the AI Agent Builder first.",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const token = await mintAgentToken(600);

    return NextResponse.json(
      {
        token,
        agent_id: agentId,
        business_id: businessId,
        business_name: biz?.name || "OmniDesk",
        greeting: biz?.greeting,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to mint token" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
