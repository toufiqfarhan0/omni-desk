import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/db";
import { mintAgentToken } from "@/lib/assemblyai";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const biz = await getBusiness(id);
    if (!biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const token = await mintAgentToken(600);
    let agentId = biz.assemblyai_agent_id;
    if (id === "biz_demo_dental") {
      agentId =
        process.env.AGENT_ID ||
        biz.assemblyai_agent_id ||
        "agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794";
    } else if (!agentId) {
      agentId = process.env.AGENT_ID || "";
    }

    return NextResponse.json({
      token,
      agent_id: agentId,
      business_id: biz.id,
      business_name: biz.name,
      greeting: biz.greeting,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
