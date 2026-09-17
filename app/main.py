"""Multi-tenant Booking API and SaaS Platform for AssemblyAI Voice Agents.

Features:
- Multi-tenant business workflows with dropdown presets and custom voice configurations
- Dynamic AssemblyAI Voice Agent provisioning & real-time modification
- Interactive live agent testing with AssemblyAI session tokens
- Call history logging & conversation transcript tracking
- Multi-tenant architecture supporting custom AI voice agents per business
- 100% backward compatible with the flagship hair salon receptionist demo (/console)
- Industry presets (Salon, MedSpa, Law Firm, Barber, Dental, Auto, Real Estate)
"""

from __future__ import annotations

import base64
import json
import os
import re
import socket
import logging
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger("omnidesk")

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
    industry: str = "salon"
    tone: str = "warm"
    greeting: str
    system_prompt: str
    voice_id: str = "alba"
    slot_minutes: int = 30
    open_hour: int = 9
    close_hour: int = 17
    operating_days: str = "mon-fri"
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
    operating_days: str | None = None
    keyterms: list[str] | None = None
    services: list[ServiceItem] | None = None


class SaveConversationRequest(BaseModel):
    business_id: str
    caller_name: str = ""
    caller_email: str = ""
    started_at: str = ""
    ended_at: str = ""
    duration_seconds: int = 0
    status: str = "completed"
    outcome: str = "inquiry"
    transcript: list[dict] = []
    tool_calls: list[dict] = []


class VerifyEmailRequest(BaseModel):
    email: str
    business_id: str | None = None


class VerifyCustomerEmailRequest(BaseModel):
    email: str


# ---------------------------------------------------------------------------
# Utility Helpers
# ---------------------------------------------------------------------------

COMMON_DOMAIN_FIXES = {
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmaik.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yaho.co": "yahoo.com",
    "yaho.con": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotmsil.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
    "outllook.com": "outlook.com",
    "iclud.com": "icloud.com",
    "icoud.com": "icloud.com",
    "icloud.con": "icloud.com",
    "protonmai.com": "protonmail.com",
    "protnmail.com": "protonmail.com",
}

COMMON_TLD_FIXES = {
    "con": "com",
    "cmo": "com",
    "comm": "com",
    "coom": "com",
    "ogr": "org",
    "nte": "net",
}

DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "throwawaymail.com",
    "yopmail.com",
    "sharklasers.com",
    "getairmail.com",
    "temp-mail.org",
    "fakeinbox.com",
    "trashmail.com",
    "dispostable.com",
}

_active_verified_emails: dict[str, str] = {}


def _check_abstract_reputation(email: str) -> dict | None:
    """Query Abstract API Email Reputation API for real-time mailbox existence & deliverability."""
    api_key = os.getenv("ABSTRACT_EMAIL_API_KEY") or os.getenv("ABSTRACT_API_KEY")
    if not api_key:
        return None
    try:
        resp = httpx.get(
            "https://emailreputation.abstractapi.com/v1/",
            params={"api_key": api_key, "email": email},
            timeout=5.0,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"Abstract API returned {resp.status_code}: {resp.text}")
    except Exception as exc:
        logger.warning(f"Abstract API check error: {exc}")
    return None


def _validate_and_verify_email(raw: str, biz_id: str | None = None) -> dict:
    """Multi-stage email verification:
    1. Spoken and written format sanitization
    2. RFC 5322 structure and character checks
    3. Common domain & TLD typo auto-correction
    4. Disposable/temporary domain blocking
    5. Real-time DNS host verification
    6. Active session caching
    """
    cleaned = raw.strip()
    if not cleaned:
        return {"ok": False, "valid": False, "reason": "empty", "message": "Email address cannot be empty."}

    # Normalize spoken patterns: "alex dot smith at gmail dot com"
    s = cleaned.lower()
    s = re.sub(r"\s+at\s+", "@", s)
    s = re.sub(r"\s+dot\s+", ".", s)
    s = re.sub(r"\s+underscore\s+", "_", s)
    s = re.sub(r"\s+dash\s+|\s+hyphen\s+", "-", s)
    s = re.sub(r"\s+", "", s)

    if "@" not in s or s.count("@") != 1:
        return {
            "ok": False,
            "valid": False,
            "reason": "missing_at",
            "message": "Email address must contain exactly one '@' symbol (e.g. name@gmail.com).",
        }

    user_part, domain_part = s.split("@", 1)
    if not user_part:
        return {"ok": False, "valid": False, "reason": "missing_user", "message": "Missing username before '@' in email address."}
    if not domain_part or "." not in domain_part:
        return {"ok": False, "valid": False, "reason": "missing_domain", "message": "Missing domain in email address (e.g. @gmail.com)."}

    # Username checks: cannot start or end with dot, no consecutive dots
    if user_part.startswith(".") or user_part.endswith(".") or ".." in user_part:
        return {"ok": False, "valid": False, "reason": "invalid_user", "message": "Email username cannot start, end with, or contain consecutive dots."}

    auto_fixed = False
    original_input = cleaned

    # Check common domain typos
    if domain_part in COMMON_DOMAIN_FIXES:
        domain_part = COMMON_DOMAIN_FIXES[domain_part]
        s = f"{user_part}@{domain_part}"
        auto_fixed = True
    else:
        # Check TLD typos
        parts = domain_part.split(".")
        tld = parts[-1]
        if tld in COMMON_TLD_FIXES:
            parts[-1] = COMMON_TLD_FIXES[tld]
            domain_part = ".".join(parts)
            s = f"{user_part}@{domain_part}"
            auto_fixed = True

    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(pattern, s):
        return {"ok": False, "valid": False, "reason": "invalid_chars", "message": "Email address contains invalid characters."}

    tld = domain_part.split(".")[-1]
    if len(tld) < 2 or not tld.isalpha():
        return {"ok": False, "valid": False, "reason": "invalid_tld", "message": "Please enter a valid domain extension (e.g. .com, .org)."}

    # Check disposable emails
    if domain_part in DISPOSABLE_EMAIL_DOMAINS:
        return {
            "ok": False,
            "valid": False,
            "reason": "disposable",
            "message": "Temporary or disposable email addresses are not accepted. Please provide a standard email address to receive your calendar invite.",
        }

    # Live DNS host resolution check
    dns_verified = True
    if domain_part not in {"localhost", "example.com", "test.com"}:
        try:
            socket.setdefaulttimeout(2.5)
            socket.getaddrinfo(domain_part, None)
        except socket.gaierror:
            return {
                "ok": False,
                "valid": False,
                "reason": "domain_not_found",
                "message": f"The domain '@{domain_part}' does not exist on the internet. Please check for a spelling mistake.",
            }
        except Exception:
            dns_verified = False

    # 6. Live Mailbox Existence & Deliverability Check via Abstract API
    mailbox_verified = False
    rep = _check_abstract_reputation(s)
    if rep:
        deliverability = rep.get("email_deliverability", {})
        status = str(deliverability.get("status", "")).lower()
        detail = str(deliverability.get("status_detail", "")).lower()
        is_smtp_valid = deliverability.get("is_smtp_valid")
        quality = rep.get("email_quality", {})
        is_disposable = quality.get("is_disposable")

        if is_disposable:
            return {
                "ok": False,
                "valid": False,
                "reason": "disposable",
                "message": "Temporary or disposable email addresses are not accepted. Please provide a standard personal or work email address.",
            }

        if status == "undeliverable" or detail == "invalid_mailbox" or is_smtp_valid is False:
            return {
                "ok": False,
                "valid": False,
                "reason": "invalid_mailbox",
                "message": f"The email address '{s}' does not appear to exist or cannot receive mail. Please check for a spelling mistake and provide an active email.",
            }

        if status == "deliverable" or is_smtp_valid is True:
            mailbox_verified = True

        suggested = rep.get("suggested_correction")
        if suggested and suggested.lower() != s.lower():
            s = suggested.lower()
            auto_fixed = True

    # Check if this caller has an active verified email that matches
    biz_key = biz_id or "default"
    active_email = _active_verified_emails.get(biz_key) or _active_verified_emails.get("default")
    if active_email and (active_email == s or active_email in s or s in active_email or active_email.split("@")[0] in s):
        s = active_email

    _active_verified_emails[biz_key] = s
    _active_verified_emails["default"] = s
    try:
        db.set_active_verified_email(biz_key, s)
    except Exception:
        pass

    return {
        "ok": True,
        "valid": True,
        "email": s,
        "domain": domain_part,
        "auto_corrected": auto_fixed,
        "original": original_input,
        "dns_verified": dns_verified,
        "mailbox_verified": mailbox_verified,
        "message": f"Email verified: {s}",
    }


def _normalize_email(raw: str, biz_id: str | None = None) -> tuple[str | None, str]:
    """Sanitize and validate spoken or transcribed email address, with typo correction."""
    biz_key = biz_id or "default"
    active_email = (
        _active_verified_emails.get(biz_key)
        or _active_verified_emails.get("default")
        or db.get_active_verified_email(biz_key)
    )

    # If caller/agent passed 'unknown' or empty, but we already have an active verified email, use it!
    if (not raw or raw.strip().lower() in ("unknown", "unknown@unknown.com", "none", "null")) and active_email:
        return active_email, ""

    res = _validate_and_verify_email(raw, biz_id=biz_id)
    if res["ok"]:
        return res["email"], ""

    # Fallback to active verified email if available for this session
    if active_email:
        return active_email, ""

    return None, res.get("reason", "bad_email")


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
        "name": "OmniDesk Hair Salon & Studio",
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
    day_str = record.get("date") or record.get("appointment_date", "")
    time_str = record.get("time") or record.get("appointment_time", "")
    service_label = record.get("service_label", "Appointment")
    name = record.get("customer_name", "Valued Client")
    code = record.get("confirmation_code", "")
    biz_name = biz["name"] if biz else "OmniDesk Hair Salon & Studio"
    biz_id = biz["id"] if biz else "salon"

    minutes = 30
    s_key = record.get("service") or record.get("service_key")
    if biz and "services" in biz:
        for s in biz["services"]:
            if s.get("key") == s_key:
                minutes = s.get("minutes", 30)
                break
    elif s_key in store.SERVICES:
        minutes = store.SERVICES[s_key]["minutes"]

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
        logger.error("RESEND_API_KEY is not configured")
        return {"sent": False, "reason": "no_api_key"}

    from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    to_email = record.get("email") or record.get("customer_email")
    if not to_email:
        active_email = db.get_active_verified_email(biz.get("id") if biz else "default")
        if active_email:
            to_email = active_email

    if not to_email:
        logger.error(f"Cannot send Resend email: record has no email address: {record}")
        return {"sent": False, "reason": "no_email"}

    biz_name = biz["name"] if biz else "OmniDesk Hair Salon & Studio"
    service_label = record.get("service_label", "Appointment")
    name = record.get("customer_name", "Valued Client")
    day_str = record.get("date") or record.get("appointment_date", "")
    time_str = record.get("time") or record.get("appointment_time", "")
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

        # Handle Resend free tier sandbox restriction (403 on external emails when using onboarding@resend.dev)
        if resp.status_code == 403 and "only send testing emails to your own email address" in resp.text:
            owner_email = "toufiqfarhan0@gmail.com"
            match = re.search(r"\(([^)]+@[^)]+)\)", resp.text)
            if match:
                owner_email = match.group(1).strip()
            
            logger.info(f"Resend sandbox restriction active. Forwarding calendar invite for '{to_email}' to owner '{owner_email}'.")
            sandbox_banner = f"""<div style="background:#fef3c7; border:1px solid #f59e0b; padding:12px 16px; border-radius:8px; font-size:13px; color:#92400e; margin-bottom:20px;">
  <strong>Resend Sandbox Notice:</strong> This appointment was scheduled for <strong>{to_email}</strong>. In Resend development mode (<code>onboarding@resend.dev</code>), test emails can only be delivered to your registered email (<code>{owner_email}</code>). A native <code>.ics</code> calendar invite is attached below. To send directly to customer emails, verify your domain at <a href="https://resend.com/domains" style="color:#b45309; text-decoration:underline;">resend.com/domains</a>.
</div>"""
            forwarded_html = html_content.replace('<div style="padding: 28px;">', f'<div style="padding: 28px;">\n{sandbox_banner}')
            resp_fallback = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"{biz_name} <{from_email}>",
                    "to": [owner_email],
                    "subject": f"[Dev Test for {to_email}] Appointment Confirmed: {service_label} - {biz_name}",
                    "html": forwarded_html,
                    "attachments": [
                        {
                            "filename": "appointment.ics",
                            "content": ics_b64,
                        }
                    ],
                },
                timeout=10,
            )
            if resp_fallback.status_code in (200, 201):
                return {"sent": True, "id": resp_fallback.json().get("id"), "sandbox_fallback": True, "delivered_to": owner_email}

        return {"sent": False, "reason": resp.text}
    except Exception as exc:
        return {"sent": False, "reason": str(exc)}


# ---------------------------------------------------------------------------
# Multi-Tenant Slot & Booking Core Logic
# ---------------------------------------------------------------------------

def _biz_is_open_day(biz: dict, day: date) -> bool:
    op_days = biz.get("operating_days", "mon-fri")
    wd = day.weekday()  # Monday=0, Sunday=6
    if op_days == "all-week":
        return True
    elif op_days == "mon-sat":
        return wd <= 5
    elif op_days == "tue-sat":
        return 1 <= wd <= 5
    elif op_days == "thu-sun":
        return wd in (3, 4, 5, 6)
    else:  # "mon-fri"
        return wd < 5


def _biz_slots(biz: dict, day: date) -> list[str]:
    try:
        open_h = int(biz.get("open_hour", 9))
    except (ValueError, TypeError):
        open_h = 9
    try:
        close_h = int(biz.get("close_hour", 17))
    except (ValueError, TypeError):
        close_h = 17
    try:
        step = int(biz.get("slot_minutes", 30))
    except (ValueError, TypeError):
        step = 30
    if step <= 0:
        step = 30

    start_min = open_h * 60
    end_min = (24 if close_h in (0, 24) else close_h) * 60
    if end_min <= start_min:
        end_min = 24 * 60

    slots = []
    curr = start_min
    while curr < end_min:
        h = (curr // 60) % 24
        m = curr % 60
        slots.append(f"{h:02d}:{m:02d}")
        curr += step
    return slots


def _biz_available_slots(biz: dict, day: date, limit: int = 4) -> list[str]:
    if not _biz_is_open_day(biz, day):
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
        if _biz_is_open_day(biz, cursor) and _biz_available_slots(biz, cursor):
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

    if not _biz_is_open_day(biz, day):
        alternatives = _biz_next_open_days(biz, day)
        nxt = alternatives[0] if alternatives else None
        return {
            "ok": False,
            "reason": "closed",
            "suggested_date": nxt.isoformat() if nxt else None,
            "message": (
                f"We are closed on that day. The next day we're open is "
                f"{_speak_day(nxt)}, with {_speak_slots(_biz_available_slots(biz, nxt))}."
                if nxt else "We are closed on that day."
            ),
        }

    service_info = services_map.get(req.service, {})
    service_label = service_info.get("label", req.service.capitalize())
    price = service_info.get("price", 0.0)
    minutes = service_info.get("minutes", 30)

    slots = _biz_available_slots(biz, day)
    if slots:
        return {
            "ok": True,
            "date": day.isoformat(),
            "service": service_label,
            "price": price,
            "duration_minutes": minutes,
            "slots": slots,
            "message": f"On {_speak_day(day)} for {service_label} (${price}, {minutes} mins), we have open times at {_speak_slots(slots)}.",
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
            f"{_speak_day(day)} is fully booked for {service_label}. "
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

    email, problem = _normalize_email(req.email, biz_id=biz["id"])
    if problem:
        active_email = (
            _active_verified_emails.get(biz["id"])
            or _active_verified_emails.get("default")
            or db.get_active_verified_email(biz["id"])
        )
        if active_email:
            email = active_email
            problem = ""
        else:
            return {
                "ok": False,
                "reason": "bad_email",
                "message": "That email address doesn't look valid. Could you please confirm your email address clearly?",
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


@app.post("/tools/{business_id}/get_services_and_pricing")
def tenant_get_services_and_pricing(business_id: str) -> dict:
    biz = _get_business_or_demo(business_id)
    services = biz.get("services", [])
    pricing_list = [
        f"{s['label']} (${s.get('price', 0)}, {s.get('minutes', 30)} mins): {s.get('description', '')}"
        for s in services
    ]
    return {
        "ok": True,
        "business": biz["name"],
        "services": services,
        "message": f"Our available services and pricing are: {'; '.join(pricing_list)}.",
    }


@app.post("/tools/get_services_and_pricing")
def legacy_get_services_and_pricing() -> dict:
    return tenant_get_services_and_pricing("biz_demo_dental")


@app.post("/tools/{business_id}/verify_customer_email")
def tenant_verify_customer_email(business_id: str, req: VerifyCustomerEmailRequest) -> dict:
    res = _validate_and_verify_email(req.email, biz_id=business_id)
    if res["ok"]:
        return {
            "ok": True,
            "valid": True,
            "email": res["email"],
            "auto_corrected": res.get("auto_corrected", False),
            "message": f"Email verified: {res['email']}. Please confirm this with the caller.",
        }
    msg = res.get("message", "").rstrip(".")
    return {
        "ok": False,
        "valid": False,
        "reason": res.get("reason", "bad_email"),
        "message": f"{msg}. Please ask the caller to clarify or provide their correct email address.",
    }


@app.post("/tools/verify_customer_email")
def legacy_verify_customer_email(req: VerifyCustomerEmailRequest) -> dict:
    return tenant_verify_customer_email("biz_demo_dental", req)


@app.post("/api/verify-email")
def api_verify_email(req: VerifyEmailRequest) -> dict:
    return _validate_and_verify_email(req.email, biz_id=req.business_id)


@app.post("/api/verify-email/reset")
def api_verify_email_reset(req: VerifyEmailRequest) -> dict:
    biz_id = req.business_id or "default"
    _active_verified_emails.pop(biz_id, None)
    _active_verified_emails.pop("default", None)
    try:
        db.clear_active_verified_email(biz_id)
    except Exception:
        pass
    return {"ok": True, "message": "Cleared session verified email."}




# ---------------------------------------------------------------------------
# SaaS Owner Authentication & Business APIs
# ---------------------------------------------------------------------------

@app.post("/api/auth/owner")
def api_auth_owner(req: OwnerAuthRequest) -> dict:
    owner = db.get_or_create_owner(email=req.email, name=req.name)
    businesses = db.list_businesses_for_owner(owner["id"])
    if not businesses and owner["id"] != "owner_demo":
        # Create an initial starter business for this new owner so their dashboard is ready
        biz_name = f"{owner['name']}'s Salon & Studio" if owner.get("name") else "My Business Studio"
        starter = db.create_business(
            owner_id=owner["id"],
            name=biz_name,
            industry="salon",
            tone="warm",
            greeting=f"Thanks for calling {biz_name}. Are you looking to book a haircut, styling, or coloring appointment today?",
            system_prompt=f"You are an autonomous receptionist for {biz_name}. You speak in a warm, welcoming tone. You answer questions about salon services, check real calendar slots using your tools, and book appointments for clients.",
            voice_id="alba",
            slot_minutes=30,
            open_hour=9,
            close_hour=17,
            operating_days="mon-fri",
            keyterms=[biz_name, "appointment", "booking", "haircut", "styling", "balayage", "coloring"],
            services=[
                {"key": "haircut", "label": "Signature Haircut & Styling", "minutes": 45, "price": 85.0, "description": "Custom consultation, precision cut, wash, and luxury blowout."},
                {"key": "coloring", "label": "Full Color & Gloss", "minutes": 90, "price": 185.0, "description": "All-over single process coloring, custom formulation, and blowout."},
                {"key": "balayage", "label": "Artisan Balayage & Highlights", "minutes": 120, "price": 280.0, "description": "Hand-painted dimensional highlights, toner formulation, and style."},
            ],
        )
        businesses = [starter]
    return {"ok": True, "owner": owner, "businesses": businesses}


@app.get("/api/auth/session")
def api_auth_session(email: str = Query(default="demo@omnidesk.ai")) -> dict:
    owner = db.get_or_create_owner(email=email)
    businesses = db.list_businesses_for_owner(owner["id"])
    if not businesses and owner["id"] != "owner_demo":
        biz_name = f"{owner['name']}'s Salon & Studio" if owner.get("name") else "My Business Studio"
        starter = db.create_business(
            owner_id=owner["id"],
            name=biz_name,
            industry="salon",
            tone="warm",
            greeting=f"Thanks for calling {biz_name}. Are you looking to book a haircut, styling, or coloring appointment today?",
            system_prompt=f"You are an autonomous receptionist for {biz_name}. You speak in a warm, welcoming tone. You answer questions about salon services, check real calendar slots using your tools, and book appointments for clients.",
            voice_id="alba",
            slot_minutes=30,
            open_hour=9,
            close_hour=17,
            operating_days="mon-fri",
            keyterms=[biz_name, "appointment", "booking", "haircut", "styling", "balayage", "coloring"],
            services=[
                {"key": "haircut", "label": "Signature Haircut & Styling", "minutes": 45, "price": 85.0, "description": "Custom consultation, precision cut, wash, and luxury blowout."},
                {"key": "coloring", "label": "Full Color & Gloss", "minutes": 90, "price": 185.0, "description": "All-over single process coloring, custom formulation, and blowout."},
                {"key": "balayage", "label": "Artisan Balayage & Highlights", "minutes": 120, "price": 280.0, "description": "Hand-painted dimensional highlights, toner formulation, and style."},
            ],
        )
        businesses = [starter]
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
        operating_days=req.operating_days,
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

    # Build comprehensive services & pricing menu
    days_map = {
        "mon-fri": "Monday through Friday (5 days a week)",
        "mon-sat": "Monday through Saturday (6 days a week)",
        "all-week": "Monday through Sunday (All 7 days a week, including weekends)",
    }
    days_label = days_map.get(biz.get("operating_days", "mon-fri"), "Monday through Friday")
    slot_mins = biz.get("slot_minutes", 30)
    open_str = _speak_time(f"{biz.get('open_hour', 9):02d}:00")
    close_str = _speak_time(f"{biz.get('close_hour', 17):02d}:00")

    pricing_lines = []
    service_keys = []
    for s in biz.get("services", []):
        k = s.get("key") or s.get("label", "").lower().replace(" ", "_")
        service_keys.append(k)
        p = s.get("price", 0)
        m = s.get("minutes", 30)
        desc = f" — {s['description']}" if s.get("description") else ""
        pricing_lines.append(f"• {s['label']} (${p}, {m} minutes){desc}")

    if not service_keys:
        service_keys = ["general"]
        pricing_lines = ["• General Consultation: $50 (30 minutes)"]

    services_block = "\n".join(pricing_lines)

    system_prompt = (
        f"You are the autonomous voice receptionist for {biz['name']}.\n\n"
        f"{biz['system_prompt']}\n\n"
        f"BUSINESS DETAILS & CALENDAR:\n"
        f"• Business Name: {biz['name']}\n"
        f"• Operating Days: {days_label}\n"
        f"• Business Hours: {open_str} to {close_str} ({slot_mins}-minute booking slots)\n\n"
        f"OFFICIAL SERVICES & PRICING MENU:\n"
        f"{services_block}\n\n"
        "STRICT EXECUTION & CONVERSATIONAL RULES:\n"
        "1. PRICING & INQUIRIES: When a caller asks about prices, fees, costs, or what services are offered, ALWAYS answer immediately and clearly with the exact price and duration directly from the OFFICIAL SERVICES & PRICING MENU above (e.g., 'Our Signature Haircut & Styling is $85 for 45 minutes', 'Full Color & Gloss is $185'). Never say you do not know the price or that pricing is unavailable. All official prices are listed on your menu above.\n"
        "2. DATES & CALENDAR: You have no internal clock. When the caller mentions any date or day ('today', 'tomorrow', 'Friday', 'next week'), ALWAYS call get_today first to understand the current date, and ALWAYS call check_availability to see real open slots before offering times.\n"
        "3. AVAILABILITY: Only offer open slots that check_availability returns.\n"
        "4. CALLER DETAILS & EMAIL: Collect the caller's full name, then their email address. When the caller states or types their email, immediately accept it, call verify_customer_email, and ask: 'I have your email as <email>, is that correct?' and wait for their confirmation. If they say no, apologize and ask for their email again. Never call book_appointment before the caller confirms their email address.\n"
        "5. BOOKING: Once the caller confirms their email address and you have service, date, time, and full name, immediately call book_appointment with those exact parameters. Never call book_appointment with 'unknown' or a guessed email.\n"
        "6. CONFIRMATION & CALENDAR INVITE: Immediately after book_appointment succeeds, call send_confirmation with the generated confirmation_code to email them the calendar invite (.ics). Then let the customer know that their appointment is booked and their calendar invite has been sent to their email.\n"
        "7. ACCURACY: Do not invent confirmation codes, prices, or unavailable slots."
    )

    tools_def = [
        {
            "name": "get_today",
            "description": "Returns current date, day of week, and upcoming open clinic days. Call this before interpreting any relative day the caller mentions.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/get_today",
                "http_method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
        {
            "name": "get_services_and_pricing",
            "description": "Returns the complete catalog of offered services, appointment durations, and exact prices. Call this whenever a customer asks about prices, fees, costs, or available services.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/get_services_and_pricing",
                "http_method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
        {
            "name": "verify_customer_email",
            "description": "Verifies whether the customer's email address is valid, correctly formatted, and has an existing domain on the internet. Call this whenever the caller gives their email address.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/verify_customer_email",
                "http_method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {"type": "string", "description": "The customer's email address as heard or spelled."},
                },
                "required": ["email"],
            },
        },
        {
            "name": "check_availability",
            "description": "Check open appointment slots and pricing for a specific service and date (YYYY-MM-DD).",
            "http": {
                "url": f"{base_url}/tools/{business_id}/check_availability",
                "http_method": "POST",
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
            "description": "Reserve an appointment slot for a customer. Only call when you have confirmed service, date, time, customer_name, and valid email.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/book_appointment",
                "http_method": "POST",
                "headers": {"Content-Type": "application/json"},
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {"type": "string", "enum": service_keys},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time": {"type": "string", "description": "HH:MM (24h)"},
                    "customer_name": {"type": "string"},
                    "email": {
                        "type": "string",
                        "format": "email",
                        "description": "Valid customer email address (e.g. name@gmail.com). Never call with unknown.",
                        "examples": ["farhan@gmail.com", "client@example.com"],
                    },
                },
                "required": ["service", "date", "time", "customer_name", "email"],
            },
        },
        {
            "name": "send_confirmation",
            "description": "Send confirmation email with calendar invite (.ics) to customer.",
            "http": {
                "url": f"{base_url}/tools/{business_id}/send_confirmation",
                "http_method": "POST",
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

    raw_voice = biz.get("voice_id", "alba")
    voice_map = {
        "131a436c-0fc4-4797-90f7-d0e515d18b06": "alba",
        "098b63e0-3273-47a2-9694-de982d618991": "george",
        "b7d50908-b17c-442d-ad8d-810c63997ed9": "jane",
        "79a125e8-cd45-4c13-8a67-188112f4dd22": "eve",
    }
    voice_id = voice_map.get(raw_voice, raw_voice) or "alba"

    agent_definition = {
        "name": f"{biz['name']} Voice Receptionist",
        "voice": {
            "voice_id": voice_id,
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

    # Synchronize agent_id.txt so demo console immediately uses the newly deployed agent
    try:
        Path("agent_id.txt").write_text(agent_id, encoding="utf-8")
    except Exception:
        pass

    # Synchronize agent.json for repository alignment
    try:
        agent_json_file = Path("agent.json")
        if agent_json_file.exists():
            agent_json_data = json.loads(agent_json_file.read_text(encoding="utf-8"))
            agent_json_data["name"] = f"{biz['name']} Scheduler"
            agent_json_data["greeting"] = biz.get("greeting", "")
            agent_json_data["system_prompt"] = system_prompt
            agent_json_data["keyterms"] = (biz.get("keyterms") or []) + [biz["name"]]
            agent_json_file.write_text(json.dumps(agent_json_data, indent=2), encoding="utf-8")
    except Exception:
        pass

    # Synchronize store.py in-memory variables and demo tenant
    try:
        store.OPEN_HOUR = biz.get("open_hour", 9)
        store.CLOSE_HOUR = biz.get("close_hour", 17)
        store.SLOT_MINUTES = biz.get("slot_minutes", 30)
        new_services = {}
        for s in biz.get("services", []):
            new_services[s["key"]] = {
                "label": s["label"],
                "minutes": s.get("minutes", 30),
                "price": s.get("price", 0),
                "description": s.get("description", ""),
            }
        if new_services:
            store.SERVICES = new_services
    except Exception:
        pass

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


@app.post("/api/owner/businesses/{business_id}/bookings/{confirmation_code}/send-invite")
def api_send_booking_invite(business_id: str, confirmation_code: str) -> dict:
    """Manually dispatch calendar invite email via Resend from the dashboard."""
    return _handle_send_confirmation(ConfirmationRequest(confirmation_code=confirmation_code), business_id)


@app.post("/api/owner/bookings/{confirmation_code}/send-invite")
def api_send_booking_invite_root(confirmation_code: str) -> dict:
    """Legacy/global dispatch endpoint."""
    return _handle_send_confirmation(ConfirmationRequest(confirmation_code=confirmation_code), "biz_demo_dental")


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
            "name": "OmniDesk Hair Salon & Studio",
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
    definition = {}
    try:
        definition = json.loads((ROOT / "agent.json").read_text(encoding="utf-8"))
    except Exception:
        pass
    return {
        "agent_id": agent_id,
        "services": sorted(store.SERVICES),
        "system_prompt": definition.get("system_prompt", ""),
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", ""),
    }


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
    no_cache = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    if console_file.exists():
        return FileResponse(console_file, headers=no_cache)
    return FileResponse(WEB_DIR / "index.html", headers=no_cache)


@app.get("/dashboard")
@app.get("/builder")
def serve_dashboard():
    dashboard_file = WEB_DIR / "dashboard.html"
    no_cache = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    if dashboard_file.exists():
        return FileResponse(dashboard_file, headers=no_cache)
    return FileResponse(WEB_DIR / "index.html", headers=no_cache)


if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
