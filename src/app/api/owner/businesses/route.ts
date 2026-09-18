import { NextResponse } from "next/server";
import { listBusinesses, createBusiness } from "@/lib/db";

export async function GET() {
  try {
    const businesses = await listBusinesses("owner_demo");
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

    const id =
      body.id || `biz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const biz = await createBusiness({
      ...body,
      id,
      owner_id: "owner_demo",
    });

    return NextResponse.json({ business: biz }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
