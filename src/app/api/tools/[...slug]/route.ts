import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools-handler";
import { store } from "@/lib/store";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;
    let businessId = "biz_demo_dental";
    let toolName = "";

    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "Missing tool name" }, { status: 400, headers: CORS_HEADERS });
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
    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
