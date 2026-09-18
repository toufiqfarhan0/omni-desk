import { NextResponse } from "next/server";
import { getBusiness, updateBusiness } from "@/lib/db";

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
    return NextResponse.json({ business: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
