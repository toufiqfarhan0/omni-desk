/**
 * In-memory booking store matching legacy store.py.
 * Dual DB Layer: Works alongside persistent SQLite database (src/lib/db.ts).
 */

export interface Appointment {
  confirmation_code: string;
  service: string;
  service_label: string;
  date: string;
  time: string;
  customer_name: string;
  email: string;
  confirmation_sent: boolean;
  price: number;
  created_at: string;
}

export interface ToolEvent {
  seq: number;
  tool: string;
  arguments: any;
  result: any;
  at: string;
}

export const SERVICES: Record<
  string,
  { label: string; minutes: number; price: number; description: string }
> = {
  haircut: {
    label: "Signature Haircut & Styling",
    minutes: 45,
    price: 85,
    description:
      "Custom consultation, precision shear or razor cut, wash, and luxury blowout.",
  },
  coloring: {
    label: "Full Color & Gloss",
    minutes: 90,
    price: 185,
    description:
      "All-over single process coloring, custom formulation, nourishing gloss, and blowout.",
  },
  balayage: {
    label: "Artisan Balayage & Highlights",
    minutes: 120,
    price: 280,
    description:
      "Hand-painted dimensional highlights, toner formulation, deep conditioning mask, and style.",
  },
  blowout: {
    label: "Signature Blowout & Treatment",
    minutes: 45,
    price: 65,
    description:
      "Revitalizing scalp massage, clarifying shampoo, hydrating mask, and voluminous blowout styling.",
  },
};

interface StoreState {
  appointments: Record<string, Appointment>;
  taken: Set<string>; // "YYYY-MM-DD|HH:MM"
  events: ToolEvent[];
  openHour: number;
  closeHour: number;
  slotMinutes: number;
  services: typeof SERVICES;
}

function getSlotsForDay(openH = 9, closeH = 17, step = 30): string[] {
  const slots: string[] = [];
  let cur = openH * 60;
  const end = closeH * 60;
  while (cur < end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    cur += step;
  }
  return slots;
}

function generateConfirmationCode(state: StoreState): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  while (true) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!state.appointments[code]) {
      return code;
    }
  }
}

function pseudoRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function initStoreState(): StoreState {
  const state: StoreState = {
    appointments: {},
    taken: new Set<string>(),
    events: [],
    openHour: 9,
    closeHour: 17,
    slotMinutes: 30,
    services: { ...SERVICES },
  };

  const rng = pseudoRandom(20260901);
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  // Scatter 45% over 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    const dayOfWeek = d.getDay(); // 0 Sun, 6 Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const slots = getSlotsForDay(state.openHour, state.closeHour, state.slotMinutes);
    for (const slot of slots) {
      if (rng() < 0.45) {
        state.taken.add(`${iso}|${slot}`);
      }
    }
  }

  // 4 seed appointments for owner dashboard
  const seedData = [
    {
      service: "haircut",
      offset: 0,
      timeStr: "10:00",
      name: "Eleanor Vance",
      email: "eleanor.vance@gmail.com",
      confirmed: true,
    },
    {
      service: "blowout",
      offset: 0,
      timeStr: "14:30",
      name: "Marcus Sterling",
      email: "marcus.sterling@gmail.com",
      confirmed: true,
    },
    {
      service: "coloring",
      offset: 1,
      timeStr: "11:00",
      name: "Sophia Al-Mansoor",
      email: "sophia.mansoor@gmail.com",
      confirmed: false,
    },
    {
      service: "balayage",
      offset: 2,
      timeStr: "09:30",
      name: "James Thornton",
      email: "james.thornton@gmail.com",
      confirmed: true,
    },
  ];

  for (const item of seedData) {
    const d = new Date(today);
    d.setDate(today.getDate() + item.offset);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const code = generateConfirmationCode(state);
    state.taken.add(`${iso}|${item.timeStr}`);
    const srv = state.services[item.service] || SERVICES[item.service];
    state.appointments[code] = {
      confirmation_code: code,
      service: item.service,
      service_label: srv?.label || item.service,
      date: iso,
      time: item.timeStr,
      customer_name: item.name,
      email: item.email,
      confirmation_sent: item.confirmed,
      price: srv?.price || 85,
      created_at: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
  }

  return state;
}

// Attach to globalThis so state persists across Next.js dev server hot reloads
const globalStore = (globalThis as any).__omnidesk_store || initStoreState();
if (process.env.NODE_ENV !== "production") {
  (globalThis as any).__omnidesk_store = globalStore;
}

export const store = {
  get state(): StoreState {
    return globalStore;
  },

  isOpen(dateStr: string): boolean {
    const d = new Date(dateStr + "T00:00:00Z");
    const day = d.getUTCDay();
    return day >= 1 && day <= 5;
  },

  availableSlots(dateStr: string, limit = 4): string[] {
    if (!this.isOpen(dateStr)) return [];
    const all = getSlotsForDay(
      globalStore.openHour,
      globalStore.closeHour,
      globalStore.slotMinutes
    );
    const free = all.filter((s) => !globalStore.taken.has(`${dateStr}|${s}`));
    return free.slice(0, limit);
  },

  isSlotTaken(dateStr: string, timeStr: string): boolean {
    return globalStore.taken.has(`${dateStr}|${timeStr}`);
  },

  nextOpenDays(afterDateStr: string, count = 2): string[] {
    const found: string[] = [];
    const cur = new Date(afterDateStr + "T00:00:00Z");
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    for (let i = 0; i < 14 && found.length < count; i++) {
      cur.setUTCDate(cur.getUTCDate() + 1);
      const iso = `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(
        cur.getUTCDate()
      )}`;
      if (this.isOpen(iso) && this.availableSlots(iso, 1).length > 0) {
        found.push(iso);
      }
    }
    return found;
  },

  book(
    service: string,
    dateStr: string,
    timeStr: string,
    name: string,
    email: string
  ): Appointment {
    const key = `${dateStr}|${timeStr}`;
    if (globalStore.taken.has(key)) {
      throw new Error(`${timeStr} on ${dateStr} is already booked`);
    }
    globalStore.taken.add(key);
    const code = generateConfirmationCode(globalStore);
    const srv = globalStore.services[service] || SERVICES[service];
    const record: Appointment = {
      confirmation_code: code,
      service,
      service_label: srv?.label || service,
      date: dateStr,
      time: timeStr,
      customer_name: name,
      email,
      confirmation_sent: false,
      price: srv?.price ?? 120,
      created_at: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
    globalStore.appointments[code] = record;
    return record;
  },

  get(code: string): Appointment | undefined {
    return globalStore.appointments[code.trim()];
  },

  markConfirmationSent(code: string): Appointment | undefined {
    const record = globalStore.appointments[code.trim()];
    if (record) {
      record.confirmation_sent = true;
    }
    return record;
  },

  getAllAppointments(): Appointment[] {
    return Object.values(globalStore.appointments);
  },

  logEvent(path: string, requestBody: any, responseBody: any): void {
    const toolName = path.split("/").filter(Boolean).pop() || "unknown";
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const event: ToolEvent = {
      seq: globalStore.events.length + 1,
      tool: toolName,
      arguments: requestBody && typeof requestBody === "object" ? requestBody : {},
      result: responseBody && typeof responseBody === "object" ? responseBody : {},
      at: timeStr,
    };
    globalStore.events.push(event);
  },

  eventsSince(cursor: number): ToolEvent[] {
    return globalStore.events.filter((e: ToolEvent) => e.seq > cursor);
  },
};
