import { NextResponse } from "next/server";
import { getBusiness, updateBusiness } from "@/lib/db";
import { deployOrUpdateAgent } from "@/lib/assemblyai";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const biz = getBusiness(id);
    if (!biz) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const publicBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      new URL(request.url).origin;

    const result = await deployOrUpdateAgent(biz, publicBaseUrl);

    if (result.ok && result.agent_id) {
      updateBusiness(id, { assemblyai_agent_id: result.agent_id });
      try {
        const fs = await import("fs");
        const path = await import("path");
        fs.writeFileSync(path.resolve(process.cwd(), "agent_id.txt"), result.agent_id, "utf-8");
      } catch {}
      return NextResponse.json({
        ok: true,
        agent_id: result.agent_id,
        message: "Voice agent successfully deployed to AssemblyAI",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: result.error || "Failed to deploy agent to AssemblyAI",
        status_code: result.status_code,
      },
      { status: 422 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
