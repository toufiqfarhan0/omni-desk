import { NextResponse } from "next/server";
import { getBookingByCode, getBusiness, markBookingConfirmationSent } from "@/lib/db";
import { sendCalendarConfirmation } from "@/lib/calendar";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body.confirmationCode || body.bookingCode;
    if (!code) {
      return NextResponse.json({ error: "Missing confirmation code" }, { status: 400 });
    }

    const booking = await getBookingByCode(code);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const business = (await getBusiness(booking.business_id)) || {
      id: booking.business_id,
      name: "OmniDesk Hair Salon & Studio",
      address: "123 Beauty Lane, New York, NY",
      phone: "+1 (555) 019-2834",
    };

    const result = await sendCalendarConfirmation(booking, business as any);
    if (!result.sent) {
      return NextResponse.json({ error: result.reason || "Failed to send email" }, { status: 500 });
    }

    await markBookingConfirmationSent(code);
    return NextResponse.json({ ok: true, sent: true, messageId: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
