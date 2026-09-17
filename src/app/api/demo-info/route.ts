import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { store } from "@/lib/store";
import { formatDaySpoken, formatTimeSpoken } from "@/lib/calendar";

export async function GET() {
  try {
    let definition: any = {
      name: "OmniDesk Hair Salon Receptionist",
      voice: { voice_id: "alba" },
      keyterms: ["haircut", "styling", "balayage", "coloring"],
      tools: [],
    };

    const agentJsonFile = path.resolve(process.cwd(), "agent.json");
    if (fs.existsSync(agentJsonFile)) {
      try {
        definition = JSON.parse(fs.readFileSync(agentJsonFile, "utf-8"));
      } catch {}
    }

    const days: any[] = [];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    for (let i = 0; i < 21; i++) {
      if (days.length >= 5) break;
      const cur = new Date(now);
      cur.setDate(now.getDate() + i);
      const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(
        cur.getDate()
      )}`;

      const slots = store.availableSlots(iso, 99);
      if (store.isOpen(iso) && slots.length > 0) {
        days.push({
          date: iso,
          label: formatDaySpoken(iso),
          slots: slots.map(formatTimeSpoken),
          total: slots.length,
        });
      }
    }

    const services = Object.entries(store.state.services)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        key: k,
        label: v.label,
        minutes: v.minutes,
      }));

    return NextResponse.json({
      agent: {
        name: definition.name || "OmniDesk Hair Salon Receptionist",
        voice: definition.voice?.voice_id || "alba",
        keyterms: definition.keyterms || [],
        tools: (definition.tools || []).map((t: any) => ({
          name: t.name,
          url: (t.http?.url || "").split("/").filter(Boolean).pop() || t.name,
        })),
      },
      hours: {
        days: "Monday to Friday",
        open: "9:00 am",
        close: "5:00 pm",
        slot_minutes: store.state.slotMinutes,
      },
      services,
      days,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
