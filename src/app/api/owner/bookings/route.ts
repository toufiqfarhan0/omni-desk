import { NextResponse } from "next/server";
import {
  listBookings,
  getBookingByCode,
  getBusiness,
} from "@/lib/db";
import { sendResendConfirmation } from "@/lib/calendar";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || "biz_demo_dental";
    const bookings = listBookings(businessId);
    return NextResponse.json({ bookings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { confirmation_code, business_id } = body;

    if (!confirmation_code) {
      return NextResponse.json(
        { error: "Confirmation code is required" },
        { status: 400 }
      );
    }

    const booking = getBookingByCode(confirmation_code);
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const biz = getBusiness(business_id || booking.business_id);
    const result = await sendResendConfirmation(booking, biz);

    if (result.sent) {
      return NextResponse.json({
        ok: true,
        message: "Calendar invite and confirmation email sent",
        id: result.id,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: result.reason || "Failed to send email",
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
