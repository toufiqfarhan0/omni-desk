import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  try {
    const allAppts = store.getAllAppointments();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;

    const todayAppts = allAppts.filter((a) => a.date === todayStr);
    const upcomingAppts = allAppts.filter((a) => a.date > todayStr);

    const customerMap: Record<string, any> = {};
    for (const a of allAppts) {
      const email = a.email;
      if (!email) continue;
      if (!customerMap[email]) {
        customerMap[email] = {
          name: a.customer_name,
          email,
          appointments_count: 0,
          last_service: a.service_label,
          last_date: a.date,
        };
      }
      customerMap[email].appointments_count += 1;
      if (a.date > customerMap[email].last_date) {
        customerMap[email].last_date = a.date;
        customerMap[email].last_service = a.service_label;
      }
    }

    const services = Object.entries(store.state.services)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        key: k,
        label: v.label,
        minutes: v.minutes,
        price: v.price,
        description: v.description,
      }));

    return NextResponse.json({
      today_bookings_count: todayAppts.length,
      upcoming_bookings_count: upcomingAppts.length,
      total_bookings_count: allAppts.length,
      estimated_revenue: allAppts.reduce((sum, a) => sum + (a.price || 0), 0),
      today_appointments: todayAppts,
      upcoming_appointments: upcomingAppts,
      all_appointments: allAppts.sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      ),
      customers: Object.values(customerMap),
      services,
      business: {
        name: "OmniDesk Hair Salon & Studio",
        hours: "Monday to Friday, 9:00 am – 5:00 pm",
        slot_minutes: store.state.slotMinutes,
        voice_agent: "AssemblyAI Voice Agent API",
        confirmation_engine: "Transactional Email (.ics Calendar Invite)",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
