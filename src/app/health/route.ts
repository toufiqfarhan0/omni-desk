import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    services: Object.keys(store.state.services).sort(),
  });
}
