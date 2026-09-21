import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools-handler";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;
    let businessId = "biz_demo_dental";
    let toolName = "";

    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "Missing tool name" }, { status: 400 });
    }

    if (slug.length === 1) {
      toolName = slug[0];
    } else {
      businessId = slug[0];
      toolName = slug[1];
    }

    let args: any = {};
    try {
      args = await request.json();
    } catch {}

    const result = await executeTool(toolName, businessId, args);
    const toolPath = `/tools/${slug.join("/")}`;
    store.logEvent(toolPath, args, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
