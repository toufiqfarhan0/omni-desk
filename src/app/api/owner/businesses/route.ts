import { NextResponse } from "next/server";
import { listBusinesses, createBusiness, updateBusiness } from "@/lib/db";
import { deployOrUpdateAgent } from "@/lib/assemblyai";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId") || "owner_demo";
    const businesses = await listBusinesses(ownerId);
    return NextResponse.json({ businesses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ownerId = body.owner_id || searchParams.get("ownerId") || "owner_demo";

    const id =
      body.id || `biz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const biz = await createBusiness({
      ...body,
      id,
      owner_id: ownerId,
    });

    // Auto-provision cloud agent on AssemblyAI with min_latency and pre-loaded catalog
    const publicBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      new URL(request.url).origin;

    try {
      const deployRes = await deployOrUpdateAgent(biz, publicBaseUrl);
      if (deployRes.ok && deployRes.agent_id) {
        await updateBusiness(biz.id, { assemblyai_agent_id: deployRes.agent_id });
        biz.assemblyai_agent_id = deployRes.agent_id;
      }
    } catch (deployErr) {
      console.warn("[AssemblyAI] Initial auto-provision deferred to first call:", deployErr);
    }

    return NextResponse.json({ business: biz }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

