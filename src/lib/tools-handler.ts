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
      const nextDays = await getNextOpenDays(biz, todayDate, 3);
      const weekday = todayDate.toLocaleDateString("en-US", {
        weekday: "long",
      });

      return {
        ok: true,
        business: biz.name,
        today: todayStr,
        weekday,
        next_open_days: nextDays.map((d) => ({
          date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
            d.getUTCDate()
          )}`,
          weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
        })),
        message: `Today is ${formatDaySpoken(todayStr)}.`,
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
      const serviceKey = (args.service || "").trim().toLowerCase();
      const dateStr = (args.date || "").trim();

      const services = biz.services || [];
      const matchedService = services.find(
        (s) =>
          s.key.toLowerCase() === serviceKey ||
          s.label.toLowerCase().includes(serviceKey) ||
          serviceKey.includes(s.key.toLowerCase())
      );

      if (!matchedService && services.length > 0) {
        const availKeys = services.map((s) => s.label).join(", ");
        return {
          ok: false,
          reason: "unknown_service",
          message: `We don't offer that specific service. We offer: ${availKeys}.`,
        };
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return {
          ok: false,
          reason: "bad_date",
          message: "Date must be in YYYY-MM-DD format.",
        };
      }

      if (dateStr < todayStr) {
        return {
          ok: false,
          reason: "past_date",
          message: "That date is in the past.",
        };
      }

      const reqDate = new Date(dateStr + "T00:00:00Z");
      if (!isBusinessOpenOnDate(biz, reqDate)) {
        const nextDays = await getNextOpenDays(biz, reqDate, 1);
        const nextD = nextDays[0];
        let altMsg = "We are closed on that day.";
        if (nextD) {
          const nextDStr = `${nextD.getUTCFullYear()}-${pad(
            nextD.getUTCMonth() + 1
          )}-${pad(nextD.getUTCDate())}`;
          const nextSlots = await getAvailableSlots(biz, nextDStr);
          altMsg = `We are closed on that day. The next day we're open is ${formatDaySpoken(
            nextDStr
          )}, with open times at ${formatSlotsSpoken(nextSlots)}.`;
        }
        return {
          ok: false,
          reason: "closed",
          message: altMsg,
        };
      }

      const slots = await getAvailableSlots(biz, dateStr);
      const serviceLabel = matchedService?.label || args.service;
      const price = matchedService?.price ?? 0;
      const minutes = matchedService?.minutes ?? 30;

      if (slots.length > 0) {
        return {
          ok: true,
          date: dateStr,
          service: serviceLabel,
          price,
          duration_minutes: minutes,
          slots: slots.slice(0, 5),
          message: `On ${formatDaySpoken(dateStr)} for ${serviceLabel} ($${price}, ${minutes} mins), we have open times at ${formatSlotsSpoken(
            slots
          )}.`,
        };
      }

      const nextDays = await getNextOpenDays(biz, reqDate, 1);
      const nextD = nextDays[0];
      let altMsg = "We have nothing open in the next two weeks.";
      if (nextD) {
        const nextDStr = `${nextD.getUTCFullYear()}-${pad(
          nextD.getUTCMonth() + 1
        )}-${pad(nextD.getUTCDate())}`;
        const nextSlots = await getAvailableSlots(biz, nextDStr);
        altMsg = `${formatDaySpoken(
          dateStr
        )} is fully booked for ${serviceLabel}. The next opening is ${formatDaySpoken(
          nextDStr
        )} at ${formatSlotsSpoken(nextSlots)}.`;
      }

      return {
        ok: false,
        reason: "day_full",
        message: altMsg,
      };
    }

    case "book_appointment": {
      const serviceKey = (args.service || "").trim();
      const dateStr = (args.date || "").trim();
      const timeStr = (args.time || "").trim();
      const customerName = (args.customer_name || "").trim();
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

      const services = biz.services || [];
      const matchedService =
        services.find(
          (s) =>
            s.key.toLowerCase() === serviceKey.toLowerCase() ||
            s.label.toLowerCase().includes(serviceKey.toLowerCase())
        ) || services[0];

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return {
          ok: false,
          reason: "bad_date",
          message: "Date must be in YYYY-MM-DD format.",
        };
      }

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
      if (!availableSlots.includes(timeStr)) {
        const altMsg = availableSlots.length
          ? `We do have ${formatSlotsSpoken(availableSlots)}.`
          : "We have no other open times on that day.";
        return {
          ok: false,
          reason: "slot_taken",
          available_slots: availableSlots,
          message: `${formatTimeSpoken(timeStr)} on ${formatDaySpoken(
            dateStr
          )} is not available. ${altMsg}`,
        };
      }

      const serviceLabel = matchedService
        ? matchedService.label
        : serviceKey || "Appointment";
      const price = matchedService ? matchedService.price : 0;

      const booking = await createBookingRecord({
        business_id: biz.id,
        service_key: matchedService ? matchedService.key : "appointment",
        service_label: serviceLabel,
        appt_date: dateStr,
        appt_time: timeStr,
        name: customerName || "Valued Client",
        email,
        price,
      });

      // Dual DB: Also record in in-memory store if demo business
      if (biz.id === "biz_demo_dental") {
        try {
          store.book(
            matchedService ? matchedService.key : "haircut",
            dateStr,
            timeStr,
            customerName || "Valued Client",
            email
          );
        } catch {}
      }

      // Await email dispatch so Vercel Serverless Function does not freeze before SMTP delivery
      let emailSent = false;
      try {
        const emailResult = await sendCalendarConfirmation(booking, biz);
        emailSent = !!emailResult.sent;
        if (emailSent && biz.id === "biz_demo_dental") {
          store.markConfirmationSent(booking.confirmation_code);
        }
      } catch (emailErr) {
        console.error("[book_appointment] Email delivery failed:", emailErr);
      }

      const spoken = emailSent
        ? `I have scheduled your ${serviceLabel} for ${formatDaySpoken(
            dateStr
          )} at ${formatTimeSpoken(timeStr)}. Your confirmation code is ${
            booking.confirmation_code
          }. I have sent a calendar invite to ${email}.`
        : `I have scheduled your ${serviceLabel} for ${formatDaySpoken(
            dateStr
          )} at ${formatTimeSpoken(timeStr)}. Your confirmation code is ${
            booking.confirmation_code
          }.`;

      return {
        ok: true,
        confirmation_code: booking.confirmation_code,
        service: booking.service_key,
        service_label: serviceLabel,
        date: dateStr,
        time: timeStr,
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
