import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools-handler";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const result = await executeTool("send_confirmation", "biz_demo_dental", {
      confirmation_code: code,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
