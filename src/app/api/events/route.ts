import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = parseInt(searchParams.get("since") || "0", 10);
  const events = store.eventsSince(isNaN(since) ? 0 : since);
  const cursor = events.length > 0 ? events[events.length - 1].seq : since;
  return NextResponse.json({ events, cursor });
}
