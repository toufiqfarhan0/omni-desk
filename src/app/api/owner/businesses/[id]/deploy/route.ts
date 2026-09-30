import { NextResponse } from "next/server";
import { getBusiness, updateBusiness } from "@/lib/db";
import { deployOrUpdateAgent, getApiKey } from "@/lib/assemblyai";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const storedBiz = await getBusiness(id);

    // Merge any live config overrides passed in the request body
    let bodyData: any = {};
    try {
      bodyData = await request.json();
    } catch {}

    const canonicalStoredAgentId =
      storedBiz?.assemblyai_agent_id?.trim() || bodyData.assemblyai_agent_id?.trim() || "";

    const biz = {
      ...(storedBiz || {}),
      ...bodyData,
      id,
      services: bodyData.services || storedBiz?.services || [],
      assemblyai_agent_id: canonicalStoredAgentId,
    };

    if (!storedBiz && !bodyData.name) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const vercelUrl = process.env.VERCEL_URL
      ? (process.env.VERCEL_URL.startsWith("http")
          ? process.env.VERCEL_URL
          : `https://${process.env.VERCEL_URL}`)
      : null;

    const publicBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      vercelUrl ||
      new URL(request.url).origin;

    const result = await deployOrUpdateAgent(biz, publicBaseUrl);

    const finalAgentId = result.agent_id;

    if (result.ok && finalAgentId) {
      // Save ID to DB if:
      // 1. New business (no stored ID yet), OR
      // 2. ID changed due to one-time key migration (stored ID belonged to different API key)
      const storedId = storedBiz?.assemblyai_agent_id?.trim() || "";
      if (!storedId || finalAgentId !== storedId) {
        await updateBusiness(id, { assemblyai_agent_id: finalAgentId });
      }
      return NextResponse.json({
        ok: true,
        agent_id: finalAgentId,
        business: { ...biz, assemblyai_agent_id: finalAgentId },
        message: "Voice agent successfully deployed to AssemblyAI",
      });
    }

    const apiKey = getApiKey();
    const keyFingerprint = apiKey
      ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (${apiKey.length} chars)`
      : "NOT_SET";

    return NextResponse.json(
      {
        ok: false,
        error: result.error || "Failed to deploy agent to AssemblyAI",
        status_code: result.status_code,
        key_fingerprint: keyFingerprint,
      },
      { status: 422 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
