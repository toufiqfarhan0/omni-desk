import bcrypt from "bcryptjs";
import {
  supabaseGetOrCreateOwner,
  supabaseSignUpOwner,
  supabaseSignInOwner,
  supabaseListBusinesses,
  supabaseGetBusiness,
  supabaseCreateBusiness,
  supabaseUpdateBusiness,
  supabaseListBookings,
  supabaseGetBookingByCode,
  supabaseCreateBookingRecord,
  supabaseMarkBookingConfirmationSent,
  supabaseListConversations,
  supabaseRecordConversation,
  supabaseGetActiveVerifiedEmail,
  supabaseSetActiveVerifiedEmail,
  supabaseClearActiveVerifiedEmail,
} from "./supabase-db";

export type DbMode = "sqlite" | "dual" | "supabase";

/**
 * Determine the active database mode:
 * 1. "sqlite": Local mode for judges (zero setup, no Supabase keys required).
 * 2. "dual": Local testing mode for user (both SQLite and Supabase synced).
 * 3. "supabase": Deployment mode (on Vercel / production). Zero local SQLite loaded.
 */
export function getDbMode(): DbMode {
  if (process.env.DB_MODE === "sqlite") return "sqlite";
  if (process.env.DB_MODE === "supabase") return "supabase";
  if (process.env.DB_MODE === "dual") return "dual";

  // Check if deployed (Vercel, AWS, Render, Railway, Netlify, or Production environment)
  const isDeployed = Boolean(
    process.env.VERCEL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    process.env.NETLIFY ||
    process.env.RENDER ||
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.FLY_APP_NAME ||
    process.env.DYNO ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.AWS_REGION ||
    process.env.NODE_ENV === "production" ||
    (process.env.PUBLIC_API_BASE_URL &&
      !process.env.PUBLIC_API_BASE_URL.includes("localhost") &&
      !process.env.PUBLIC_API_BASE_URL.includes("127.0.0.1"))
  );

  const hasSupabase = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY)
  );

  if (isDeployed) {
    // When user performs any changes from deployed URL, populate Supabase only!
    return "supabase";
  }

  if (hasSupabase) {
    // Local developer dual-testing mode
    return "dual";
  }

  // Pure zero-config SQLite for judges
  return "sqlite";
}

export interface Owner {
  id: string;
  email: string;
  name: string;
  created_at: string;
  password_hash?: string | null;
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

// -----------------------------------------------------------------------------
// SQLITE SINGLETON & PRE-SEEDED LOCK (Loaded ONLY in sqlite / dual modes)
// -----------------------------------------------------------------------------
let sqliteDbInstance: any = null;

export function getDb(): any {
  if (getDbMode() === "supabase") {
    // In deployment mode, we do NOT touch SQLite at all.
    return null;
  }

  if (!sqliteDbInstance) {
    // Dynamically require better-sqlite3 so Vercel deployment NEVER fails on missing binaries
    const Database = require("better-sqlite3");
    const path = require("node:path");
    const fs = require("node:fs");

    const ROOT = process.cwd();
    const DB_DIR = path.join(ROOT, "data");
    const DB_PATH = path.join(DB_DIR, "omnidesk.db");

    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
    } catch {}

    sqliteDbInstance = new Database(DB_PATH);
    sqliteDbInstance.pragma("foreign_keys = ON");
    initSqliteDb(sqliteDbInstance);
  }
  return sqliteDbInstance;
}

function initSqliteDb(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
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

  // Migrate existing DBs: add password_hash column if missing
  try {
    db.exec(`ALTER TABLE owners ADD COLUMN password_hash TEXT`);
  } catch {
    // Column already exists — safe to ignore
  }

  // PRE-LOCK DEMO OPERATOR ACCOUNT
  const existingOwner = db.prepare("SELECT id FROM owners WHERE id = ?").get("owner_demo");
  if (!existingOwner) {
    db.prepare(`
      INSERT INTO owners (id, email, name, password_hash, created_at)
      VALUES ('owner_demo', 'demo@omnidesk.ai', 'OmniDesk Demo Operator', NULL, datetime('now'))
    `).run();
  }

  // PRE-LOCK DEMO HAIR SALON BUSINESS
  const existingSalon = db.prepare("SELECT id FROM businesses WHERE id = ?").get("biz_demo_dental");
  if (!existingSalon) {
    db.prepare(`
      INSERT INTO businesses (
        id, owner_id, name, industry, tone, greeting, system_prompt, voice_id,
        slot_minutes, open_hour, close_hour, operating_days, keyterms, created_at, updated_at
      ) VALUES (
        'biz_demo_dental',
        'owner_demo',
        'OmniDesk Hair Salon & Studio',
        'salon',
        'warm',
        'Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?',
        'You are an autonomous receptionist for OmniDesk Hair Salon & Studio. You speak in a warm, welcoming tone. You answer questions about haircuts, styling, balayage, and coloring, check real calendar slots using your tools, and book appointments for clients.',
        'alba',
        30, 9, 17, 'mon-fri',
        '["OmniDesk", "OmniDesk Hair Salon", "haircut", "styling", "balayage", "hair coloring", "blowout", "highlights", "scalp treatment"]',
        datetime('now'), datetime('now')
      )
    `).run();

    const insertService = db.prepare(`
      INSERT OR IGNORE INTO services (business_id, key, label, minutes, price, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertService.run("biz_demo_dental", "haircut", "Signature Haircut & Styling", 45, 85, "Custom consultation, precision cut, wash, and luxury blowout.");
    insertService.run("biz_demo_dental", "coloring", "Full Color & Gloss", 90, 185, "All-over single process coloring, custom formulation, and blowout.");
    insertService.run("biz_demo_dental", "balayage", "Artisan Balayage & Highlights", 120, 280, "Hand-painted dimensional highlights, toner formulation, deep conditioning mask, and style.");
    insertService.run("biz_demo_dental", "blowout", "Signature Blowout & Treatment", 45, 65, "Revitalizing scalp massage, clarifying shampoo, hydrating mask, and voluminous blowout styling.");
  }

  // PRE-LOCK DEMO REAL ESTATE BUSINESS
  const existingRealEstate = db.prepare("SELECT id FROM businesses WHERE id = ?").get("biz_demo_realestate");
  if (!existingRealEstate) {
    db.prepare(`
      INSERT INTO businesses (
        id, owner_id, name, industry, tone, greeting, system_prompt, voice_id,
        slot_minutes, open_hour, close_hour, operating_days, keyterms, created_at, updated_at
      ) VALUES (
        'biz_demo_realestate',
        'owner_demo',
        'OmniDesk Real Estate & Property Advisory',
        'realestate',
        'professional',
        'Thanks for calling OmniDesk Real Estate. Are you looking to schedule a private property viewing, home appraisal, or buyer consultation?',
        'You are an autonomous receptionist for OmniDesk Real Estate & Property Advisory. You speak in a confident, polished, and professional tone. You assist callers with scheduling private property viewings, open house tour reservations, home valuation appraisals, and buyer or seller consultations. You check real calendar slots using your tools and book appointments for clients.',
        'michael',
        45, 9, 18, 'mon-fri',
        '["OmniDesk","OmniDesk Real Estate","property viewing","home appraisal","buyer consultation","listing","open house","condo","single family","mortgage pre-approval","escrow"]',
        datetime('now'), datetime('now')
      )
    `).run();

    const insertService = db.prepare(`
      INSERT OR IGNORE INTO services (business_id, key, label, minutes, price, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertService.run("biz_demo_realestate", "viewing", "Private Property Viewing Tour", 45, 0, "Exclusive 1-on-1 guided walkthrough of featured luxury and residential properties.");
    insertService.run("biz_demo_realestate", "consultation", "Buyer & Investor Consultation", 60, 0, "Detailed market trends, neighborhood pricing comparative analysis, and portfolio matching.");
    insertService.run("biz_demo_realestate", "appraisal", "Home Valuation & Seller Strategy", 45, 0, "On-site comparative market analysis and listing preparation strategy for property owners.");
    insertService.run("biz_demo_realestate", "openhouse", "Open House VIP Reservation", 30, 0, "Priority access slot for scheduled weekend open house showings with dedicated agent walkthrough.");
  }
}

// -----------------------------------------------------------------------------
// PUBLIC CRUD API (Automatically dispatches between Supabase and SQLite)
// -----------------------------------------------------------------------------

export async function getOrCreateOwner(email: string, name?: string): Promise<Owner> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseGetOrCreateOwner(email, name);
  }

  const db = getDb();
  const normalized = email.trim().toLowerCase();
  let owner = db.prepare("SELECT * FROM owners WHERE email = ?").get(normalized) as Owner | undefined;

  if (!owner) {
    const id = normalized === "demo@omnidesk.ai" ? "owner_demo" : `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const ownerName = name || email.split("@")[0] || "OmniDesk Operator";
    db.prepare("INSERT INTO owners (id, email, name, password_hash, created_at) VALUES (?, ?, ?, NULL, ?)").run(id, normalized, ownerName, now);
    owner = { id, email: normalized, name: ownerName, created_at: now };
  } else if (name && owner.name !== name) {
    db.prepare("UPDATE owners SET name = ? WHERE id = ?").run(name, owner.id);
    owner.name = name;
  }

  if (mode === "dual") {
    supabaseGetOrCreateOwner(email, name).catch(() => {});
  }

  return owner;
}

/**
 * Sign up a new owner with a hashed password.
 * Returns null if email is already taken.
 */
export async function signUpOwner(
  email: string,
  password: string,
  name?: string
): Promise<Owner | null> {
  const mode = getDbMode();
  const normalized = email.trim().toLowerCase();

  if (mode === "supabase") {
    return await supabaseSignUpOwner(normalized, password, name);
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM owners WHERE email = ?").get(normalized);
  if (existing) return null; // already registered

  const id = `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const ownerName = name || normalized.split("@")[0] || "OmniDesk Operator";
  const hash = await bcrypt.hash(password, 10);

  db.prepare(
    "INSERT INTO owners (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, normalized, ownerName, hash, now);

  const owner: Owner = { id, email: normalized, name: ownerName, created_at: now };

  if (mode === "dual") {
    supabaseSignUpOwner(normalized, password, name).catch(() => {});
  }

  return owner;
}

/**
 * Sign in an existing owner by verifying their password.
 * Returns null if email not found or password wrong.
 */
export async function signInOwner(
  email: string,
  password: string
): Promise<Owner | null> {
  const mode = getDbMode();
  const normalized = email.trim().toLowerCase();

  if (mode === "supabase") {
    return await supabaseSignInOwner(normalized, password);
  }

  const db = getDb();
  const owner = db.prepare("SELECT * FROM owners WHERE email = ?").get(normalized) as (Owner & { password_hash?: string | null }) | undefined;
  if (!owner) return null;

  // If owner has no password set yet, allow them to sign in without one
  // (legacy accounts / demo account)
  if (!owner.password_hash) {
    const { password_hash, ...safe } = owner as any;
    return safe as Owner;
  }

  const valid = await bcrypt.compare(password, owner.password_hash);
  if (!valid) return null;

  const { password_hash, ...safe } = owner as any;
  return safe as Owner;
}

/**
 * Check if an email address is already registered (without verifying password).
 */
export async function emailExists(email: string): Promise<boolean> {
  const mode = getDbMode();
  const normalized = email.trim().toLowerCase();

  if (mode === "supabase") {
    const { getSupabase } = await import("./supabase-db");
    const client = getSupabase();
    if (!client) return false;
    const { data } = await client.from("owners").select("id").eq("email", normalized).maybeSingle();
    return Boolean(data);
  }

  const db = getDb();
  const row = db.prepare("SELECT id FROM owners WHERE email = ?").get(normalized);
  return Boolean(row);
}

export async function listBusinesses(ownerId = "owner_demo"): Promise<Business[]> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseListBusinesses(ownerId);
  }

  const db = getDb();
  const rows = db.prepare("SELECT * FROM businesses WHERE owner_id = ? ORDER BY created_at DESC").all(ownerId) as any[];

  return rows.map((r) => {
    const services = db.prepare("SELECT * FROM services WHERE business_id = ? ORDER BY price ASC").all(r.id) as Service[];
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

export async function getBusiness(businessId: string): Promise<Business | null> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseGetBusiness(businessId);
  }

  const db = getDb();
  const r = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId) as any;
  if (!r) return null;

  const services = db.prepare("SELECT * FROM services WHERE business_id = ? ORDER BY price ASC").all(businessId) as Service[];
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

export async function updateBusiness(
  businessId: string,
  patch: Partial<Business> & { services?: Service[] }
): Promise<Business | null> {
  const mode = getDbMode();
  if (mode === "supabase") {
    // When user changes from deployed URL, populate Supabase only!
    return await supabaseUpdateBusiness(businessId, patch);
  }

  const db = getDb();
  const current = await getBusiness(businessId);
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
        insertStmt.run(businessId, s.key, s.label, s.minutes || 30, s.price || 0, s.description || "");
      }
    });
    updateTx();
  }

  const updated = await getBusiness(businessId);

  if (mode === "dual" && updated) {
    supabaseUpdateBusiness(businessId, patch).catch((err) =>
      console.warn("[Dual Sync] Supabase update business error:", err)
    );
  }

  return updated;
}

export async function createBusiness(data: {
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
}): Promise<Business> {
  const mode = getDbMode();
  if (mode === "supabase") {
    // When user changes from deployed URL, populate Supabase only!
    return await supabaseCreateBusiness(data);
  }

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
      insertStmt.run(data.id, s.key, s.label, s.minutes || 30, s.price || 0, s.description || "");
    }
  }

  const res = (await getBusiness(data.id))!;

  if (mode === "dual") {
    supabaseCreateBusiness(data).catch((err) =>
      console.warn("[Dual Sync] Supabase create business error:", err)
    );
  }

  return res;
}

export async function listBookings(businessId: string): Promise<Booking[]> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseListBookings(businessId);
  }

  const db = getDb();
  return db
    .prepare("SELECT * FROM bookings WHERE business_id = ? ORDER BY appointment_date DESC, appointment_time DESC")
    .all(businessId) as Booking[];
}

export async function getBookingByCode(code: string): Promise<Booking | null> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseGetBookingByCode(code);
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM bookings WHERE confirmation_code = ?").get(code) as Booking | undefined;
  return row || null;
}

export async function createBookingRecord(data: {
  business_id: string;
  service_key: string;
  service_label: string;
  appt_date: string;
  appt_time: string;
  name: string;
  email: string;
  price: number;
}): Promise<Booking> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseCreateBookingRecord(data);
  }

  const db = getDb();
  const now = new Date().toISOString();

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

  const rec = db.prepare("SELECT * FROM bookings WHERE id = ?").get(info.lastInsertRowid) as Booking;

  if (mode === "dual") {
    supabaseCreateBookingRecord(data).catch((err) =>
      console.warn("[Dual Sync] Supabase create booking error:", err)
    );
  }

  return rec;
}

export async function markBookingConfirmationSent(code: string): Promise<void> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseMarkBookingConfirmationSent(code);
  }

  const db = getDb();
  db.prepare("UPDATE bookings SET confirmation_sent = 1 WHERE confirmation_code = ?").run(code);

  if (mode === "dual") {
    supabaseMarkBookingConfirmationSent(code).catch(() => {});
  }
}

export async function listConversations(businessId: string): Promise<Conversation[]> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseListConversations(businessId);
  }

  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM conversations WHERE business_id = ? ORDER BY started_at DESC LIMIT 50")
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

export async function recordConversation(conv: Conversation): Promise<void> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseRecordConversation(conv);
  }

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

  if (mode === "dual") {
    supabaseRecordConversation(conv).catch(() => {});
  }
}

export async function getActiveVerifiedEmail(businessId: string): Promise<string | null> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseGetActiveVerifiedEmail(businessId);
  }

  const db = getDb();
  const key = `active_email:${businessId}`;
  const row = db.prepare("SELECT value FROM session_store WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export async function setActiveVerifiedEmail(businessId: string, email: string): Promise<void> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseSetActiveVerifiedEmail(businessId, email);
  }

  const db = getDb();
  const key = `active_email:${businessId}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO session_store (key, value, updated_at)
    VALUES (?, ?, ?)
  `).run(key, email, now);
}

export async function clearActiveVerifiedEmail(businessId: string): Promise<void> {
  const mode = getDbMode();
  if (mode === "supabase") {
    return await supabaseClearActiveVerifiedEmail(businessId);
  }

  const db = getDb();
  db.prepare("DELETE FROM session_store WHERE key = ?").run(`active_email:${businessId}`);
  db.prepare("DELETE FROM session_store WHERE key = ?").run("active_email:default");
}
