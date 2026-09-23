import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/db";
import { mintAgentToken, getOrProvisionAgent } from "@/lib/assemblyai";

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

    const publicBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      new URL(request.url).origin;

    const agentId = await getOrProvisionAgent(biz, publicBaseUrl);
    const token = await mintAgentToken(600);

    return NextResponse.json({
      token,
      agent_id: agentId,
      business_id: biz.id,
      business_name: biz.name,
      greeting: biz.greeting,
      voice: biz.voice_id || "alba",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
