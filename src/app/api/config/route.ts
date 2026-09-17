import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { store } from "@/lib/store";

export async function GET() {
  try {
    let agentId = process.env.AGENT_ID || "";
    const agentIdFile = path.resolve(process.cwd(), "agent_id.txt");
    if (!agentId && fs.existsSync(agentIdFile)) {
      agentId = fs.readFileSync(agentIdFile, "utf-8").trim();
    }

    let systemPrompt = "";
    const agentJsonFile = path.resolve(process.cwd(), "agent.json");
    if (fs.existsSync(agentJsonFile)) {
      try {
        const def = JSON.parse(fs.readFileSync(agentJsonFile, "utf-8"));
        systemPrompt = def.system_prompt || "";
      } catch {}
    }

    return NextResponse.json({
      agent_id: agentId,
      services: Object.keys(store.state.services).sort(),
      system_prompt: systemPrompt,
      supabase_url: process.env.SUPABASE_URL || "",
      supabase_anon_key: process.env.SUPABASE_ANON_KEY || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
