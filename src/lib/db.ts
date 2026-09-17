import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DB_DIR, "omnidesk.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma("foreign_keys = ON");
    initDb(dbInstance);
  }
  return dbInstance;
}

export interface Owner {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Service {
  id?: number;
  business_id?: string;
  key: string;
  label: string;
  minutes: number;
  price: number;
  description?: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  industry: string;
  tone: string;
  greeting: string;
  system_prompt: string;
  voice_id: string;
  slot_minutes: number;
  open_hour: number;
  close_hour: number;
  operating_days: string;
  keyterms: string[];
  assemblyai_agent_id?: string | null;
  created_at: string;
  updated_at: string;
  services?: Service[];
}

export interface Booking {
  id: number;
  business_id: string;
  confirmation_code: string;
  service_key: string;
  service_label: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  customer_email: string;
  price: number;
  status: string;
  confirmation_sent: number;
  invite_sent?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  business_id: string;
  caller_name?: string | null;
  caller_email?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  status: string;
  outcome: string;
  transcript: Array<{ who: string; text: string; time?: string }>;
  tool_calls: Array<{ tool: string; args?: any; result?: any }>;
}

function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT 'salon',
      tone TEXT NOT NULL DEFAULT 'warm',
      greeting TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      voice_id TEXT NOT NULL DEFAULT 'alba',
      slot_minutes INTEGER NOT NULL DEFAULT 30,
      open_hour INTEGER NOT NULL DEFAULT 9,
      close_hour INTEGER NOT NULL DEFAULT 17,
      operating_days TEXT NOT NULL DEFAULT 'mon-fri',
      keyterms TEXT NOT NULL DEFAULT '[]',
      assemblyai_agent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES owners (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
      UNIQUE(business_id, key)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      caller_name TEXT,
      caller_email TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      outcome TEXT DEFAULT 'inquiry',
      transcript TEXT NOT NULL DEFAULT '[]',
      tool_calls TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL,
      confirmation_code TEXT UNIQUE NOT NULL,
      service_key TEXT NOT NULL,
      service_label TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      confirmation_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

// Supabase background sync
async function syncToSupabaseAsync(
  pathSegment: string,
  data: any,
  method = "POST"
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  if (!url || !key) return;

  try {
    const targetUrl = `${url.replace(/\/$/, "")}/rest/v1/${pathSegment}`;
    await fetch(targetUrl, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(data),
    });
  } catch {
    // Ignore async background sync failures
  }
}

export interface Owner {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export function getOrCreateOwner(email: string, name?: string): Owner {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  let owner = db
    .prepare("SELECT * FROM owners WHERE email = ?")
    .get(normalized) as Owner | undefined;

  if (!owner) {
    const id =
      normalized === "demo@omnidesk.ai"
        ? "owner_demo"
        : `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const ownerName = name || email.split("@")[0] || "OmniDesk Operator";
    db.prepare(
      "INSERT INTO owners (id, email, name, created_at) VALUES (?, ?, ?, ?)"
    ).run(id, normalized, ownerName, now);
    owner = { id, email: normalized, name: ownerName, created_at: now };
    syncToSupabaseAsync("owners", { ...owner }, "POST");
  } else if (name && owner.name !== name) {
    db.prepare("UPDATE owners SET name = ? WHERE id = ?").run(name, owner.id);
    owner.name = name;
  }
  return owner;
}

export function listBusinesses(ownerId = "owner_demo"): Business[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM businesses WHERE owner_id = ? ORDER BY created_at DESC")
    .all(ownerId) as any[];

  return rows.map((r) => {
    const services = db
      .prepare("SELECT * FROM services WHERE business_id = ? ORDER BY price ASC")
      .all(r.id) as Service[];
    let keyterms: string[] = [];
    try {
      keyterms = JSON.parse(r.keyterms || "[]");
    } catch {
      keyterms = [];
    }
    return {
      ...r,
      keyterms,
      services,
    };
  });
}

export function getBusiness(businessId: string): Business | null {
  const db = getDb();
  const r = db
    .prepare("SELECT * FROM businesses WHERE id = ?")
    .get(businessId) as any;

  if (!r) return null;

  const services = db
    .prepare("SELECT * FROM services WHERE business_id = ? ORDER BY price ASC")
    .all(businessId) as Service[];

  let keyterms: string[] = [];
  try {
    keyterms = JSON.parse(r.keyterms || "[]");
  } catch {
    keyterms = [];
  }

  return {
    ...r,
    keyterms,
    services,
  };
}

export function updateBusiness(
  businessId: string,
  patch: Partial<Business> & { services?: Service[] }
): Business | null {
  const db = getDb();
  const current = getBusiness(businessId);
  if (!current) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const vals: any[] = [];

  const allowedCols: Array<keyof Business> = [
    "name",
    "industry",
    "tone",
    "greeting",
    "system_prompt",
    "voice_id",
    "slot_minutes",
    "open_hour",
    "close_hour",
    "operating_days",
    "assemblyai_agent_id",
  ];

  for (const col of allowedCols) {
    if (patch[col] !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(patch[col]);
    }
  }

  if (patch.keyterms !== undefined) {
    fields.push("keyterms = ?");
    vals.push(JSON.stringify(patch.keyterms));
  }

  fields.push("updated_at = ?");
  vals.push(now);

  vals.push(businessId);

  db.prepare(`UPDATE businesses SET ${fields.join(", ")} WHERE id = ?`).run(...vals);

  if (patch.services && Array.isArray(patch.services)) {
    const deleteStmt = db.prepare("DELETE FROM services WHERE business_id = ?");
    const insertStmt = db.prepare(`
      INSERT INTO services (business_id, key, label, minutes, price, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateTx = db.transaction(() => {
      deleteStmt.run(businessId);
      for (const s of patch.services!) {
        insertStmt.run(
          businessId,
          s.key,
          s.label,
          s.minutes || 30,
          s.price || 0,
          s.description || ""
        );
      }
    });
    updateTx();
  }

  const updated = getBusiness(businessId);
  if (updated) {
    syncToSupabaseAsync("businesses", { ...updated }, "POST");
  }
  return updated;
}

export function createBusiness(data: {
  id: string;
  owner_id?: string;
  name: string;
  industry?: string;
  tone?: string;
  greeting?: string;
  system_prompt?: string;
  voice_id?: string;
  slot_minutes?: number;
  open_hour?: number;
  close_hour?: number;
  operating_days?: string;
  keyterms?: string[];
  services?: Service[];
}): Business {
  const db = getDb();
  const now = new Date().toISOString();
  const ownerId = data.owner_id || "owner_demo";

  db.prepare(`
    INSERT INTO businesses (
      id, owner_id, name, industry, tone, greeting, system_prompt,
      voice_id, slot_minutes, open_hour, close_hour, operating_days,
      keyterms, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    ownerId,
    data.name,
    data.industry || "salon",
    data.tone || "warm",
    data.greeting || "Hello! How can I assist you today?",
    data.system_prompt || "You are a professional voice receptionist.",
    data.voice_id || "alba",
    data.slot_minutes || 30,
    data.open_hour || 9,
    data.close_hour || 17,
    data.operating_days || "mon-fri",
    JSON.stringify(data.keyterms || []),
    now,
    now
  );

  if (data.services && Array.isArray(data.services)) {
    const insertStmt = db.prepare(`
      INSERT INTO services (business_id, key, label, minutes, price, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const s of data.services) {
      insertStmt.run(
        data.id,
        s.key,
        s.label,
        s.minutes || 30,
        s.price || 0,
        s.description || ""
      );
    }
  }

  const res = getBusiness(data.id)!;
  syncToSupabaseAsync("businesses", { ...res }, "POST");
  return res;
}

export function listBookings(businessId: string): Booking[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM bookings WHERE business_id = ? ORDER BY appointment_date DESC, appointment_time DESC"
    )
    .all(businessId) as Booking[];
}

export function getBookingByCode(code: string): Booking | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM bookings WHERE confirmation_code = ?")
    .get(code) as Booking | undefined;
  return row || null;
}

export function createBookingRecord(data: {
  business_id: string;
  service_key: string;
  service_label: string;
  appt_date: string;
  appt_time: string;
  name: string;
  email: string;
  price: number;
}): Booking {
  const db = getDb();
  const now = new Date().toISOString();

  // Generate 6-char random alphanumeric uppercase code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const info = db
    .prepare(`
      INSERT INTO bookings (
        business_id, confirmation_code, service_key, service_label,
        appointment_date, appointment_time, customer_name, customer_email,
        price, status, confirmation_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 0, ?)
    `)
    .run(
      data.business_id,
      code,
      data.service_key,
      data.service_label,
      data.appt_date,
      data.appt_time,
      data.name,
      data.email,
      data.price,
      now
    );

  const rec = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(info.lastInsertRowid) as Booking;

  syncToSupabaseAsync("bookings", { ...rec }, "POST");
  return rec;
}

export function markBookingConfirmationSent(code: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE bookings SET confirmation_sent = 1 WHERE confirmation_code = ?"
  ).run(code);
}

export function listConversations(businessId: string): Conversation[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM conversations WHERE business_id = ? ORDER BY started_at DESC LIMIT 50"
    )
    .all(businessId) as any[];

  return rows.map((r) => {
    let transcript = [];
    let tool_calls = [];
    try {
      transcript = JSON.parse(r.transcript || "[]");
    } catch {}
    try {
      tool_calls = JSON.parse(r.tool_calls || "[]");
    } catch {}
    return {
      ...r,
      transcript,
      tool_calls,
    };
  });
}

export function recordConversation(conv: Conversation): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO conversations (
      id, business_id, caller_name, caller_email, started_at, ended_at,
      duration_seconds, status, outcome, transcript, tool_calls
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conv.id,
    conv.business_id,
    conv.caller_name || null,
    conv.caller_email || null,
    conv.started_at,
    conv.ended_at || null,
    conv.duration_seconds || 0,
    conv.status || "completed",
    conv.outcome || "inquiry",
    JSON.stringify(conv.transcript || []),
    JSON.stringify(conv.tool_calls || [])
  );

  syncToSupabaseAsync("conversations", { ...conv }, "POST");
}

export function getActiveVerifiedEmail(businessId: string): string | null {
  const db = getDb();
  const key = `active_email:${businessId}`;
  const row = db
    .prepare("SELECT value FROM session_store WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setActiveVerifiedEmail(businessId: string, email: string): void {
  const db = getDb();
  const key = `active_email:${businessId}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO session_store (key, value, updated_at)
    VALUES (?, ?, ?)
  `).run(key, email, now);
}

export function clearActiveVerifiedEmail(businessId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM session_store WHERE key = ?").run(`active_email:${businessId}`);
  db.prepare("DELETE FROM session_store WHERE key = ?").run("active_email:default");
}
