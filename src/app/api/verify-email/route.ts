import { NextResponse } from "next/server";
import { validateAndVerifyEmail } from "@/lib/email-verify";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email || "";
    const businessId = body.business_id || "biz_demo_dental";

    const result = await validateAndVerifyEmail(email, businessId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, valid: false, message: err.message },
      { status: 500 }
    );
  }
}
