import { createClient, SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { Owner, Business, Service, Booking, Conversation } from "./db";

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  if (!url || !key) return null;

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

// In-memory fallback for session store (verified emails)
const memorySessionStore = new Map<string, string>();

// ---------------------------------------------------------------------------
// OWNERS
// ---------------------------------------------------------------------------
export async function supabaseGetOrCreateOwner(
  email: string,
  name?: string
): Promise<Owner> {
  const client = getSupabase();
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();

  if (!client) {
    return {
      id: normalized === "demo@omnidesk.ai" ? "owner_demo" : `owner_${Date.now()}`,
      email: normalized,
      name: name || normalized.split("@")[0] || "OmniDesk Operator",
      created_at: now,
    };
  }

  try {
    const { data: existing, error: selectErr } = await client
      .from("owners")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();

    if (selectErr) {
      console.warn("[Supabase] select owner error:", selectErr.message);
    }

    if (existing) {
      if (name && existing.name !== name) {
        await client.from("owners").update({ name }).eq("id", existing.id);
        existing.name = name;
      }
      return existing as Owner;
    }

    const id =
      normalized === "demo@omnidesk.ai"
        ? "owner_demo"
        : `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ownerName = name || email.split("@")[0] || "OmniDesk Operator";

    const newOwner: Owner = { id, email: normalized, name: ownerName, created_at: now };
    const { error: insertErr } = await client.from("owners").insert(newOwner);
    if (insertErr) {
      console.warn("[Supabase] insert owner error:", insertErr.message);
    }
    return newOwner;
  } catch (err: any) {
    console.error("[Supabase] getOrCreateOwner failed:", err);
    return {
      id: normalized === "demo@omnidesk.ai" ? "owner_demo" : `owner_${Date.now()}`,
      email: normalized,
      name: name || "OmniDesk Operator",
      created_at: now,
    };
  }
}

// ---------------------------------------------------------------------------
// PASSWORD AUTH - Sign Up
// ---------------------------------------------------------------------------
export async function supabaseSignUpOwner(
  email: string,
  password: string,
  name?: string
): Promise<Owner | null> {
  const client = getSupabase();
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();

  if (!client) return null;

  try {
    // Check if already exists
    const { data: existing } = await client
      .from("owners")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    if (existing) return null; // email taken

    const id = `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ownerName = name || normalized.split("@")[0] || "OmniDesk Operator";
    const hash = await bcrypt.hash(password, 10);

    const newOwner = { id, email: normalized, name: ownerName, password_hash: hash, created_at: now };
    const { error } = await client.from("owners").insert(newOwner);
    if (error) {
      console.warn("[Supabase] signUpOwner insert error:", error.message);
      return null;
    }
    return { id, email: normalized, name: ownerName, created_at: now };
  } catch (err: any) {
    console.error("[Supabase] signUpOwner failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// PASSWORD AUTH - Sign In
// ---------------------------------------------------------------------------
export async function supabaseSignInOwner(
  email: string,
  password: string
): Promise<Owner | null> {
  const client = getSupabase();
  const normalized = email.trim().toLowerCase();

  if (!client) return null;

  try {
    const { data: owner, error } = await client
      .from("owners")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();

    if (error || !owner) return null;

    // Legacy / demo accounts with no password_hash — allow sign-in
    if (!owner.password_hash) {
      const { password_hash, ...safe } = owner;
      return safe as Owner;
    }

    const valid = await bcrypt.compare(password, owner.password_hash);
    if (!valid) return null;

    const { password_hash, ...safe } = owner;
    return safe as Owner;
  } catch (err: any) {
    console.error("[Supabase] signInOwner failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// BUSINESSES
// ---------------------------------------------------------------------------
export async function supabaseListBusinesses(ownerId = "owner_demo"): Promise<Business[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data: businesses, error: bizErr } = await client
      .from("businesses")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (bizErr || !businesses) {
      console.warn("[Supabase] listBusinesses error:", bizErr?.message);
      return [];
    }

    // Fetch services for all returned businesses
    const bizIds = businesses.map((b) => b.id);
    let servicesByBiz: Record<string, Service[]> = {};

    if (bizIds.length > 0) {
      const { data: services, error: srvErr } = await client
        .from("services")
        .select("*")
        .in("business_id", bizIds)
        .order("price", { ascending: true });

      if (!srvErr && services) {
        for (const s of services) {
          if (!servicesByBiz[s.business_id]) servicesByBiz[s.business_id] = [];
          servicesByBiz[s.business_id].push(s);
        }
      }
    }

    return businesses.map((b) => ({
      ...b,
      keyterms: Array.isArray(b.keyterms) ? b.keyterms : JSON.parse(b.keyterms || "[]"),
      services: servicesByBiz[b.id] || [],
    }));
  } catch (err: any) {
    console.error("[Supabase] listBusinesses exception:", err);
    return [];
  }
}

export async function supabaseGetBusiness(businessId: string): Promise<Business | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: biz, error: bizErr } = await client
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr || !biz) {
      return null;
    }

    const { data: services } = await client
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .order("price", { ascending: true });

    return {
      ...biz,
      keyterms: Array.isArray(biz.keyterms) ? biz.keyterms : JSON.parse(biz.keyterms || "[]"),
      services: services || [],
    };
  } catch (err: any) {
    console.error("[Supabase] getBusiness exception:", err);
    return null;
  }
}

export async function supabaseCreateBusiness(data: {
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
  const client = getSupabase();
  const now = new Date().toISOString();
  const ownerId = data.owner_id || "owner_demo";

  // Ensure owner exists first
  if (client) {
    await client.from("owners").upsert({
      id: ownerId,
      email: ownerId === "owner_demo" ? "demo@omnidesk.ai" : `${ownerId}@omnidesk.ai`,
      name: "OmniDesk Operator",
      created_at: now,
    });
  }

  const bizRecord = {
    id: data.id,
    owner_id: ownerId,
    name: data.name,
    industry: data.industry || "salon",
    tone: data.tone || "warm",
    greeting: data.greeting || "Hello! How can I assist you today?",
    system_prompt: data.system_prompt || "You are a professional voice receptionist.",
    voice_id: data.voice_id || "alba",
    slot_minutes: data.slot_minutes || 30,
    open_hour: data.open_hour || 9,
    close_hour: data.close_hour || 17,
    operating_days: data.operating_days || "mon-fri",
    keyterms: data.keyterms || [],
    assemblyai_agent_id: (data as any).assemblyai_agent_id || null,
    created_at: now,
    updated_at: now,
  };

  if (client) {
    const { error: bizErr } = await client.from("businesses").upsert(bizRecord);
    if (bizErr) {
      console.error("[Supabase] createBusiness error:", bizErr.message);
    }

    if (data.services && data.services.length > 0) {
      const srvRows = data.services.map((s) => ({
        business_id: data.id,
        key: s.key,
        label: s.label,
        minutes: s.minutes || 30,
        price: s.price || 0,
        description: s.description || "",
      }));

      const { error: srvErr } = await client.from("services").upsert(srvRows, {
        onConflict: "business_id,key",
      });
      if (srvErr) {
        console.error("[Supabase] createBusiness services error:", srvErr.message);
      }
    }
  }

  return {
    ...bizRecord,
    services: data.services || [],
  };
}

export async function supabaseUpdateBusiness(
  businessId: string,
  patch: Partial<Business> & { services?: Service[] }
): Promise<Business | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const now = new Date().toISOString();
    const updateData: any = { updated_at: now };

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
        updateData[col] = patch[col];
      }
    }

    if (patch.keyterms !== undefined) {
      updateData.keyterms = patch.keyterms;
    }

    const { error: updateErr } = await client
      .from("businesses")
      .update(updateData)
      .eq("id", businessId);

    if (updateErr) {
      console.error("[Supabase] updateBusiness error:", updateErr.message);
    }

    if (patch.services && Array.isArray(patch.services)) {
      if (patch.services.length > 0) {
        const srvRows = patch.services.map((s) => ({
          business_id: businessId,
          key: s.key,
          label: s.label,
          minutes: s.minutes || 30,
          price: s.price || 0,
          description: s.description || "",
        }));

        const { error: srvErr } = await client
          .from("services")
          .upsert(srvRows, { onConflict: "business_id,key" });
        if (srvErr) {
          console.error("[Supabase] updateBusiness services upsert error:", srvErr.message);
        }

        // Clean up any removed services
        const currentKeys = patch.services.map((s) => s.key);
        const { data: existingSrvs } = await client
          .from("services")
          .select("id, key")
          .eq("business_id", businessId);

        if (existingSrvs) {
          const toDelete = existingSrvs
            .filter((s) => !currentKeys.includes(s.key))
            .map((s) => s.id);
          if (toDelete.length > 0) {
            await client.from("services").delete().in("id", toDelete);
          }
        }
      } else {
        await client.from("services").delete().eq("business_id", businessId);
      }
    }

    return await supabaseGetBusiness(businessId);
  } catch (err: any) {
    console.error("[Supabase] updateBusiness exception:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// BOOKINGS
// ---------------------------------------------------------------------------
export async function supabaseListBookings(businessId: string): Promise<Booking[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("bookings")
      .select("*")
      .eq("business_id", businessId)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });

    if (error) {
      console.warn("[Supabase] listBookings error:", error.message);
      return [];
    }
    return (data as Booking[]) || [];
  } catch (err: any) {
    console.error("[Supabase] listBookings exception:", err);
    return [];
  }
}

export async function supabaseGetBookingByCode(code: string): Promise<Booking | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("bookings")
      .select("*")
      .eq("confirmation_code", code)
      .maybeSingle();

    if (error) return null;
    return (data as Booking) || null;
  } catch {
    return null;
  }
}

export async function supabaseCreateBookingRecord(data: {
  business_id: string;
  service_key: string;
  service_label: string;
  appt_date: string;
  appt_time: string;
  name: string;
  email: string;
  price: number;
}): Promise<Booking> {
  const client = getSupabase();
  const now = new Date().toISOString();

  // Generate 6-char alphanumeric confirmation code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const record: any = {
    business_id: data.business_id,
    confirmation_code: code,
    service_key: data.service_key,
    service_label: data.service_label,
    appointment_date: data.appt_date,
    appointment_time: data.appt_time,
    customer_name: data.name,
    customer_email: data.email,
    price: data.price,
    status: "confirmed",
    confirmation_sent: 0,
    created_at: now,
  };

  if (client) {
    let nextId: number | undefined;
    try {
      const { data: topRows } = await client
        .from("bookings")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      if (topRows && topRows.length > 0 && typeof topRows[0].id === "number") {
        nextId = topRows[0].id + 1;
      }
    } catch {}

    const payload = nextId ? { id: nextId, ...record } : record;

    const { data: inserted, error } = await client
      .from("bookings")
      .insert(payload)
      .select("*")
      .single();

    if (!error && inserted) {
      return inserted as Booking;
    }
    console.warn("[Supabase] createBooking error:", error?.message);
  }

  return {
    id: Date.now(),
    ...record,
  };
}

export async function supabaseMarkBookingConfirmationSent(code: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    await client
      .from("bookings")
      .update({ confirmation_sent: 1 })
      .eq("confirmation_code", code);
  } catch (err: any) {
    console.warn("[Supabase] markBookingConfirmationSent error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// CONVERSATIONS
// ---------------------------------------------------------------------------
export async function supabaseListConversations(businessId: string): Promise<Conversation[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("conversations")
      .select("*")
      .eq("business_id", businessId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[Supabase] listConversations error:", error.message);
      return [];
    }

    return (data || []).map((r: any) => ({
      ...r,
      transcript: Array.isArray(r.transcript) ? r.transcript : JSON.parse(r.transcript || "[]"),
      tool_calls: Array.isArray(r.tool_calls) ? r.tool_calls : JSON.parse(r.tool_calls || "[]"),
    }));
  } catch (err: any) {
    console.error("[Supabase] listConversations exception:", err);
    return [];
  }
}

export async function supabaseRecordConversation(conv: Conversation): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    const payload = {
      id: conv.id,
      business_id: conv.business_id,
      caller_name: conv.caller_name || null,
      caller_email: conv.caller_email || null,
      started_at: conv.started_at,
      ended_at: conv.ended_at || null,
      duration_seconds: conv.duration_seconds || 0,
      status: conv.status || "completed",
      outcome: conv.outcome || "inquiry",
      transcript: conv.transcript || [],
      tool_calls: conv.tool_calls || [],
    };

    const { error } = await client.from("conversations").upsert(payload);
    if (error) {
      console.warn("[Supabase] recordConversation error:", error.message);
    }
  } catch (err: any) {
    console.error("[Supabase] recordConversation exception:", err);
  }
}

// ---------------------------------------------------------------------------
// SESSION STORE (Verified Emails)
// ---------------------------------------------------------------------------
export async function supabaseGetActiveVerifiedEmail(businessId: string): Promise<string | null> {
  return memorySessionStore.get(`active_email:${businessId}`) || memorySessionStore.get("active_email:default") || null;
}

export async function supabaseSetActiveVerifiedEmail(businessId: string, email: string): Promise<void> {
  memorySessionStore.set(`active_email:${businessId}`, email);
  memorySessionStore.set("active_email:default", email);
}

export async function supabaseClearActiveVerifiedEmail(businessId: string): Promise<void> {
  memorySessionStore.delete(`active_email:${businessId}`);
  memorySessionStore.delete("active_email:default");
}
