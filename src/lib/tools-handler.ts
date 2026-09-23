import {
  getBusiness,
  createBookingRecord,
  getBookingByCode,
  listBookings,
  markBookingConfirmationSent,
  Business,
  Booking,
} from "./db";
import { store } from "./store";
import { validateAndVerifyEmail, normalizeEmail } from "./email-verify";
import {
  sendCalendarConfirmation,
  sendResendConfirmation,
  formatDaySpoken,
  formatTimeSpoken,
} from "./calendar";

function isBusinessOpenOnDate(biz: Business, dateObj: Date): boolean {
  const opDays = biz.operating_days || "mon-fri";
  const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 6 is Saturday

  if (opDays === "all-week") return true;
  if (opDays === "mon-sat") return dayOfWeek >= 1 && dayOfWeek <= 6;
  if (opDays === "tue-sat") return dayOfWeek >= 2 && dayOfWeek <= 6;
  if (opDays === "thu-sun")
    return dayOfWeek === 0 || (dayOfWeek >= 4 && dayOfWeek <= 6);
  // Default mon-fri
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

function getAllBusinessSlots(biz: Business): string[] {
  const openHour = biz.open_hour ?? 9;
  const closeHour = biz.close_hour ?? 17;
  const slotMinutes = biz.slot_minutes ?? 30;

  const slots: string[] = [];
  let currentMinutes = openHour * 60;
  const endMinutes = closeHour * 60;

  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    currentMinutes += slotMinutes;
  }
  return slots;
}

export async function getAvailableSlots(
  biz: Business,
  dateStr: string,
  passedBookings?: Booking[]
): Promise<string[]> {
  const dateObj = new Date(dateStr + "T00:00:00Z");
  if (!isBusinessOpenOnDate(biz, dateObj)) {
    return [];
  }

  const allSlots = getAllBusinessSlots(biz);
  const bookings = passedBookings || (await listBookings(biz.id));
  const takenTimes = new Set(
    bookings
      .filter((b) => b.appointment_date === dateStr && b.status !== "cancelled")
      .map((b) => b.appointment_time)
  );

  if (biz.id === "biz_demo_dental") {
    for (const slot of allSlots) {
      if (store.isSlotTaken(dateStr, slot)) {
        takenTimes.add(slot);
      }
    }
  }

  return allSlots.filter((slot) => !takenTimes.has(slot));
}

async function getNextOpenDays(biz: Business, startDate: Date, count = 3): Promise<Date[]> {
  const openDays: Date[] = [];
  const cur = new Date(startDate);
  const bookings = await listBookings(biz.id);

  for (let i = 1; i <= 14 && openDays.length < count; i++) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (isBusinessOpenOnDate(biz, cur)) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const dStr = `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(
        cur.getUTCDate()
      )}`;
      const slots = await getAvailableSlots(biz, dStr, bookings);
      if (slots.length > 0) {
        openDays.push(new Date(cur));
      }
    }
  }
  return openDays;
}

function formatSlotsSpoken(slots: string[]): string {
  if (!slots.length) return "no times";
  const spoken = slots.slice(0, 4).map(formatTimeSpoken);
  if (spoken.length === 1) return spoken[0];
  return `${spoken.slice(0, -1).join(", ")} or ${spoken[spoken.length - 1]}`;
}

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const WORD_NUMBERS: [string, number][] = [
  ["twenty first", 21], ["twenty-first", 21],
  ["twenty second", 22], ["twenty-second", 22],
  ["twenty third", 23], ["twenty-third", 23],
  ["twenty fourth", 24], ["twenty-fourth", 24],
  ["twenty fifth", 25], ["twenty-fifth", 25],
  ["twenty sixth", 26], ["twenty-sixth", 26],
  ["twenty seventh", 27], ["twenty-seventh", 27],
  ["twenty eighth", 28], ["twenty-eighth", 28],
  ["twenty ninth", 29], ["twenty-ninth", 29],
  ["thirty first", 31], ["thirty-first", 31],
  ["thirtieth", 30], ["thirty", 30],
  ["twentieth", 20], ["twenty", 20],
  ["nineteenth", 19], ["nineteen", 19],
  ["eighteenth", 18], ["eighteen", 18],
  ["seventeenth", 17], ["seventeen", 17],
  ["sixteenth", 16], ["sixteen", 16],
  ["fifteenth", 15], ["fifteen", 15],
  ["fourteenth", 14], ["fourteen", 14],
  ["thirteenth", 13], ["thirteen", 13],
  ["twelfth", 12], ["twelve", 12],
  ["eleventh", 11], ["eleven", 11],
  ["tenth", 10], ["ten", 10],
  ["ninth", 9], ["nine", 9],
  ["eighth", 8], ["eight", 8],
  ["seventh", 7], ["seven", 7],
  ["sixth", 6], ["six", 6],
  ["fifth", 5], ["five", 5],
  ["fourth", 4], ["four", 4],
  ["third", 3], ["three", 3],
  ["second", 2], ["two", 2],
  ["first", 1], ["one", 1],
];

export function normalizeDate(input?: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const currentYear = now.getFullYear();

  if (!input || !input.trim()) {
    return `${currentYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const raw = input.trim();

  // 1. Direct YYYY-MM-DD match anywhere in the string
  const isoMatch = raw.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 1b. MM/DD/YYYY or DD-MM-YYYY
  const mdyMatch = raw.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${pad(parseInt(mdyMatch[1], 10))}-${pad(parseInt(mdyMatch[2], 10))}`;
  }

  const lower = raw.toLowerCase().replace(/[,\.]/g, " ").replace(/\s+/g, " ").trim();

  // 2. Relative keywords
  if (lower === "today" || lower === "now") {
    return `${currentYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  if (lower === "tomorrow" || lower.startsWith("tomorrow")) {
    const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
  }

  if (lower.includes("day after tomorrow") || lower.includes("overmorrow")) {
    const dat = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return `${dat.getFullYear()}-${pad(dat.getMonth() + 1)}-${pad(dat.getDate())}`;
  }

  // 3. Month & day spoken or written (e.g. "September 24", "September 24th", "Sep 24", "September twenty fourth")
  for (const [mName, mIdx] of Object.entries(MONTH_MAP)) {
    if (lower.includes(mName)) {
      let dayNum: number | null = null;
      let yearNum = currentYear;

      const yMatch = lower.match(/\b(20\d{2})\b/);
      if (yMatch) yearNum = parseInt(yMatch[1], 10);

      // Check word numbers
      for (const [wWord, wVal] of WORD_NUMBERS) {
        if (lower.includes(wWord)) {
          dayNum = wVal;
          break;
        }
      }

      // Check digits like "24" or "24th"
      if (!dayNum) {
        const dMatch = lower.match(/\b([1-9]|[12]\d|3[01])(st|nd|rd|th)?\b/);
        if (dMatch) {
          dayNum = parseInt(dMatch[1], 10);
        }
      }

      if (dayNum) {
        const target = new Date(yearNum, mIdx, dayNum);
        if (!yMatch && target.getTime() < now.getTime() - 24 * 60 * 60 * 1000 && target.getMonth() < now.getMonth()) {
          target.setFullYear(currentYear + 1);
        }
        return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
      }
    }
  }

  // 4. Day of the week (e.g. "Thursday", "this Thursday", "next Friday", "Friday at 2 PM")
  for (const [dName, dIdx] of Object.entries(DAY_OF_WEEK_MAP)) {
    if (lower.includes(dName)) {
      const isNext = lower.includes("next");
      const currentDay = now.getDay();
      let diff = dIdx - currentDay;
      if (diff <= 0) {
        diff += 7;
      }
      if (isNext && diff < 7) {
        diff += 7;
      }
      const target = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    }
  }

  // 5. Standard Date.parse fallback
  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Fallback to today
  return `${currentYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function normalizeTime(input?: string): string | null {
  if (!input || !input.trim()) return null;
  const raw = input.trim().toLowerCase().replace(/\s+/g, " ");

  // 1. Direct 24h format HH:MM (e.g. "13:00", "09:30", "14:00")
  const hhmm = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmm) {
    const isPm = raw.includes("pm") && !raw.includes("am");
    let h = parseInt(hhmm[1], 10);
    if (isPm && h < 12) h += 12;
    if (raw.includes("am") && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${hhmm[2]}`;
  }

  // 2. 12-hour format with AM/PM (e.g. "1:00 PM", "1pm", "1:30 pm", "10am", "2 PM")
  const ampm = raw.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    const min = ampm[2] || "00";
    const isPm = ampm[3].toLowerCase() === "pm";
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${min}`;
  }

  // 3. Spoken time with words like "one pm", "two in the afternoon"
  const spokenWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  };

  const hasTimeContext =
    raw.includes("pm") ||
    raw.includes("am") ||
    raw.includes("o'clock") ||
    raw.includes("afternoon") ||
    raw.includes("morning") ||
    raw.includes("evening") ||
    raw.includes("noon");

  if (hasTimeContext) {
    for (const [w, h] of Object.entries(spokenWords)) {
      const wRegex = new RegExp(`\\b${w}\\b`);
      if (wRegex.test(raw)) {
        const isPm =
          raw.includes("pm") ||
          raw.includes("afternoon") ||
          raw.includes("evening") ||
          raw.includes("night");
        let hour = h;
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
        return `${String(hour).padStart(2, "0")}:00`;
      }
    }
  }

  if (raw.includes("noon")) return "12:00";

  return null;
}

export function findMatchingService(services: any[] = [], input?: string): any {
  if (!services || services.length === 0) return undefined;
  if (!input || !input.trim()) return services[0];

  const raw = input.trim().toLowerCase().replace(/&/g, "and");
  const words = raw.split(/\s+/).filter(Boolean);

  // 1. Exact match on key or label
  for (const s of services) {
    const sKey = (s.key || "").toLowerCase().replace(/&/g, "and");
    const sLabel = (s.label || "").toLowerCase().replace(/&/g, "and");
    if (sKey === raw || sLabel === raw) return s;
  }

  // 2. Substring match
  for (const s of services) {
    const sKey = (s.key || "").toLowerCase().replace(/&/g, "and");
    const sLabel = (s.label || "").toLowerCase().replace(/&/g, "and");
    if (sKey.includes(raw) || raw.includes(sKey) || sLabel.includes(raw) || raw.includes(sLabel)) {
      return s;
    }
  }

  // 3. Word match (at least 3 chars)
  for (const s of services) {
    const sKey = (s.key || "").toLowerCase().replace(/&/g, "and");
    const sLabel = (s.label || "").toLowerCase().replace(/&/g, "and");
    for (const w of words) {
      if (w.length >= 3 && (sKey.includes(w) || sLabel.includes(w))) {
        return s;
      }
    }
  }

  // Fallback to first available service
  return services[0];
}

export async function executeTool(
  toolName: string,
  businessId: string,
  args: any = {}
): Promise<any> {
  const bizId = businessId || "biz_demo_dental";
  let biz = await getBusiness(bizId);
  if (!biz) {
    biz = await getBusiness("biz_demo_dental");
  }
  if (!biz) {
    return { ok: false, message: "Business tenant not found" };
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;

  switch (toolName) {
    case "get_today": {
      const todayDate = new Date(todayStr + "T00:00:00Z");
      const tomorrow = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}`;
      const nextDays = await getNextOpenDays(biz, todayDate, 3);
      const weekday = todayDate.toLocaleDateString("en-US", { weekday: "long" });
      const tomorrowWeekday = tomorrow.toLocaleDateString("en-US", { weekday: "long" });

      return {
        ok: true,
        business: biz.name,
        today: todayStr,
        weekday,
        tomorrow: tomorrowStr,
        tomorrow_weekday: tomorrowWeekday,
        next_open_days: nextDays.map((d) => ({
          date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
          weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
        })),
        message: `Today is ${formatDaySpoken(todayStr)}. Tomorrow is ${formatDaySpoken(tomorrowStr)}.`,
      };
    }

    case "get_services_and_pricing": {
      const services = biz.services || [];
      const pricingList = services.map(
        (s) =>
          `${s.label} ($${s.price}, ${s.minutes} mins): ${s.description || ""}`
      );
      return {
        ok: true,
        business: biz.name,
        services,
        message: `Our available services and pricing are: ${pricingList.join(
          "; "
        )}.`,
      };
    }

    case "verify_customer_email": {
      const email = (args.email || "").trim();
      const lower = email.toLowerCase();
      if (
        !lower ||
        lower.includes("example.com") ||
        lower.includes("test.com") ||
        lower.includes("sample.com")
      ) {
        return {
          ok: false,
          valid: false,
          reason: "example_domain",
          message:
            "Placeholder or example emails (@example.com) are strictly prohibited. Please ask the caller for their real, deliverable email address.",
        };
      }
      const res = await validateAndVerifyEmail(email, biz.id);
      if (res.ok && res.valid) {
        return {
          ok: true,
          valid: true,
          email: res.email,
          auto_corrected: res.auto_corrected,
          message: `Email verified: ${res.email}. Please confirm this with the caller.`,
        };
      }
      return {
        ok: false,
        valid: false,
        reason: res.reason || "bad_email",
        message: `${res.message}. Please ask the caller to clarify or provide their correct email address.`,
      };
    }

    case "check_availability": {
      const rawDate = args.date || args.day || args.appointment_date || "";
      const dateStr = normalizeDate(rawDate);
      const rawTime = args.time || args.slot || args.appointment_time || "";
      const requestedTime = normalizeTime(rawTime);
      const matchedService = findMatchingService(biz.services || [], args.service);

      const reqDate = new Date(dateStr + "T00:00:00Z");
      if (!isBusinessOpenOnDate(biz, reqDate)) {
        const nextDays = await getNextOpenDays(biz, reqDate, 1);
        const nextD = nextDays[0];
        let altMsg = `We are closed on ${formatDaySpoken(dateStr)}.`;
        if (nextD) {
          const nextDStr = `${nextD.getUTCFullYear()}-${pad(nextD.getUTCMonth() + 1)}-${pad(nextD.getUTCDate())}`;
          const nextSlots = await getAvailableSlots(biz, nextDStr);
          altMsg = `We are closed on ${formatDaySpoken(dateStr)}. Our next open day is ${formatDaySpoken(nextDStr)}, with open times at ${formatSlotsSpoken(nextSlots)}.`;
        }
        return {
          ok: true,
          is_closed: true,
          date: dateStr,
          message: altMsg,
        };
      }

      const slots = await getAvailableSlots(biz, dateStr);
      const serviceLabel = matchedService?.label || "Signature Haircut & Styling";
      const price = matchedService?.price ?? 85;
      const minutes = matchedService?.minutes ?? 45;

      if (requestedTime) {
        const isAvail = slots.includes(requestedTime);
        if (isAvail) {
          return {
            ok: true,
            date: dateStr,
            time: requestedTime,
            is_available: true,
            service: serviceLabel,
            price,
            duration_minutes: minutes,
            slots,
            message: `Yes! ${formatTimeSpoken(requestedTime)} on ${formatDaySpoken(dateStr)} is open and available for ${serviceLabel} ($${price}, ${minutes} mins). Would you like me to book this for you?`,
          };
        } else {
          const altSlots = slots.length > 0
            ? ` We do have open times on that day at ${formatSlotsSpoken(slots)}.`
            : " We have no other openings on that day.";
          return {
            ok: true,
            date: dateStr,
            requested_time: requestedTime,
            is_available: false,
            service: serviceLabel,
            price,
            duration_minutes: minutes,
            slots: slots.slice(0, 5),
            message: `${formatTimeSpoken(requestedTime)} on ${formatDaySpoken(dateStr)} is not available.${altSlots} Would one of those work for you?`,
          };
        }
      }

      if (slots.length > 0) {
        return {
          ok: true,
          date: dateStr,
          service: serviceLabel,
          price,
          duration_minutes: minutes,
          slots: slots.slice(0, 5),
          message: `On ${formatDaySpoken(dateStr)} for ${serviceLabel} ($${price}, ${minutes} mins), we have open times at ${formatSlotsSpoken(slots)}. What time works best for you?`,
        };
      }

      const nextDays = await getNextOpenDays(biz, reqDate, 1);
      const nextD = nextDays[0];
      let altMsg = `We are fully booked on ${formatDaySpoken(dateStr)}.`;
      if (nextD) {
        const nextDStr = `${nextD.getUTCFullYear()}-${pad(nextD.getUTCMonth() + 1)}-${pad(nextD.getUTCDate())}`;
        const nextSlots = await getAvailableSlots(biz, nextDStr);
        altMsg = `${formatDaySpoken(dateStr)} is fully booked for ${serviceLabel}. Our next opening is ${formatDaySpoken(nextDStr)} at ${formatSlotsSpoken(nextSlots)}.`;
      }

      return {
        ok: true,
        is_full: true,
        date: dateStr,
        service: serviceLabel,
        message: altMsg,
      };
    }

    case "book_appointment": {
      const rawDate = args.date || args.day || args.appointment_date || "";
      const dateStr = normalizeDate(rawDate);
      const rawTime = args.time || args.slot || args.appointment_time || "";
      const timeStr = normalizeTime(rawTime) || rawTime.trim();
      let customerName = (args.customer_name || args.name || "").trim();
      customerName = customerName
        .replace(/^(my name is|this is|i am|it's|it is)\s+/i, "")
        .trim();
      const rawEmail = (args.email || "").trim();
      const lowerEmail = rawEmail.toLowerCase();
      const lowerName = customerName.toLowerCase();

      // STRICT CHECK: Reject placeholder / dummy / missing caller names
      const isDummyName =
        !customerName ||
        lowerName === "john doe" ||
        lowerName === "jane doe" ||
        lowerName === "john" ||
        lowerName === "jane" ||
        lowerName === "unknown" ||
        lowerName === "caller" ||
        lowerName === "valued client" ||
        lowerName === "test" ||
        lowerName === "user" ||
        lowerName === "client" ||
        lowerName === "none" ||
        lowerName === "null";

      if (isDummyName) {
        return {
          ok: false,
          reason: "missing_caller_name",
          message:
            "CRITICAL: Caller's name has NOT been provided yet! You are strictly forbidden from booking with dummy names like 'John Doe'. Please ask the caller: 'May I please have your full name for the booking reservation?' and wait for their answer.",
        };
      }

      // STRICT CHECK: Reject placeholder / dummy / missing caller emails
      if (
        !rawEmail ||
        lowerEmail.includes("example.com") ||
        lowerEmail.includes("test.com") ||
        lowerEmail.includes("sample.com") ||
        lowerEmail.includes("placeholder.com") ||
        lowerEmail.includes("fake.com") ||
        lowerEmail.includes("domain.com") ||
        lowerEmail.includes("invalid.com") ||
        ["unknown", "unknown@unknown.com", "none", "null", ""].includes(lowerEmail)
      ) {
        return {
          ok: false,
          reason: "missing_or_placeholder_email",
          message:
            "CRITICAL: Caller's email has NOT been provided yet! Placeholder emails (@example.com) are strictly forbidden. Please ask the caller: 'And what is your email address so I can send your calendar invite and confirmation?' and wait for their answer.",
        };
      }

      const matchedService = findMatchingService(biz.services || [], args.service);

      const { email, problem } = await normalizeEmail(rawEmail, biz.id);
      if (problem || !email) {
        return {
          ok: false,
          reason: "unverified_email",
          message:
            "That email address is not deliverable or has no active mail servers. Please ask the caller for their real, working email address.",
        };
      }

      const availableSlots = await getAvailableSlots(biz, dateStr);
      let selectedSlot = timeStr;
      if (!availableSlots.includes(selectedSlot)) {
        // If exact slot not found, check if a slot in that hour matches
        const hourMatch = availableSlots.find((s) => s.startsWith(selectedSlot.slice(0, 2)));
        if (hourMatch) {
          selectedSlot = hourMatch;
        } else {
          const altMsg = availableSlots.length
            ? `Available times are ${formatSlotsSpoken(availableSlots)}.`
            : "We have no other open times on that day.";
          return {
            ok: false,
            reason: "slot_taken",
            available_slots: availableSlots,
            message: `${formatTimeSpoken(timeStr)} on ${formatDaySpoken(dateStr)} is not available. ${altMsg}`,
          };
        }
      }

      const serviceLabel = matchedService ? matchedService.label : "Signature Haircut & Styling";
      const price = matchedService ? matchedService.price : 85;

      const booking = await createBookingRecord({
        business_id: biz.id,
        service_key: matchedService ? matchedService.key : "haircut",
        service_label: serviceLabel,
        appt_date: dateStr,
        appt_time: selectedSlot,
        name: customerName,
        email,
        price,
      });

      // Dual DB: Also record in in-memory store if demo business
      if (biz.id === "biz_demo_dental") {
        try {
          store.book(
            matchedService ? matchedService.key : "haircut",
            dateStr,
            selectedSlot,
            customerName,
            email
          );
        } catch {}
      }

      let emailSent = false;
      try {
        const emailResult = await sendCalendarConfirmation(booking, biz);
        emailSent = !!emailResult.sent;
        if (emailSent) {
          await markBookingConfirmationSent(booking.confirmation_code);
          if (biz.id === "biz_demo_dental") {
            store.markConfirmationSent(booking.confirmation_code);
          }
        }
      } catch (emailErr) {
        console.error("[book_appointment] Email delivery failed:", emailErr);
      }

      const spoken = emailSent
        ? `I have scheduled your ${serviceLabel} for ${formatDaySpoken(dateStr)} at ${formatTimeSpoken(selectedSlot)}. Your confirmation code is ${booking.confirmation_code}. I have sent a calendar invite to ${email}.`
        : `I have scheduled your ${serviceLabel} for ${formatDaySpoken(dateStr)} at ${formatTimeSpoken(selectedSlot)}. Your confirmation code is ${booking.confirmation_code}.`;

      return {
        ok: true,
        confirmation_code: booking.confirmation_code,
        service: booking.service_key,
        service_label: serviceLabel,
        date: dateStr,
        time: selectedSlot,
        customer_name: customerName,
        email,
        price,
        email_sent: emailSent,
        message: spoken,
      };
    }

    case "send_confirmation": {
      const code = (
        args.confirmation_code ||
        args.code ||
        args.confirmationCode ||
        args.booking_code ||
        ""
      ).trim();
      let booking: Booking | null = code ? await getBookingByCode(code) : null;

      // Dual DB: check in-memory store if demo business
      if (!booking && biz.id === "biz_demo_dental" && code) {
        const storeRec = store.get(code);
        if (storeRec) {
          booking = {
            id: 0,
            business_id: biz.id,
            confirmation_code: storeRec.confirmation_code,
            service_key: storeRec.service,
            service_label: storeRec.service_label,
            appointment_date: storeRec.date,
            appointment_time: storeRec.time,
            customer_name: storeRec.customer_name,
            customer_email: storeRec.email,
            price: storeRec.price,
            status: "confirmed",
            confirmation_sent: storeRec.confirmation_sent ? 1 : 0,
            created_at: storeRec.created_at,
          };
        }
      }

      // Fallback: If no code or code not found, retrieve most recent booking for this business
      if (!booking) {
        const recentBookings = await listBookings(biz.id);
        if (recentBookings && recentBookings.length > 0) {
          booking = recentBookings[0];
        }
      }

      if (!booking) {
        return {
          ok: false,
          reason: "unknown_code",
          message: `I couldn't find an appointment with confirmation code ${code || "provided"}.`,
        };
      }

      // STRICT DEDUPLICATION: If confirmation email was already dispatched by book_appointment, do NOT send a second duplicate email!
      const isAlreadySent = Boolean(
        booking.confirmation_sent ||
        (biz.id === "biz_demo_dental" && booking.confirmation_code && store.get(booking.confirmation_code)?.confirmation_sent)
      );

      if (isAlreadySent && !args.force) {
        return {
          ok: true,
          sent: true,
          already_sent: true,
          email: booking.customer_email,
          message: `Confirmation email with calendar invite (.ics) has already been sent to ${booking.customer_email}.`,
        };
      }

      const res = await sendResendConfirmation(booking, biz);
      if (res.sent) {
        await markBookingConfirmationSent(booking.confirmation_code);
        if (biz.id === "biz_demo_dental") {
          store.markConfirmationSent(booking.confirmation_code);
        }
        return {
          ok: true,
          sent: true,
          email: booking.customer_email,
          message: `Confirmation email with calendar invite (.ics) sent to ${booking.customer_email}.`,
        };
      }

      return {
        ok: false,
        sent: false,
        reason: res.reason,
        message: `I have saved your reservation, but could not deliver the email: ${res.reason}.`,
      };
    }

    default:
      return { ok: false, message: `Unknown tool: ${toolName}` };
  }
}
