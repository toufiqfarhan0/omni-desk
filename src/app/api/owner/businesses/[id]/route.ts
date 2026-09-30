import { NextResponse } from "next/server";
import { getBusiness, updateBusiness } from "@/lib/db";
import { deployOrUpdateAgent } from "@/lib/assemblyai";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const biz = await getBusiness(id);
    if (!biz) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ business: biz });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await updateBusiness(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Instantly sync voice and settings update to AssemblyAI in the cloud
    if (updated.assemblyai_agent_id) {
      const publicBaseUrl =
        process.env.PUBLIC_API_BASE_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : null) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        new URL(request.url).origin;

      deployOrUpdateAgent(updated, publicBaseUrl).catch((err) => {
        console.warn("[AssemblyAI] Background sync of updated business settings failed:", err?.message || err);
      });
    }

    return NextResponse.json({ business: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
