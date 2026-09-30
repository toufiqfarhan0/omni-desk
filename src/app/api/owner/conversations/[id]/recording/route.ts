import { NextResponse } from "next/server";
import { getApiKey, ASSEMBLYAI_AGENT_HOST } from "@/lib/assemblyai";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const apiKey = getApiKey();

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "AssemblyAI API key not configured" },
        { status: 500 }
      );
    }

    if (!id || !id.startsWith("sess_")) {
      return NextResponse.json(
        {
          ok: false,
          error: "No cloud session recording available for non-AssemblyAI session IDs",
        },
        { status: 404 }
      );
    }

    const res = await fetch(`${ASSEMBLYAI_AGENT_HOST}/v1/sessions/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `AssemblyAI session lookup failed (${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
    const audioArtifact = artifacts.find(
      (a: any) => a.type === "audio" || (a.content_type && a.content_type.startsWith("audio/"))
    );

    if (!audioArtifact || !audioArtifact.url) {
      return NextResponse.json(
        { ok: false, error: "Audio recording artifact not yet ready or unavailable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      session_id: id,
      recording_url: audioArtifact.url,
      content_type: audioArtifact.content_type || "audio/ogg",
      duration_seconds: data.duration_seconds || 0,
      status: data.status,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
