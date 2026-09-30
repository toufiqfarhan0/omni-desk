import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/db";
import {
  verifyAgentExists,
  clearAgentVerificationCache,
  getApiKey,
  ASSEMBLYAI_AGENT_HOST,
} from "@/lib/assemblyai";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/owner/businesses/[id]/verify-agent
 * Checks if the configured AssemblyAI Voice Agent ID actually exists on AssemblyAI's cloud API.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const biz = await getBusiness(id);
    if (!biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let agentId = (biz.assemblyai_agent_id || "").trim();

    const apiKey = getApiKey();
    let isLive = false;
    let verifiedId = agentId;

    if (agentId) {
      isLive = await verifyAgentExists(agentId, true);
    }

    // If agent ID is 404 or unconfigured on this cluster, check if an agent for this business already exists
    if (!isLive && apiKey) {
      try {
        const listRes = await fetch(`${ASSEMBLYAI_AGENT_HOST}/v1/agents`, {
          headers: { Authorization: apiKey },
          cache: "no-store",
        });
        if (listRes.ok) {
          const listData = await listRes.json().catch(() => ({}));
          const targetName = (biz.name || "").trim().toLowerCase();
          const match = (listData.agents || []).find((a: any) => {
            const aName = (a.name || "").trim().toLowerCase();
            return aName && (aName === targetName || targetName.includes(aName) || aName.includes(targetName));
          });
          if (match && match.id) {
            verifiedId = match.id;
            isLive = true;
            try {
              const { updateBusiness } = await import("@/lib/db");
              await updateBusiness(id, { assemblyai_agent_id: match.id });
            } catch {}
          }
        }
      } catch {}
    }

    if (isLive && verifiedId) {
      return NextResponse.json({
        ok: true,
        status: "active",
        is_live: true,
        agent_id: verifiedId,
        message: `Agent is active, verified, and operational on AssemblyAI (${verifiedId}).`,
      });
    }

    return NextResponse.json({
      ok: false,
      status: "not_found",
      is_live: false,
      agent_id: agentId,
      message: `No active agent found for "${biz.name}" on this AssemblyAI account. Click Deploy Agent to sync.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/owner/businesses/[id]/verify-agent
 * Verifies the agent, and if it is 404 or missing, automatically self-heals / re-provisions it,
 * saves the working agent ID to the database, and returns the healthy status.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const biz = await getBusiness(id);
    if (!biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check if force_reprovision was explicitly requested
    let forceReprovision = false;
    try {
      const body = await request.json();
      forceReprovision = Boolean(body?.force_reprovision);
    } catch {}

    let existingId = (biz.assemblyai_agent_id || "").trim();

    if (existingId && !forceReprovision) {
      clearAgentVerificationCache(existingId);
      const isLive = await verifyAgentExists(existingId, true);
      if (isLive) {
        return NextResponse.json({
          ok: true,
          status: "active",
          is_live: true,
          agent_id: existingId,
          business_id: biz.id,
          message: `Agent ${existingId} is active and healthy on AssemblyAI.`,
        });
      }
    }

    // Auto-heal / resolve matching agent
    const publicBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      new URL(request.url).origin;

    const { getOrProvisionAgent } = await import("@/lib/assemblyai");
    const healedId = await getOrProvisionAgent(biz, publicBaseUrl);
    if (healedId) {
      return NextResponse.json({
        ok: true,
        status: "active",
        is_live: true,
        agent_id: healedId,
        business_id: biz.id,
        message: `Agent ${healedId} is active and verified on AssemblyAI.`,
      });
    }

    return NextResponse.json({
      ok: false,
      status: "not_found",
      is_live: false,
      agent_id: existingId,
      message: `Agent '${existingId}' is not found on AssemblyAI for this API key. Use Deploy to re-create it.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

