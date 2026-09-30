import { NextResponse } from "next/server";
import {
  getBookingByCode,
  getBusiness,
  listBookings,
  markBookingConfirmationSent,
  Booking,
} from "@/lib/db";
import { sendCalendarConfirmation } from "@/lib/calendar";
import { store } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      bookingId,
      confirmationCode,
      confirmation_code,
      code,
      businessId,
      business_id,
      email,
    } = body;

    const targetCode = confirmationCode || confirmation_code || code;
    const bizId = businessId || business_id || "biz_demo_dental";

    let booking: Booking | null = null;

    if (targetCode) {
      booking = await getBookingByCode(targetCode);
    }

    if (!booking && targetCode) {
      const storeRec = store.get(targetCode);
      if (storeRec) {
        booking = {
          id: 0,
          business_id: bizId,
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

    if (!booking && bookingId) {
      const all = await listBookings(bizId);
      booking = all.find((b) => String(b.id) === String(bookingId)) || null;
    }

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    if (email && (!booking.customer_email || booking.customer_email !== email)) {
      booking.customer_email = email;
    }

    const biz = await getBusiness(bizId || booking.business_id);
    const result = await sendCalendarConfirmation(booking, biz);

    if (result.sent) {
      await markBookingConfirmationSent(booking.confirmation_code);
      if (biz?.id === "biz_demo_dental") {
        store.markConfirmationSent(booking.confirmation_code);
      }
      return NextResponse.json({
        ok: true,
        message: `Calendar invite sent to ${booking.customer_email}`,
        id: result.id,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: result.reason || "Failed to dispatch calendar invite",
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[resend-invite route error]:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
