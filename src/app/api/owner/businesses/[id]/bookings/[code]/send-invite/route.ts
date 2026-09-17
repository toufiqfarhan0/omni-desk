import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools-handler";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; code: string }> }
) {
  try {
    const { id, code } = await context.params;
    const result = await executeTool("send_confirmation", id, {
      confirmation_code: code,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
