"""Multi-tenant Booking API and SaaS Platform for AssemblyAI Voice Agents.

Features:
- Multi-tenant business workflows with dropdown presets and custom voice configurations
- Dynamic AssemblyAI Voice Agent provisioning & real-time modification
- Interactive live agent testing with AssemblyAI session tokens
- Call history logging & conversation transcript tracking
- Sheeted customer bookings & CRM dashboard
- 100% backward compatible with the flagship dental receptionist demo (/console)
"""

from __future__ import annotations

import base64
import json
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Query, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.responses import FileResponse, Response

from . import db, store

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="OmniDesk Voice Platform", version="2.0.0")
ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
AGENTS_URL = "https://agents.assemblyai.com/v1/agents"


@app.middleware("http")
async def record_tool_calls(request: Request, call_next):
    """Log every tool hit so both the demo page and tenant dashboards can track tools."""
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


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

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


class OwnerAuthRequest(BaseModel):
    email: str
    name: str = ""


class ServiceItem(BaseModel):
    key: str
    label: str
    minutes: int = 30
    price: float = 0.0
    description: str = ""


class CreateBusinessRequest(BaseModel):
    owner_id: str
    name: str
    industry: str = "dental"
    tone: str = "professional"
    greeting: str
    system_prompt: str
    voice_id: str = "131a436c-0fc4-4797-90f7-d0e515d18b06"
    slot_minutes: int = 30
    open_hour: int = 9
    close_hour: int = 17
    keyterms: list[str] = []
    services: list[ServiceItem] = []


class UpdateBusinessRequest(BaseModel):
    name: str | None = None
    industry: str | None = None
    tone: str | None = None
    greeting: str | None = None
    system_prompt: str | None = None
    voice_id: str | None = None
    slot_minutes: int | None = None
    open_hour: int | None = None
    close_hour: int | None = None
    keyterms: list[str] | None = None
    services: list[ServiceItem] | None = None


class SaveConversationRequest(BaseModel):
    business_id: str
    caller_name: str = ""
    caller_email: str = ""
    started_at: str
    ended_at: str = ""
    duration_seconds: int = 0
    status: str = "completed"
    outcome: str = "inquiry"
    transcript: list[dict] = []
    tool_calls: list[dict] = []


# ---------------------------------------------------------------------------
# Utility Helpers
# ---------------------------------------------------------------------------

def _normalize_email(raw: str) -> tuple[str | None, str]:
    """Sanitize and validate spoken or transcribed email address."""
    s = raw.strip().lower()
    s = re.sub(r"\s+at\s+", "@", s)
    s = re.sub(r"\s+dot\s+", ".", s)
    s = re.sub(r"\s+", "", s)
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if re.match(pattern, s):
        return s, ""
    return None, "bad_email"


def _parse_day(value: str) -> date | None:
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _speak_time(value: str) -> str:
    """'14:30' -> '2:30 pm'."""
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


def _get_business_or_demo(business_id: str | None) -> dict:
    if business_id:
        b = db.get_business(business_id)
        if b:
            return b
    demo = db.get_business("biz_demo_dental")
    if demo:
        return demo
    return {
        "id": "biz_demo_dental",
        "name": "OmniDesk Dental Clinic",
        "open_hour": 9,
        "close_hour": 17,
        "slot_minutes": 30,
        "services": [
            {"key": k, "label": v["label"], "minutes": v["minutes"], "price": v["price"], "description": v["description"]}
            for k, v in sorted(store.SERVICES.items())
        ],
    }


def _generate_ics(record: dict, biz: dict | None = None) -> str:
    """Generate an RFC 5545 iCalendar string with a 1-hour alarm notification."""
    day_str = record.get("date", "")
    time_str = record.get("time", "")
    service_label = record.get("service_label", "Appointment")
    name = record.get("customer_name", "Valued Client")
    code = record.get("confirmation_code", "")
    biz_name = biz["name"] if biz else "OmniDesk Dental Clinic"
    biz_id = biz["id"] if biz else "dental"

    minutes = 30
    if biz and "services" in biz:
        for s in biz["services"]:
            if s["key"] == record.get("service"):
                minutes = s.get("minutes", 30)
                break
    elif record.get("service") in store.SERVICES:
        minutes = store.SERVICES[record["service"]]["minutes"]

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
    uid = f"omnidesk-{code}-{start_dt.strftime('%Y%m%d%H%M')}@{biz_id}.omnidesk.ai"

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//OmniDesk//{biz_name} Voice Receptionist//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:{service_label} - {biz_name}",
        f"DESCRIPTION:Confirmed appointment for {name}.\\nService: {service_label}\\nConfirmation Code: {code}\\nBusiness: {biz_name}",
        f"LOCATION:{biz_name}",
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-PT60M",
        "ACTION:DISPLAY",
        f"DESCRIPTION:Reminder: {service_label} at {biz_name} in 1 hour",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(ics_lines) + "\r\n"


def _send_resend_confirmation(record: dict, biz: dict | None = None) -> dict:
    """Send confirmation email via Resend with attached .ics calendar invite."""
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        return {"sent": False, "reason": "no_api_key"}

    from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    to_email = record.get("email")
    if not to_email:
        return {"sent": False, "reason": "no_email"}

    biz_name = biz["name"] if biz else "OmniDesk Dental Clinic"
    service_label = record.get("service_label", "Appointment")
    name = record.get("customer_name", "Valued Client")
    day_str = record.get("date", "")
    time_str = record.get("time", "")
    code = record.get("confirmation_code", "")
    price = record.get("price", 0)

    try:
        parsed_day = datetime.strptime(day_str, "%Y-%m-%d").date()
        spoken_day = _speak_day(parsed_day)
    except Exception:
        spoken_day = day_str

    try:
        spoken_time = _speak_time(time_str)
    except Exception:
        spoken_time = time_str

    ics_content = _generate_ics(record, biz)
    ics_b64 = base64.b64encode(ics_content.encode("utf-8")).decode("utf-8")

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Appointment Confirmed - {biz_name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 32px 16px; color: #111827;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="padding: 24px 28px; border-bottom: 1px solid #f3f4f6; background: #fafafa;">
      <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #000000; margin-bottom: 4px;">{biz_name} &bull; Voice Confirmation</div>
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
            <td style="padding: 6px 0;"><code style="font-family: monospace; font-size: 13px; font-weight: 700; background: #f5f5f5; color: #000000; padding: 2px 8px; border-radius: 4px;">{code}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Est. Fee:</td>
            <td style="padding: 6px 0; color: #0f172a;">${price}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Business:</td>
            <td style="padding: 6px 0; color: #0f172a;">{biz_name}</td>
          </tr>
        </table>
      </div>

      <div style="background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #171717; margin-bottom: 24px;">
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
                "from": f"{biz_name} <{from_email}>",
                "to": [to_email],
                "subject": f"Appointment Confirmed: {service_label} - {biz_name}",
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
        return {"sent": False, "reason": resp.text}
    except Exception as exc:
        return {"sent": False, "reason": str(exc)}


# ---------------------------------------------------------------------------
# Multi-Tenant Slot & Booking Core Logic
# ---------------------------------------------------------------------------

def _biz_slots(biz: dict, day: date) -> list[str]:
    open_h = biz.get("open_hour", 9)
    close_h = biz.get("close_hour", 17)
    step = biz.get("slot_minutes", 30)
    start = datetime.combine(day, datetime.min.time()).replace(hour=open_h)
    end = datetime.combine(day, datetime.min.time()).replace(hour=close_h)
    slots = []
    curr = start
    while curr < end:
        slots.append(curr.strftime("%H:%M"))
        curr += timedelta(minutes=step)
    return slots


def _biz_available_slots(biz: dict, day: date, limit: int = 4) -> list[str]:
    if day.weekday() >= 5:
        return []
    all_slots = _biz_slots(biz, day)
    bookings = db.list_bookings_for_business(biz["id"])
    taken = {b["appointment_time"] for b in bookings if b["appointment_date"] == day.isoformat()}
    if biz["id"] == "biz_demo_dental":
        store_taken = {t[1] for t in store._taken if t[0] == day.isoformat()}
        taken |= store_taken
    free = [s for s in all_slots if s not in taken]
    return free[:limit]


def _biz_next_open_days(biz: dict, after: date, count: int = 2) -> list[date]:
    found = []
    cursor = after
    while len(found) < count:
        cursor += timedelta(days=1)
        if (cursor - date.today()).days > 14:
            break
        if cursor.weekday() < 5 and _biz_available_slots(biz, cursor):
            found.append(cursor)
    return found


def _handle_get_today(biz_id: str | None = None) -> dict:
    biz = _get_business_or_demo(biz_id)
    today = date.today()
    upcoming = _biz_next_open_days(biz, today - timedelta(days=1), count=3)
    return {
        "ok": True,
        "business": biz["name"],
        "today": today.isoformat(),
        "weekday": today.strftime("%A"),
        "next_open_days": [
            {"date": d.isoformat(), "weekday": d.strftime("%A")} for d in upcoming
        ],
        "message": f"Today is {_speak_day(today)}.",
    }


def _handle_check_availability(req: AvailabilityRequest, biz_id: str | None = None) -> dict:
    biz = _get_business_or_demo(biz_id)
    services_map = {s["key"]: s for s in biz.get("services", [])}
    if not services_map and biz["id"] == "biz_demo_dental":
        services_map = store.SERVICES

    if req.service not in services_map:
        avail_keys = ", ".join(sorted(services_map.keys()))
        return {
            "ok": False,
            "reason": "unknown_service",
            "message": f"We don't offer '{req.service}'. We offer: {avail_keys}.",
        }

    day = _parse_day(req.date)
    if day is None:
        return {"ok": False, "reason": "bad_date", "message": "Date must be in YYYY-MM-DD form."}

    if day < date.today():
        return {"ok": False, "reason": "past_date", "message": "That date is in the past."}

    if day.weekday() >= 5:
        alternatives = _biz_next_open_days(biz, day)
        nxt = alternatives[0] if alternatives else None
        return {
            "ok": False,
            "reason": "closed",
            "suggested_date": nxt.isoformat() if nxt else None,
            "message": (
                f"We're closed at weekends. The next day we're open is "
                f"{_speak_day(nxt)}, with {_speak_slots(_biz_available_slots(biz, nxt))}."
                if nxt else "We're closed at weekends."
            ),
        }

    slots = _biz_available_slots(biz, day)
    if slots:
        return {
            "ok": True,
            "date": day.isoformat(),
            "slots": slots,
            "message": f"On {_speak_day(day)} we have {_speak_slots(slots)}.",
        }

    alternatives = _biz_next_open_days(biz, day)
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
        "suggested_slots": _biz_available_slots(biz, alt),
        "message": (
            f"{_speak_day(day)} is fully booked. "
            f"The next opening is {_speak_day(alt)} at "
            f"{_speak_slots(_biz_available_slots(biz, alt))}."
        ),
    }


def _handle_book_appointment(req: BookingRequest, biz_id: str | None = None) -> dict:
    biz = _get_business_or_demo(biz_id)
    services_map = {s["key"]: s for s in biz.get("services", [])}
    if not services_map and biz["id"] == "biz_demo_dental":
        services_map = store.SERVICES

    if req.service not in services_map:
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

    # Verify slot availability
    available = _biz_available_slots(biz, day, limit=99)
    if req.time not in available:
        alternatives = _biz_available_slots(biz, day)
        if alternatives:
            return {
                "ok": False,
                "reason": "slot_taken",
                "available_slots": alternatives,
                "message": (
                    f"{_speak_time(req.time)} on {_speak_day(day)} isn't available. "
                    f"We do have {_speak_slots(alternatives)}."
                ),
            }
        nxt_days = _biz_next_open_days(biz, day)
        nxt = nxt_days[0] if nxt_days else None
        return {
            "ok": False,
            "reason": "day_full",
            "message": (
                f"{_speak_day(day)} has no remaining slots. "
                f"The next available day is {_speak_day(nxt)}."
                if nxt else f"{_speak_day(day)} is fully booked."
            ),
        }

    service_info = services_map[req.service]
    service_label = service_info.get("label", req.service.capitalize())
    price = service_info.get("price", 0.0)

    # Record in db
    record = db.create_booking_record(
        business_id=biz["id"],
        service_key=req.service,
        service_label=service_label,
        appt_date=day.isoformat(),
        appt_time=req.time,
        name=req.customer_name,
        email=email,
        price=price,
    )

    # If demo tenant, also record in memory store for live demo view
    if biz["id"] == "biz_demo_dental":
        try:
            store.book(
                service=req.service,
                day=day,
                time_str=req.time,
                name=req.customer_name,
                email=email,
            )
        except Exception:
            pass

    spoken = (
        f"I have scheduled your {service_label} for "
        f"{_speak_day(day)} at {_speak_time(req.time)}. "
        f"Your confirmation code is {record['confirmation_code']}."
    )

    return {
        "ok": True,
        "confirmation_code": record["confirmation_code"],
        "service": req.service,
        "service_label": service_label,
        "date": day.isoformat(),
        "time": req.time,
        "customer_name": req.customer_name,
        "email": email,
        "price": price,
        "message": spoken,
    }


def _handle_send_confirmation(req: ConfirmationRequest, biz_id: str | None = None) -> dict:
    biz = _get_business_or_demo(biz_id)
    record = db.get_booking_by_code(req.confirmation_code.strip())
    if not record and biz["id"] == "biz_demo_dental":
        record = store.get(req.confirmation_code.strip())

    if not record:
        return {
            "ok": False,
            "reason": "unknown_code",
            "message": f"I couldn't find an appointment with confirmation code {req.confirmation_code}.",
        }

    result = _send_resend_confirmation(record, biz)
    if result.get("sent"):
        db.mark_booking_confirmation_sent(record["confirmation_code"])
        if biz["id"] == "biz_demo_dental":
            store.mark_confirmation_sent(record["confirmation_code"])
        return {
            "ok": True,
            "confirmation_code": record["confirmation_code"],
            "email": record.get("email"),
            "message": (
                f"I have sent an email confirmation with an attached calendar invite to {record.get('email')}. "
                "You can open the calendar file to automatically add it to your calendar."
            ),
        }
    return {
        "ok": True,
        "confirmation_code": record["confirmation_code"],
        "email": record.get("email"),
        "message": f"Your appointment is confirmed. Confirmation code is {record['confirmation_code']}.",
    }


# ---------------------------------------------------------------------------
# HTTP Tool Endpoints (Multi-Tenant & Root Legacy)
# ---------------------------------------------------------------------------

@app.post("/tools/{business_id}/get_today")
def tenant_get_today(business_id: str) -> dict:
    return _handle_get_today(business_id)


@app.post("/tools/{business_id}/check_availability")
def tenant_check_availability(business_id: str, req: AvailabilityRequest) -> dict:
    return _handle_check_availability(req, business_id)


@app.post("/tools/{business_id}/book_appointment")
def tenant_book_appointment(business_id: str, req: BookingRequest) -> dict:
    return _handle_book_appointment(req, business_id)


@app.post("/tools/{business_id}/send_confirmation")
def tenant_send_confirmation(business_id: str, req: ConfirmationRequest) -> dict:
    return _handle_send_confirmation(req, business_id)


# Root endpoints for demo / backward compatibility
@app.post("/tools/get_today")
def legacy_get_today() -> dict:
    return _handle_get_today("biz_demo_dental")


@app.post("/tools/check_availability")
def legacy_check_availability(req: AvailabilityRequest) -> dict:
    return _handle_check_availability(req, "biz_demo_dental")


@app.post("/tools/book_appointment")
def legacy_book_appointment(req: BookingRequest) -> dict:
    return _handle_book_appointment(req, "biz_demo_dental")


@app.post("/tools/send_confirmation")
def legacy_send_confirmation(req: ConfirmationRequest) -> dict:
    return _handle_send_confirmation(req, "biz_demo_dental")


# ---------------------------------------------------------------------------
# SaaS Owner Authentication & Business APIs
# ---------------------------------------------------------------------------

@app.post("/api/auth/owner")
def api_auth_owner(req: OwnerAuthRequest) -> dict:
    owner = db.get_or_create_owner(email=req.email, name=req.name)
    businesses = db.list_businesses_for_owner(owner["id"])
    return {"ok": True, "owner": owner, "businesses": businesses}


@app.get("/api/auth/session")
def api_auth_session(email: str = Query(default="demo@omnidesk.ai")) -> dict:
    owner = db.get_or_create_owner(email=email)
    businesses = db.list_businesses_for_owner(owner["id"])
    return {"ok": True, "owner": owner, "businesses": businesses}


@app.get("/api/owner/businesses")
def api_owner_businesses(owner_id: str = Query(...)) -> dict:
    businesses = db.list_businesses_for_owner(owner_id)
    return {"businesses": businesses}


@app.post("/api/owner/businesses")
def api_create_business(req: CreateBusinessRequest) -> dict:
    created = db.create_business(
        owner_id=req.owner_id,
        name=req.name,
        industry=req.industry,
        tone=req.tone,
        greeting=req.greeting,
        system_prompt=req.system_prompt,
        voice_id=req.voice_id,
        slot_minutes=req.slot_minutes,
        open_hour=req.open_hour,
        close_hour=req.close_hour,
        keyterms=req.keyterms,
        services=[s.dict() for s in req.services],
    )
    return {"ok": True, "business": created}


@app.put("/api/owner/businesses/{business_id}")
def api_update_business(business_id: str, req: UpdateBusinessRequest) -> dict:
    updates: dict[str, Any] = {}
    for k, v in req.dict(exclude_unset=True).items():
        if k == "services" and v is not None:
            updates["services"] = [s.dict() if hasattr(s, "dict") else s for s in v]
        elif v is not None:
            updates[k] = v

    updated = db.update_business(business_id, updates)
    if not updated:
        raise HTTPException(404, "Business not found")
    return {"ok": True, "business": updated}


@app.post("/api/owner/businesses/{business_id}/deploy")
def api_deploy_business_agent(business_id: str) -> dict:
    """Provision or update this tenant's custom voice agent with AssemblyAI Voice Agent API."""
    biz = db.get_business(business_id)
    if not biz:
        raise HTTPException(404, "Business not found")

    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        raise HTTPException(500, "ASSEMBLYAI_API_KEY is not set on the server")

    base_url = os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000").rstrip("/")

    # Build services prompt summary
    service_lines = []
    service_keys = []
    for s in biz.get("services", []):
        service_lines.append(f"- {s['label']} ({s['minutes']} mins, ${s.get('price', 0)}): {s.get('description', '')}")
        service_keys.append(s["key"])

    services_block = "\n".join(service_lines) if service_lines else "- General Appointment (30 mins)"
    if not service_keys:
        service_keys = ["general"]

    system_prompt = (
        f"{biz['system_prompt']}\n\n"
        f"Business Name: {biz['name']}\n"
        f"Operating Hours: Monday to Friday from {biz['open_hour']}:00 to {biz['close_hour']}:00 (30-minute slots).\n"
        f"Available Services & Pricing:\n{services_block}\n\n"
        f"Voice Persona & Tone: {biz['tone']}.\n\n"
        "Strict Execution Rules:\n"
        "1. Answer caller questions pleasantly and confirm what service they need.\n"
        "2. When they ask for a date or slot, ALWAYS call check_availability to confirm open slots before promising.\n"
        "3. Collect the caller's full name and their email address clearly.\n"
        "4. Call book_appointment with service, date, time, customer_name, and email.\n"
        "5. Call send_confirmation with the generated confirmation_code to email them the calendar invite (.ics).\n"
        "6. Do not invent confirmation codes or available slots."
    )

    tools_def = [
        {
            "name": "get_today",
            "description": "Returns current date, day of week, and upcoming open clinic days.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/get_today",
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
        },
        {
            "name": "check_availability",
            "description": "Check open appointment slots for a specific service and date (YYYY-MM-DD).",
            "http": {
                "url": f"{base_url}/tools/{business_id}/check_availability",
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {"type": "string", "enum": service_keys},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                },
                "required": ["service", "date"],
            },
        },
        {
            "name": "book_appointment",
            "description": "Reserve an appointment slot for a customer.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/book_appointment",
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {"type": "string", "enum": service_keys},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time": {"type": "string", "description": "HH:MM (24h)"},
                    "customer_name": {"type": "string"},
                    "email": {"type": "string"},
                },
                "required": ["service", "date", "time", "customer_name", "email"],
            },
        },
        {
            "name": "send_confirmation",
            "description": "Send confirmation email with calendar invite (.ics) to customer.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/send_confirmation",
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "confirmation_code": {"type": "string"},
                },
                "required": ["confirmation_code"],
            },
        },
    ]

    agent_definition = {
        "name": f"{biz['name']} Voice Receptionist",
        "voice": {
            "provider": "assemblyai",
            "voice_id": biz.get("voice_id", "131a436c-0fc4-4797-90f7-d0e515d18b06"),
        },
        "greeting": biz.get("greeting", f"Thanks for calling {biz['name']}. How can I help you today?"),
        "system_prompt": system_prompt,
        "keyterms": (biz.get("keyterms") or []) + [biz["name"]],
        "tools": tools_def,
    }

    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    agent_id = biz.get("assemblyai_agent_id")

    try:
        if agent_id:
            put_resp = httpx.put(f"{AGENTS_URL}/{agent_id}", headers=headers, json=agent_definition, timeout=30)
            if put_resp.status_code < 400:
                agent_id = put_resp.json().get("id", agent_id)
            else:
                post_resp = httpx.post(AGENTS_URL, headers=headers, json=agent_definition, timeout=30)
                post_resp.raise_for_status()
                agent_id = post_resp.json().get("id")
        else:
            post_resp = httpx.post(AGENTS_URL, headers=headers, json=agent_definition, timeout=30)
            post_resp.raise_for_status()
            agent_id = post_resp.json().get("id")
    except Exception as exc:
        raise HTTPException(502, f"Failed to provision agent on AssemblyAI: {exc}")

    db.update_business_agent_id(business_id, agent_id)
    updated_biz = db.get_business(business_id)
    return {"ok": True, "agent_id": agent_id, "business": updated_biz}


@app.get("/api/owner/businesses/{business_id}/token")
def api_business_token(business_id: str) -> dict:
    """Mint a short-lived token for testing this specific business's agent live in browser."""
    biz = db.get_business(business_id)
    if not biz:
        raise HTTPException(404, "Business not found")

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

    agent_id = biz.get("assemblyai_agent_id")
    if not agent_id:
        agent_id = os.getenv("AGENT_ID", "agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794")

    return {"token": resp.json()["token"], "agent_id": agent_id}


# ---------------------------------------------------------------------------
# Conversation History & Customer CRM Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/conversations/save")
def api_save_conversation(req: SaveConversationRequest) -> dict:
    saved = db.save_conversation(
        business_id=req.business_id,
        caller_name=req.caller_name,
        caller_email=req.caller_email,
        started_at=req.started_at,
        ended_at=req.ended_at,
        duration_seconds=req.duration_seconds,
        status=req.status,
        outcome=req.outcome,
        transcript=req.transcript,
        tool_calls=req.tool_calls,
    )
    return {"ok": True, "conversation": saved}


@app.get("/api/owner/businesses/{business_id}/conversations")
def api_get_conversations(business_id: str, limit: int = Query(default=50)) -> dict:
    conversations = db.list_conversations_for_business(business_id, limit=limit)
    return {"conversations": conversations}


@app.get("/api/owner/businesses/{business_id}/bookings")
def api_get_bookings(business_id: str) -> dict:
    bookings = db.list_bookings_for_business(business_id)
    return {"bookings": bookings}


# ---------------------------------------------------------------------------
# Legacy Demo & Stats Endpoints (Preserved for Demo Console)
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "services": sorted(store.SERVICES)}


@app.get("/api/owner-stats")
def api_owner_stats() -> dict:
    """Practice stats for the slide-over dashboard sheet in the demo."""
    all_appts = list(store._appointments.values())
    today_str = date.today().isoformat()
    today_appts = [a for a in all_appts if a["date"] == today_str]
    upcoming_appts = [a for a in all_appts if a["date"] > today_str]

    customer_map: dict[str, dict] = {}
    for a in all_appts:
        c_email = a.get("email", "")
        if not c_email:
            continue
        if c_email not in customer_map:
            customer_map[c_email] = {
                "name": a["customer_name"],
                "email": c_email,
                "appointments_count": 0,
                "last_service": a["service_label"],
                "last_date": a["date"],
            }
        customer_map[c_email]["appointments_count"] += 1
        if a["date"] > customer_map[c_email]["last_date"]:
            customer_map[c_email]["last_date"] = a["date"]
            customer_map[c_email]["last_service"] = a["service_label"]

    return {
        "today_bookings_count": len(today_appts),
        "upcoming_bookings_count": len(upcoming_appts),
        "total_bookings_count": len(all_appts),
        "estimated_revenue": sum(a.get("price", 0) for a in all_appts),
        "today_appointments": today_appts,
        "upcoming_appointments": upcoming_appts,
        "all_appointments": sorted(all_appts, key=lambda x: (x["date"], x["time"])),
        "customers": list(customer_map.values()),
        "services": [
            {"key": k, "label": v["label"], "minutes": v["minutes"], "price": v["price"], "description": v["description"]}
            for k, v in sorted(store.SERVICES.items())
        ],
        "business": {
            "name": "OmniDesk Dental Clinic",
            "hours": f"Monday to Friday, {_speak_time(f'{store.OPEN_HOUR:02d}:00')} – {_speak_time(f'{store.CLOSE_HOUR:02d}:00')}",
            "slot_minutes": store.SLOT_MINUTES,
            "voice_agent": "AssemblyAI Voice Agent API",
            "confirmation_engine": "Resend Email (.ics Calendar Invite)",
        },
    }


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


# ---------------------------------------------------------------------------
# Page Serving
# ---------------------------------------------------------------------------

@app.get("/console")
@app.get("/demo")
def serve_console():
    console_file = WEB_DIR / "console.html"
    if console_file.exists():
        return FileResponse(console_file)
    return FileResponse(WEB_DIR / "index.html")


@app.get("/dashboard")
@app.get("/builder")
def serve_dashboard():
    dashboard_file = WEB_DIR / "dashboard.html"
    if dashboard_file.exists():
        return FileResponse(dashboard_file)
    return FileResponse(WEB_DIR / "index.html")


if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
