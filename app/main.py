"""Booking API for the AssemblyAI voice scheduling agent.

AssemblyAI's Voice Agent API calls these endpoints directly as HTTP tools.
Every response is shaped for a language model to read aloud: short, literal,
and explicit about failure so the agent can recover mid-call instead of
inventing an answer.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import base64
import json
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.responses import FileResponse, Response

from . import store

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Voice Agent Scheduler", version="1.0.0")
ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"


@app.middleware("http")
async def record_tool_calls(request, call_next):
    """Log every tool hit so the demo page can show AssemblyAI calling us."""
    if not request.url.path.startswith("/tools/"):
        return await call_next(request)
    body = await request.body()
    response = await call_next(request)
    payload = b"".join([chunk async for chunk in response.body_iterator])
    store.log_event(request.url.path, body, payload)
    return Response(
        content=payload,
        status_code=response.status_code,
        headers={k: v for k, v in response.headers.items() if k.lower() != "content-length"},
        media_type=response.media_type,
    )

E164_DIGITS = (8, 15)


class AvailabilityRequest(BaseModel):
    service: str = Field(description="Service key, e.g. 'cleaning'")
    date: str = Field(description="Requested day as YYYY-MM-DD")


class BookingRequest(BaseModel):
    service: str
    date: str
    time: str = Field(description="24-hour slot start, e.g. '14:30'")
    customer_name: str
    email: str


class ConfirmationRequest(BaseModel):
    confirmation_code: str


def _normalize_email(raw: str) -> tuple[str | None, str]:
    """Sanitize and validate spoken or transcribed email address."""
    s = raw.strip().lower()
    # Replace spoken artifacts if any remain from STT
    s = re.sub(r"\s+at\s+", "@", s)
    s = re.sub(r"\s+dot\s+", ".", s)
    s = re.sub(r"\s+", "", s)
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if re.match(pattern, s):
        return s, ""
    return None, "bad_email"


def _generate_ics(record: dict) -> str:
    """Generate an RFC 5545 iCalendar string with a 1-hour alarm notification."""
    day_str = record.get("date", "")
    time_str = record.get("time", "")
    service_label = record.get("service_label", "Dental Appointment")
    name = record.get("customer_name", "Patient")
    code = record.get("confirmation_code", "")
    service_info = store.SERVICES.get(record.get("service", ""), {})
    minutes = service_info.get("minutes", 30)

    try:
        start_dt = datetime.strptime(f"{day_str} {time_str}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=minutes)
    except Exception:
        start_dt = datetime.utcnow()
        end_dt = start_dt + timedelta(minutes=30)

    now_dt = datetime.utcnow()
    dtstamp = now_dt.strftime("%Y%m%dT%H%M%SZ")
    dtstart = start_dt.strftime("%Y%m%dT%H%M00")
    dtend = end_dt.strftime("%Y%m%dT%H%M00")
    uid = f"omnidesk-{code}-{start_dt.strftime('%Y%m%d%H%M')}@brightsmile.demo"

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//OmniDesk//Brightsmile Dental Receptionist//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:{service_label} - Brightsmile Dental",
        f"DESCRIPTION:Confirmed appointment for {name}.\\nService: {service_label}\\nConfirmation Code: {code}\\nClinic: Brightsmile Dental (100 Market St, Suite 400)",
        "LOCATION:Brightsmile Dental, 100 Market St, Suite 400",
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-PT60M",
        "ACTION:DISPLAY",
        f"DESCRIPTION:Reminder: {service_label} at Brightsmile Dental in 1 hour",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(ics_lines) + "\r\n"


def _send_resend_confirmation(record: dict) -> dict:
    """Send confirmation email via Resend with attached .ics calendar invite."""
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        return {"sent": False, "reason": "no_api_key"}

    from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    to_email = record.get("email")
    if not to_email:
        return {"sent": False, "reason": "no_email"}

    service_label = record.get("service_label", "Dental Appointment")
    name = record.get("customer_name", "Valued Customer")
    day_str = record.get("date", "")
    time_str = record.get("time", "")
    code = record.get("confirmation_code", "")
    price = record.get("price", 120)

    try:
        parsed_day = datetime.strptime(day_str, "%Y-%m-%d").date()
        spoken_day = _speak_day(parsed_day)
    except Exception:
        spoken_day = day_str

    try:
        spoken_time = _speak_time(time_str)
    except Exception:
        spoken_time = time_str

    ics_content = _generate_ics(record)
    ics_b64 = base64.b64encode(ics_content.encode("utf-8")).decode("utf-8")

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Appointment Confirmed - Brightsmile Dental</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 32px 16px; color: #111827;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="padding: 24px 28px; border-bottom: 1px solid #f3f4f6; background: #fafafa;">
      <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #0284c7; margin-bottom: 4px;">Brightsmile Dental &bull; Voice Confirmation</div>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0; color: #0f172a;">Your appointment is confirmed</h1>
    </div>
    <div style="padding: 28px;">
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #374151;">Hello <strong>{name}</strong>,</p>
      <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #4b5563;">Thank you for scheduling with our AI receptionist. We have reserved your appointment slot. A native calendar invite (<code style="font-size: 12px; background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">.ics</code>) is attached to this email.</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 120px;">Service:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{service_label}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Date & Time:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{spoken_day} at {spoken_time}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Confirmation:</td>
            <td style="padding: 6px 0;"><code style="font-family: monospace; font-size: 13px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px;">{code}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Est. Fee:</td>
            <td style="padding: 6px 0; color: #0f172a;">${price}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Location:</td>
            <td style="padding: 6px 0; color: #0f172a;">Brightsmile Dental Clinic<br><span style="font-size: 12px; color: #64748b;">100 Market St, Suite 400</span></td>
          </tr>
        </table>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #166534; margin-bottom: 24px;">
        <strong>Calendar Sync:</strong> Open the attached <code>appointment.ics</code> file on your phone or computer to automatically sync this to Apple Calendar, Google Calendar, or Outlook with a 1-hour advance reminder.
      </div>

      <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">If you need to reschedule or have any questions before your visit, reply to this email or speak with our receptionist anytime.</p>
    </div>
    <div style="padding: 16px 28px; background: #fafafa; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">
      OmniDesk Autonomous Voice Receptionist &bull; Powered by AssemblyAI
    </div>
  </div>
</body>
</html>"""

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": f"Brightsmile Dental <{from_email}>",
                "to": [to_email],
                "subject": f"Appointment Confirmed: {service_label} - Brightsmile Dental",
                "html": html_content,
                "attachments": [
                    {
                        "filename": "appointment.ics",
                        "content": ics_b64,
                    }
                ],
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            return {"sent": True, "id": resp.json().get("id")}
        return {"sent": False, "status_code": resp.status_code, "detail": resp.text}
    except Exception as exc:
        return {"sent": False, "error": str(exc)}


def _parse_day(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _speak_time(value: str) -> str:
    """'14:30' -> '2:30 pm'. Built by hand: %-I is glibc-only and breaks on Windows."""
    parsed = datetime.strptime(value, "%H:%M")
    hour = parsed.hour % 12 or 12
    suffix = "am" if parsed.hour < 12 else "pm"
    return f"{hour}:{parsed.minute:02d} {suffix}"


def _speak_day(day: date) -> str:
    return f"{day.strftime('%A %B')} {day.day}"


def _speak_slots(slots: list[str]) -> str:
    spoken = [_speak_time(s) for s in slots]
    if len(spoken) == 1:
        return spoken[0]
    return ", ".join(spoken[:-1]) + f" or {spoken[-1]}"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "services": sorted(store.SERVICES)}


@app.post("/tools/get_today")
def get_today() -> dict:
    """The model has no clock. Without this it guesses dates, and guesses wrong."""
    today = date.today()
    upcoming = store.next_open_days(today - timedelta(days=1), count=3)
    return {
        "ok": True,
        "today": today.isoformat(),
        "weekday": today.strftime("%A"),
        "next_open_days": [
            {"date": d.isoformat(), "weekday": d.strftime("%A")} for d in upcoming
        ],
        "message": f"Today is {_speak_day(today)}.",
    }


@app.post("/tools/check_availability")
def check_availability(req: AvailabilityRequest) -> dict:
    if req.service not in store.SERVICES:
        return {
            "ok": False,
            "reason": "unknown_service",
            "message": f"We don't offer '{req.service}'. We offer: {', '.join(sorted(store.SERVICES))}.",
        }

    day = _parse_day(req.date)
    if day is None:
        return {"ok": False, "reason": "bad_date", "message": "Date must be in YYYY-MM-DD form."}

    if day < date.today():
        return {"ok": False, "reason": "past_date", "message": "That date is in the past."}

    if not store.is_open(day):
        alternatives = store.next_open_days(day)
        nxt = alternatives[0] if alternatives else None
        return {
            "ok": False,
            "reason": "closed",
            "suggested_date": nxt.isoformat() if nxt else None,
            "message": (
                f"We're closed at weekends. The next day we're open is "
                f"{_speak_day(nxt)}, with {_speak_slots(store.available_slots(nxt))}."
                if nxt else "We're closed at weekends."
            ),
        }

    slots = store.available_slots(day)
    if slots:
        return {
            "ok": True,
            "date": day.isoformat(),
            "slots": slots,
            "message": f"On {_speak_day(day)} we have {_speak_slots(slots)}.",
        }

    alternatives = store.next_open_days(day)
    if not alternatives:
        return {
            "ok": False,
            "reason": "fully_booked",
            "message": "We have nothing open in the next two weeks.",
        }

    alt = alternatives[0]
    return {
        "ok": False,
        "reason": "day_full",
        "suggested_date": alt.isoformat(),
        "suggested_slots": store.available_slots(alt),
        "message": (
            f"{_speak_day(day)} is fully booked. "
            f"The next opening is {_speak_day(alt)} at "
            f"{_speak_slots(store.available_slots(alt))}."
        ),
    }


@app.post("/tools/book_appointment")
def book_appointment(req: BookingRequest) -> dict:
    if req.service not in store.SERVICES:
        return {"ok": False, "reason": "unknown_service", "message": "That service isn't offered."}

    day = _parse_day(req.date)
    if day is None:
        return {"ok": False, "reason": "bad_date", "message": "Date must be in YYYY-MM-DD form."}

    email, problem = _normalize_email(req.email)
    if problem:
        return {
            "ok": False,
            "reason": "bad_email",
            "message": "That email address doesn't look valid. Ask the caller to repeat their email address clearly.",
        }

    try:
        record = store.book(req.service, day, req.time, req.customer_name, email)
    except store.SlotUnavailable:
        slots = store.available_slots(day)
        return {
            "ok": False,
            "reason": "slot_taken",
            "slots": slots,
            "message": (
                f"That slot was just taken. Still open that day: {_speak_slots(slots)}."
                if slots
                else "That slot was just taken and the day is now full."
            ),
        }

    return {
        "ok": True,
        "confirmation_code": record["confirmation_code"],
        "message": (
            f"Booked: {record['service_label']} on {_speak_day(day)} at "
            f"{_speak_slots([req.time])}. Confirmation code {record['confirmation_code']}."
        ),
    }


@app.post("/tools/send_confirmation")
def send_confirmation(req: ConfirmationRequest) -> dict:
    record = store.mark_confirmation_sent(req.confirmation_code.upper())
    if record is None:
        return {
            "ok": False,
            "reason": "unknown_code",
            "message": "No appointment matches that confirmation code.",
        }

    email_res = _send_resend_confirmation(record)
    target_email = record.get("email", "your email")
    return {
        "ok": True,
        "resend_sent": email_res.get("sent", False),
        "message": f"Confirmation email with calendar invite sent to {target_email}.",
    }


@app.get("/appointments")
def list_appointments() -> dict:
    return {"appointments": list(store._appointments.values())}


@app.get("/api/owner-stats")
def api_owner_stats() -> dict:
    today_iso = date.today().isoformat()
    appts = list(store._appointments.values())
    today_appts = [a for a in appts if a.get("date") == today_iso]
    upcoming_appts = [a for a in appts if a.get("date", "") > today_iso]
    total_rev = sum(a.get("price", 120) for a in appts)

    customer_map: dict[str, dict] = {}
    for a in appts:
        email = a.get("email", "")
        name = a.get("customer_name", "Anonymous")
        if email not in customer_map:
            customer_map[email] = {
                "name": name,
                "email": email,
                "appointments_count": 0,
                "last_service": a.get("service_label", ""),
                "last_date": a.get("date", ""),
            }
        customer_map[email]["appointments_count"] += 1
        if a.get("date", "") >= customer_map[email]["last_date"]:
            customer_map[email]["last_date"] = a.get("date", "")
            customer_map[email]["last_service"] = a.get("service_label", "")

    return {
        "today_bookings_count": len(today_appts),
        "upcoming_bookings_count": len(upcoming_appts),
        "total_bookings_count": len(appts),
        "estimated_revenue": total_rev,
        "today_appointments": today_appts,
        "upcoming_appointments": upcoming_appts,
        "all_appointments": sorted(appts, key=lambda x: (x.get("date", ""), x.get("time", ""))),
        "customers": list(customer_map.values()),
        "services": [
            {
                "key": k,
                "label": v["label"],
                "minutes": v["minutes"],
                "price": v.get("price", 120),
                "description": v.get("description", ""),
            }
            for k, v in sorted(store.SERVICES.items())
        ],
        "business": {
            "name": "Brightsmile Dental",
            "hours": f"Monday to Friday, {_speak_time(f'{store.OPEN_HOUR:02d}:00')} – {_speak_time(f'{store.CLOSE_HOUR:02d}:00')}",
            "slot_minutes": store.SLOT_MINUTES,
            "voice_agent": "AssemblyAI Voice Agent API",
            "confirmation_engine": "Resend Email (.ics Calendar Invite)",
        },
    }


# --- demo endpoints -------------------------------------------------------


@app.get("/api/events")
def api_events(since: int = 0) -> dict:
    events = store.events_since(since)
    return {"events": events, "cursor": events[-1]["seq"] if events else since}


@app.get("/api/config")
def api_config() -> dict:
    agent_id_file = ROOT / "agent_id.txt"
    agent_id = os.getenv("AGENT_ID") or (
        agent_id_file.read_text(encoding="utf-8").strip() if agent_id_file.exists() else ""
    )
    return {"agent_id": agent_id, "services": sorted(store.SERVICES)}


@app.get("/api/demo-info")
def api_demo_info() -> dict:
    """Everything the agent knows, split by where it comes from.

    agent.json is uploaded once and never changes during a call. The calendar
    below is read live, on every single tool call.
    """
    definition = json.loads((ROOT / "agent.json").read_text(encoding="utf-8"))

    days = []
    cursor = date.today()
    for _ in range(21):
        if len(days) >= 5:
            break
        slots = store.available_slots(cursor, limit=99)
        if store.is_open(cursor) and slots:
            days.append({
                "date": cursor.isoformat(),
                "label": _speak_day(cursor),
                "slots": [_speak_time(s) for s in slots],
                "total": len(slots),
            })
        cursor += timedelta(days=1)

    return {
        "agent": {
            "name": definition["name"],
            "voice": definition["voice"]["voice_id"],
            "keyterms": definition.get("keyterms", []),
            "tools": [
                {"name": t["name"], "url": t["http"]["url"].rsplit("/", 1)[-1]}
                for t in definition.get("tools", [])
            ],
        },
        "hours": {
            "days": "Monday to Friday",
            "open": _speak_time(f"{store.OPEN_HOUR:02d}:00"),
            "close": _speak_time(f"{store.CLOSE_HOUR:02d}:00"),
            "slot_minutes": store.SLOT_MINUTES,
        },
        "services": [
            {"key": k, "label": v["label"], "minutes": v["minutes"]}
            for k, v in sorted(store.SERVICES.items())
        ],
        "days": days,
    }


@app.get("/api/token")
def api_token() -> dict:
    """Mint a short-lived token. The browser must never see the API key."""
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        raise HTTPException(500, "ASSEMBLYAI_API_KEY is not set on the server")
    resp = httpx.get(
        "https://agents.assemblyai.com/v1/token",
        headers={"Authorization": f"Bearer {api_key}"},
        params={"expires_in_seconds": 300, "max_session_duration_seconds": 600},
        timeout=15,
    )
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code, f"Token request failed: {resp.text}")
    return {"token": resp.json()["token"]}


@app.get("/console")
@app.get("/demo")
def serve_console():
    console_file = WEB_DIR / "console.html"
    if console_file.exists():
        return FileResponse(console_file)
    return FileResponse(WEB_DIR / "index.html")


if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
