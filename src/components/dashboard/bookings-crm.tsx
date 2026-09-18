"use client";

import { useState, useEffect } from "react";
import { Booking, Business } from "@/lib/db";
import { toast } from "sonner";

interface BookingsCRMProps {
  business: Business;
}

export function BookingsCRM({ business }: BookingsCRMProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resendingCode, setResendingCode] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/owner/businesses/${business.id}/bookings`);
      if (!res.ok) {
        // fallback
        const fallbackRes = await fetch(`/api/owner/bookings?businessId=${business.id}`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setBookings(data.bookings || []);
          return;
        }
        throw new Error("Failed to load bookings");
      }
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [business.id]);

  const handleResendInvite = async (booking: Booking) => {
    try {
      setResendingCode(booking.confirmation_code);
      const res = await fetch("/api/owner/bookings/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          confirmationCode: booking.confirmation_code,
        }),
      });
      if (!res.ok) throw new Error("Failed to dispatch calendar invite");
      toast.success(`Calendar invite (.ics) sent to ${booking.customer_email}`);
      setBookings((prev) =>
        prev.map((b) =>
          b.confirmation_code === booking.confirmation_code
            ? { ...b, invite_sent: true }
            : b
        )
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch calendar invite");
    } finally {
      setResendingCode(null);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = bookings.filter((b) => b.appointment_date === todayStr).length;
  const upcomingCount = bookings.filter((b) => b.appointment_date > todayStr).length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);

  return (
    <div>
      {/* 4 KPI Cards Matching web/dashboard.html */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
            Today&apos;s Bookings
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 2px" }}>
            {todayCount}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-sub)" }}>Active schedule</div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
            Upcoming (14 Days)
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 2px" }}>
            {upcomingCount}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-sub)" }}>Confirmed slots</div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
            Total Bookings
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 2px" }}>
            {bookings.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-sub)" }}>All-time appointments</div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
            Pipeline Value
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 2px" }}>
            ${totalRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-sub)" }}>Confirmed appointment fee</div>
        </div>
      </div>

      {/* Bookings Table Matching web/dashboard.html */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Code</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Date &amp; Time</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Customer</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Service</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Fee</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Calendar Invite</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Booked At</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  Loading customer bookings...
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No customer bookings recorded yet. Speak with the agent in the Live Voice Tester to book an appointment!
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id || b.confirmation_code} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--mono)",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "#f4f4f5",
                        border: "1px solid var(--border)",
                        fontWeight: 700,
                        display: "inline-block",
                      }}
                    >
                      {b.confirmation_code}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <strong>{b.appointment_date}</strong> at {b.appointment_time}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {b.customer_name}
                    <br />
                    <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                      {b.customer_email}{" "}
                      <span style={{ display: "inline-flex", alignItems: "center", color: "#16a34a", fontWeight: 600, fontSize: "10.5px" }}>
                        Verified
                      </span>
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>{b.service_label}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <strong>${b.price || 0}</strong>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {b.invite_sent || Boolean(b.confirmation_sent) ? (
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--mono)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#000000",
                          color: "#ffffff",
                          display: "inline-block",
                        }}
                      >
                        Dispatched
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResendInvite(b)}
                        disabled={resendingCode === b.confirmation_code}
                        style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          border: "1px solid #fde68a",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 500,
                        }}
                      >
                        {resendingCode === b.confirmation_code ? "Sending..." : "Resend .ics"}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {b.created_at ? new Date(b.created_at).toLocaleDateString() : "Just now"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
