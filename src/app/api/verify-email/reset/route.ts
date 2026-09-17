import { NextResponse } from "next/server";
import { clearActiveVerifiedEmail } from "@/lib/db";

export async function POST(request: Request) {
  try {
    let businessId = "biz_demo_dental";
    try {
      const body = await request.json();
      if (body.business_id) businessId = body.business_id;
    } catch {}

    clearActiveVerifiedEmail(businessId);
    return NextResponse.json({ ok: true, message: "Email session reset" });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message },
      { status: 500 }
    );
  }
}
