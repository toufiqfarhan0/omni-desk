import nodemailer from "nodemailer";
import { Booking, Business, getActiveVerifiedEmail, markBookingConfirmationSent } from "./db";

export function formatTimeSpoken(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  let hour = parseInt(parts[0], 10);
  const minute = parts[1] || "00";
  const suffix = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

export function formatDaySpoken(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function generateIcs(booking: Booking, business?: Business | null): string {
  const dayStr = booking.appointment_date;
  const timeStr = booking.appointment_time;
  const serviceLabel = booking.service_label || "Appointment";
  const clientName = booking.customer_name || "Valued Client";
  const code = booking.confirmation_code || "";
  const bizName = business ? business.name : "OmniDesk";
  const bizId = business ? business.id : "biz";

  let minutes = 30;
  if (business?.services) {
    const s = business.services.find((x) => x.key === booking.service_key);
    if (s?.minutes) minutes = s.minutes;
  }

  const [year, month, day] = dayStr.split("-").map((x) => parseInt(x, 10));
  const [hour, minute] = timeStr.split(":").map((x) => parseInt(x, 10));

  const startDt = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const endDt = new Date(startDt.getTime() + minutes * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const toIcsUtc = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}00Z`;

  const dtStart = toIcsUtc(startDt);
  const dtEnd = toIcsUtc(endDt);
  const dtStamp = toIcsUtc(new Date());
  const uid = `${code}-${bizId}@omnidesk.ai`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OmniDesk//Voice Agent Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${serviceLabel} - ${bizName}`,
    `DESCRIPTION:Appointment confirmation for ${clientName}. Confirmation Code: ${code}. Estimated fee: $${booking.price}.`,
    `LOCATION:${bizName}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${serviceLabel} at ${bizName} in 1 hour`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

export async function sendCalendarConfirmation(
  booking: Booking,
  business?: Business | null
): Promise<{ sent: boolean; reason?: string; id?: string }> {
  const smtpUser = process.env.SMTP_USER || "omni.desk.com@gmail.com";
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!smtpPass) {
    return { sent: false, reason: "no_smtp_password" };
  }

  let toEmail = booking.customer_email;
  if (!toEmail && business?.id) {
    toEmail = (await getActiveVerifiedEmail(business.id)) || "";
  }

  if (!toEmail) {
    return { sent: false, reason: "no_email" };
  }

  const bizName = business ? business.name : "OmniDesk Hair Salon & Studio";
  const serviceLabel = booking.service_label || "Appointment";
  const name = booking.customer_name || "Valued Client";
  const spokenDay = formatDaySpoken(booking.appointment_date);
  const spokenTime = formatTimeSpoken(booking.appointment_time);
  const code = booking.confirmation_code;
  const price = booking.price;

  const icsString = generateIcs(booking, business);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Appointment Confirmed - ${bizName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 32px 16px; color: #111827;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="padding: 24px 28px; border-bottom: 1px solid #f3f4f6; background: #fafafa;">
      <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #000000; margin-bottom: 4px;">${bizName} &bull; Voice Confirmation</div>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0; color: #0f172a;">Your appointment is confirmed</h1>
    </div>
    <div style="padding: 28px;">
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #374151;">Hello <strong>${name}</strong>,</p>
      <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #4b5563;">Thank you for scheduling with our voice receptionist. We have reserved your appointment slot. A native calendar invite (<code style="font-size: 12px; background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">.ics</code>) is attached to this email.</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 120px;">Service:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${serviceLabel}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Date &amp; Time:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${spokenDay} at ${spokenTime}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Confirmation:</td>
            <td style="padding: 6px 0;"><code style="font-family: monospace; font-size: 13px; font-weight: 700; background: #f5f5f5; color: #000000; padding: 2px 8px; border-radius: 4px;">${code}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Est. Fee:</td>
            <td style="padding: 6px 0; color: #0f172a;">$${price}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Business:</td>
            <td style="padding: 6px 0; color: #0f172a;">${bizName}</td>
          </tr>
        </table>
      </div>

      <div style="background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #171717; margin-bottom: 24px;">
        <strong>Calendar Sync:</strong> Open the attached <code>appointment.ics</code> file on your phone or computer to automatically sync this to Apple Calendar, Google Calendar, or Outlook with a 1-hour advance reminder.
      </div>

      <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">If you need to reschedule or have any questions before your visit, reply to this email or speak with our receptionist anytime.</p>
    </div>
    <div style="padding: 16px 28px; background: #fafafa; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">
      OmniDesk Voice Receptionist &bull; Powered by AssemblyAI
    </div>
  </div>
</body>
</html>`;

  try {
    const cleanPass = smtpPass.replace(/\s+/g, "");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: cleanPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${bizName}" <${smtpUser}>`,
      to: toEmail,
      subject: `Appointment Confirmed: ${serviceLabel} - ${bizName}`,
      html: htmlContent,
      attachments: [
        {
          filename: "appointment.ics",
          content: icsString,
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    });

    await markBookingConfirmationSent(code);
    return { sent: true, id: info.messageId };
  } catch (smtpErr: any) {
    console.error("Gmail SMTP delivery error:", smtpErr);
    return { sent: false, reason: smtpErr.message };
  }
}

export const sendResendConfirmation = sendCalendarConfirmation;
export const sendConfirmationEmail = sendCalendarConfirmation;
