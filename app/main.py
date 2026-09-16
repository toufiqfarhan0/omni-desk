"""Booking API for the AssemblyAI voice scheduling agent.

AssemblyAI's Voice Agent API calls these endpoints directly as HTTP tools.
Every response is shaped for a language model to read aloud: short, literal,
and explicit about failure so the agent can recover mid-call instead of
inventing an answer.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.responses import Response

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
    phone: str


class ConfirmationRequest(BaseModel):
    confirmation_code: str


def _normalize_phone(raw: str) -> tuple[str | None, str]:
    """Return (e164, problem). A national number is a question, not an error."""
    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch == "+")
    lo, hi = E164_DIGITS

    if cleaned.startswith("+"):
        digits = cleaned[1:]
        if digits.isdigit() and lo <= len(digits) <= hi and not digits.startswith("0"):
            return "+" + digits, ""
        return None, "incomplete"

    digits = cleaned.lstrip("0")
    if digits.isdigit() and lo <= len(digits) <= hi:
        return None, "needs_country"
    return None, "incomplete"


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

    phone, problem = _normalize_phone(req.phone)
    if problem == "needs_country":
        return {
            "ok": False,
            "reason": "needs_country_code",
            "message": (
                "I have the number but not the country code. Ask the caller which "
                "country they're calling from, then send it in full — a Nigerian "
                "0916 383 6950 becomes +2349163836950."
            ),
        }
    if problem:
        return {
            "ok": False,
            "reason": "bad_phone",
            "message": "That number doesn't look complete. Ask the caller to repeat it.",
        }

    try:
        record = store.book(req.service, day, req.time, req.customer_name, phone)
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
    return {
        "ok": True,
        "message": f"Confirmation sent to {record['phone']}.",
    }


@app.get("/appointments")
def list_appointments() -> dict:
    return {"appointments": list(store._appointments.values())}


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


if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
