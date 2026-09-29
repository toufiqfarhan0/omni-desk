import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Load .env
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const dbPath = path.join(process.cwd(), "data", "omnidesk.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = OFF"); // Temporarily disable FK checks for bulk upsert

async function sync() {
  console.log("=== SYNCING SUPABASE -> SQLITE (data/omnidesk.db) ===");

  // 1. Owners
  const { data: owners, error: errOwners } = await supabase.from("owners").select("*");
  if (errOwners) console.error("Error fetching owners:", errOwners);
  else {
    const insertOwner = db.prepare(`
      INSERT INTO owners (id, email, name, password_hash, created_at)
      VALUES (@id, @email, @name, @password_hash, @created_at)
      ON CONFLICT(id) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        created_at=excluded.created_at
    `);
    for (const o of owners) {
      insertOwner.run({
        id: o.id,
        email: o.email,
        name: o.name || null,
        password_hash: o.password_hash || null,
        created_at: o.created_at || new Date().toISOString(),
      });
    }
    console.log(`Synced ${owners.length} owners.`);
  }

  // 2. Businesses
  const { data: businesses, error: errBiz } = await supabase.from("businesses").select("*");
  if (errBiz) console.error("Error fetching businesses:", errBiz);
  else {
    const insertBiz = db.prepare(`
      INSERT INTO businesses (
        id, owner_id, name, industry, tone, greeting, system_prompt, voice_id,
        slot_minutes, open_hour, close_hour, operating_days, keyterms, assemblyai_agent_id, created_at, updated_at
      ) VALUES (
        @id, @owner_id, @name, @industry, @tone, @greeting, @system_prompt, @voice_id,
        @slot_minutes, @open_hour, @close_hour, @operating_days, @keyterms, @assemblyai_agent_id, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        industry=excluded.industry,
        tone=excluded.tone,
        greeting=excluded.greeting,
        system_prompt=excluded.system_prompt,
        voice_id=excluded.voice_id,
        slot_minutes=excluded.slot_minutes,
        open_hour=excluded.open_hour,
        close_hour=excluded.close_hour,
        operating_days=excluded.operating_days,
        keyterms=excluded.keyterms,
        assemblyai_agent_id=COALESCE(excluded.assemblyai_agent_id, businesses.assemblyai_agent_id),
        updated_at=excluded.updated_at
    `);
    for (const b of businesses) {
      insertBiz.run({
        id: b.id,
        owner_id: b.owner_id,
        name: b.name,
        industry: b.industry || "salon",
        tone: b.tone || "warm",
        greeting: b.greeting,
        system_prompt: b.system_prompt,
        voice_id: b.voice_id || "alba",
        slot_minutes: b.slot_minutes ?? 30,
        open_hour: b.open_hour ?? 9,
        close_hour: b.close_hour ?? 17,
        operating_days: b.operating_days || "mon-fri",
        keyterms: typeof b.keyterms === "string" ? b.keyterms : JSON.stringify(b.keyterms || []),
        assemblyai_agent_id: b.assemblyai_agent_id || null,
        created_at: b.created_at || new Date().toISOString(),
        updated_at: b.updated_at || new Date().toISOString(),
      });
    }
    console.log(`Synced ${businesses.length} businesses.`);
  }

  // 3. Services
  const { data: services, error: errServices } = await supabase.from("services").select("*");
  if (errServices) console.error("Error fetching services:", errServices);
  else {
    const insertService = db.prepare(`
      INSERT INTO services (id, business_id, key, label, minutes, price, description)
      VALUES (@id, @business_id, @key, @label, @minutes, @price, @description)
      ON CONFLICT(id) DO UPDATE SET
        label=excluded.label,
        minutes=excluded.minutes,
        price=excluded.price,
        description=excluded.description
      ON CONFLICT(business_id, key) DO UPDATE SET
        label=excluded.label,
        minutes=excluded.minutes,
        price=excluded.price,
        description=excluded.description
    `);
    for (const s of services) {
      insertService.run({
        id: s.id,
        business_id: s.business_id,
        key: s.key,
        label: s.label,
        minutes: s.minutes ?? 30,
        price: s.price ?? 0,
        description: s.description || null,
      });
    }
    console.log(`Synced ${services.length} services.`);
  }

  // 4. Bookings
  const { data: bookings, error: errBookings } = await supabase.from("bookings").select("*");
  if (errBookings) console.error("Error fetching bookings:", errBookings);
  else {
    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        id, business_id, confirmation_code, service_key, service_label,
        appointment_date, appointment_time, customer_name, customer_email,
        price, status, confirmation_sent, created_at
      ) VALUES (
        @id, @business_id, @confirmation_code, @service_key, @service_label,
        @appointment_date, @appointment_time, @customer_name, @customer_email,
        @price, @status, @confirmation_sent, @created_at
      )
      ON CONFLICT(confirmation_code) DO UPDATE SET
        service_key=excluded.service_key,
        service_label=excluded.service_label,
        appointment_date=excluded.appointment_date,
        appointment_time=excluded.appointment_time,
        customer_name=excluded.customer_name,
        customer_email=excluded.customer_email,
        price=excluded.price,
        status=excluded.status,
        confirmation_sent=excluded.confirmation_sent
    `);
    for (const bk of bookings) {
      insertBooking.run({
        id: bk.id,
        business_id: bk.business_id,
        confirmation_code: bk.confirmation_code,
        service_key: bk.service_key,
        service_label: bk.service_label,
        appointment_date: bk.appointment_date,
        appointment_time: bk.appointment_time,
        customer_name: bk.customer_name,
        customer_email: bk.customer_email,
        price: bk.price,
        status: bk.status || "confirmed",
        confirmation_sent: bk.confirmation_sent ? 1 : 0,
        created_at: bk.created_at || new Date().toISOString(),
      });
    }
    console.log(`Synced ${bookings.length} bookings.`);
  }

  // 5. Conversations
  const { data: conversations, error: errConvs } = await supabase.from("conversations").select("*");
  if (errConvs) console.error("Error fetching conversations:", errConvs);
  else {
    const insertConv = db.prepare(`
      INSERT INTO conversations (
        id, business_id, caller_name, caller_email, started_at, ended_at,
        duration_seconds, status, outcome, transcript, tool_calls
      ) VALUES (
        @id, @business_id, @caller_name, @caller_email, @started_at, @ended_at,
        @duration_seconds, @status, @outcome, @transcript, @tool_calls
      )
      ON CONFLICT(id) DO UPDATE SET
        caller_name=excluded.caller_name,
        caller_email=excluded.caller_email,
        started_at=excluded.started_at,
        ended_at=excluded.ended_at,
        duration_seconds=excluded.duration_seconds,
        status=excluded.status,
        outcome=excluded.outcome,
        transcript=excluded.transcript,
        tool_calls=excluded.tool_calls
    `);
    for (const c of conversations) {
      insertConv.run({
        id: c.id,
        business_id: c.business_id,
        caller_name: c.caller_name || null,
        caller_email: c.caller_email || null,
        started_at: c.started_at || new Date().toISOString(),
        ended_at: c.ended_at || null,
        duration_seconds: c.duration_seconds || 0,
        status: c.status || "completed",
        outcome: c.outcome || "inquiry",
        transcript: typeof c.transcript === "string" ? c.transcript : JSON.stringify(c.transcript || []),
        tool_calls: typeof c.tool_calls === "string" ? c.tool_calls : JSON.stringify(c.tool_calls || []),
      });
    }
    console.log(`Synced ${conversations.length} conversations.`);
  }

  db.pragma("foreign_keys = ON");
  console.log("=== SYNC COMPLETED SUCCESSFULLY ===");
}

sync().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
