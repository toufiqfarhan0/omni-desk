"""OmniDesk — multi-tenant voice receptionist API.

AssemblyAI's Voice Agent API calls these endpoints directly as HTTP tools.
Every response is shaped for a language model to read aloud. Failures carry
a sentence the agent can act on rather than an HTTP status code it cannot.

Phase 1 (live call): five HTTP tools answer instantly.
Phase 2 (post-call): /api/call-ended triggers async LeMUR + Discord dispatch.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.requests import Request
from starlette.responses import Response

from . import store
from .db import init_db
from .discord import send_dossier_embed, send_escalation_embed, send_test_embed
from .lemur import extract_dossier

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"

app = FastAPI(title="OmniDesk", version="2.0.0")

# Initialise the database schema and seed demo tenants on startup.
init_db()

E164_DIGITS = (8, 15)

# ---------------------------------------------------------------------------
# Middleware — log every /tools/* hit so the dashboard can display them live
# ---------------------------------------------------------------------------


@app.middleware("http")
async def record_tool_calls(request: Request, call_next):
    if not request.url.path.startswith("/tools/"):
        return await call_next(request)
    body = await request.body()
    response = await call_next(request)
    payload = b"".join([chunk async for chunk in response.body_iterator])

    # Detect tenant_id from request body if present
    import json as _json
    try:
        req_data = _json.loads(body or b"{}")
        tenant_id = req_data.get("tenant_id", "")
    except Exception:
        tenant_id = ""

    store.log_event(request.url.path, body, payload, tenant_id)

    return Response(
        content=payload,
        status_code=response.status_code,
        headers={k: v for k, v in response.headers.items() if k.lower() != "content-length"},
        media_type=response.media_type,
    )


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class AvailabilityRequest(BaseModel):
    service: str
    date: str
    tenant_id: str = Field(default="bright-dental")


class BookingRequest(BaseModel):
    service: str
    date: str
    time: str
    customer_name: str
    phone: str
    tenant_id: str = Field(default="bright-dental")


class ConfirmationRequest(BaseModel):
    confirmation_code: str
    tenant_id: str = Field(default="bright-dental")


class BusinessInfoRequest(BaseModel):
    topic: str
    tenant_id: str = Field(default="bright-dental")


class EscalationRequest(BaseModel):
    caller_name: str
    phone: str
    reason: str
    tenant_id: str = Field(default="bright-dental")


class CallEndedRequest(BaseModel):
    transcript: str = ""
    tenant_id: str = "bright-dental"
    caller_name: str = ""
    caller_phone: str = ""
    duration_s: int = 0


class TenantCreateRequest(BaseModel):
    id: str
    name: str
    persona: str = ""
    greeting: str = ""
    open_days: str = "Monday to Friday"
    open_hour: int = 9
    close_hour: int = 17
    slot_minutes: int = 30
    services: dict = {}
    faq: dict = {}
    discord_webhook: str = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_day(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _speak_time(value: str) -> str:
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


def _normalize_phone(raw: str) -> tuple[str | None, str]:
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


def _require_tenant(tenant_id: str) -> dict:
    tenant = store.get_tenant(tenant_id)
    if tenant is None:
        return store.get_tenant("bright-dental")
    return tenant


# ---------------------------------------------------------------------------
# HTTP Tools — called by AssemblyAI directly, zero dispatcher required
# ---------------------------------------------------------------------------


@app.post("/tools/get_today")
def get_today() -> dict:
    """The model has no clock. Without this it guesses dates."""
    today = date.today()
    # Use a generic tenant for next-days calculation (any tenant is fine here)
    tenant = store.get_tenant("bright-dental")
    upcoming = store.next_open_days(tenant, today - timedelta(days=1), count=3)
    return {
        "ok": True,
        "today": today.isoformat(),
        "weekday": today.strftime("%A"),
        "next_open_days": [
            {"date": d.isoformat(), "weekday": d.strftime("%A")} for d in upcoming
        ],
        "message": f"Today is {_speak_day(today)}.",
    }


@app.post("/tools/query_business_info")
def query_business_info(req: BusinessInfoRequest) -> dict:
    tenant = _require_tenant(req.tenant_id)
    faq: dict = tenant.get("faq", {})
    topic = req.topic.lower().strip()

    # Try exact key match first, then substring match
    answer = faq.get(topic)
    if not answer:
        for key, val in faq.items():
            if topic in key or key in topic:
                answer = val
                break

    if answer:
        return {
            "ok": True,
            "message": str(answer),
        }

    # Fallback: list available topics
    topics = ", ".join(faq.keys()) if faq else "none configured"
    return {
        "ok": False,
        "reason": "topic_not_found",
        "message": (
            f"I don't have specific information on that. "
            f"I can help with: {topics}. Would any of those help?"
        ),
    }


@app.post("/tools/check_availability")
def check_availability(req: AvailabilityRequest) -> dict:
    tenant = _require_tenant(req.tenant_id)
    services = tenant.get("services", {})

    if req.service not in services:
        offered = ", ".join(sorted(services.keys()))
        return {
            "ok": False,
            "reason": "unknown_service",
            "message": f"We don't offer '{req.service}'. We offer: {offered}.",
        }

    day = _parse_day(req.date)
    if day is None:
        return {"ok": False, "reason": "bad_date", "message": "Date must be in YYYY-MM-DD form."}
    if day < date.today():
        return {"ok": False, "reason": "past_date", "message": "That date is in the past."}

    if not store.is_open(tenant, day):
        alternatives = store.next_open_days(tenant, day)
        nxt = alternatives[0] if alternatives else None
        return {
            "ok": False,
            "reason": "closed",
            "suggested_date": nxt.isoformat() if nxt else None,
            "message": (
                f"We're closed on {day.strftime('%A')}s. "
                f"The next day we're open is {_speak_day(nxt)}, "
                f"with {_speak_slots(store.available_slots(tenant, nxt))}."
                if nxt else f"We're closed on {day.strftime('%A')}s."
            ),
        }

    slots = store.available_slots(tenant, day)
    if slots:
        return {
            "ok": True,
            "date": day.isoformat(),
            "slots": slots,
            "message": f"On {_speak_day(day)} we have {_speak_slots(slots)}.",
        }

    alternatives = store.next_open_days(tenant, day)
    if not alternatives:
        return {
            "ok": False,
            "reason": "fully_booked",
            "message": "We have nothing open in the next two weeks.",
        }
    alt = alternatives[0]
    alt_slots = store.available_slots(tenant, alt)
    return {
        "ok": False,
        "reason": "day_full",
        "suggested_date": alt.isoformat(),
        "suggested_slots": alt_slots,
        "message": (
            f"{_speak_day(day)} is fully booked. "
            f"The next opening is {_speak_day(alt)} at {_speak_slots(alt_slots)}."
        ),
    }


@app.post("/tools/book_appointment")
def book_appointment(req: BookingRequest) -> dict:
    tenant = _require_tenant(req.tenant_id)
    services = tenant.get("services", {})

    if req.service not in services:
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
                "country they're calling from, then send it in full — "
                "a Nigerian 0916 383 6950 becomes +2349163836950."
            ),
        }
    if problem:
        return {
            "ok": False,
            "reason": "bad_phone",
            "message": "That number doesn't look complete. Ask the caller to repeat it.",
        }

    # Guard against placeholder names/phones sent by the model when guessing
    if req.customer_name.lower() in {"unknown", "n/a", "", "caller", "customer"}:
        return {
            "ok": False,
            "reason": "missing_name",
            "message": "I still need the caller's full name before booking. Please ask them.",
        }

    try:
        record = store.book(tenant, req.service, day, req.time, req.customer_name, phone)
    except store.SlotUnavailable:
        slots = store.available_slots(tenant, day)
        return {
            "ok": False,
            "reason": "slot_taken",
            "slots": slots,
            "message": (
                f"That slot was just taken. Still open that day: {_speak_slots(slots)}."
                if slots else "That slot was just taken and the day is now full."
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


@app.post("/tools/escalate_urgent_issue")
async def escalate_urgent_issue(req: EscalationRequest) -> dict:
    tenant = _require_tenant(req.tenant_id)
    webhook = tenant.get("discord_webhook", "")
    if webhook:
        asyncio.create_task(
            send_escalation_embed(webhook, {
                "caller_name": req.caller_name,
                "phone": req.phone,
                "reason": req.reason,
            })
        )
    return {
        "ok": True,
        "message": (
            f"I've flagged this as urgent and alerted the team directly. "
            f"Someone will be in touch with you at {req.phone} as soon as possible."
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


# ---------------------------------------------------------------------------
# Post-call intelligence pipeline
# ---------------------------------------------------------------------------


@app.post("/api/call-ended")
async def call_ended(req: CallEndedRequest, background_tasks: BackgroundTasks) -> dict:
    """Browser fires this when session.end is sent. Triggers async LeMUR + Discord."""
    call_id = str(uuid.uuid4())
    background_tasks.add_task(
        _run_lemur_pipeline,
        transcript=req.transcript,
        tenant_id=req.tenant_id,
        caller_name=req.caller_name,
        caller_phone=req.caller_phone,
        call_id=call_id,
    )
    return {"ok": True, "call_id": call_id}


async def _run_lemur_pipeline(
    transcript: str,
    tenant_id: str,
    caller_name: str,
    caller_phone: str,
    call_id: str,
) -> None:
    tenant = store.get_tenant(tenant_id)
    if tenant is None:
        return
    tenant_name = tenant["name"]
    dossier = await extract_dossier(
        transcript=transcript,
        tenant_id=tenant_id,
        tenant_name=tenant_name,
        caller_name=caller_name,
        caller_phone=caller_phone,
        call_id=call_id,
    )
    store.save_dossier(dossier)
    webhook = tenant.get("discord_webhook", "")
    if webhook:
        await send_dossier_embed(webhook, dossier)


# ---------------------------------------------------------------------------
# Dashboard APIs
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/config")
def api_config() -> dict:
    agent_id_file = ROOT / "agent_id.txt"
    agent_id = os.getenv("AGENT_ID") or (
        agent_id_file.read_text(encoding="utf-8").strip() if agent_id_file.exists() else ""
    )
    tenants = store.list_tenants()
    return {"agent_id": agent_id, "tenants": tenants}


@app.get("/api/events")
def api_events(since: int = 0, tenant_id: str = "") -> dict:
    events = store.events_since(since, tenant_id or None)
    return {"events": events, "cursor": events[-1]["seq"] if events else since}


@app.get("/api/dossiers")
def api_dossiers(tenant_id: str = "") -> dict:
    return {"dossiers": store.list_dossiers(tenant_id or None)}


@app.get("/api/appointments")
def api_appointments(tenant_id: str = "") -> dict:
    return {"appointments": store.list_bookings(tenant_id or None)}


@app.get("/api/tenants")
def api_tenants() -> dict:
    return {"tenants": store.list_tenants()}


@app.post("/api/tenants")
def api_create_tenant(req: TenantCreateRequest) -> dict:
    tenant = store.upsert_tenant(req.model_dump())
    return {"ok": True, "tenant": tenant}


@app.put("/api/tenants/{tenant_id}")
def api_update_tenant(tenant_id: str, req: TenantCreateRequest) -> dict:
    data = req.model_dump()
    data["id"] = tenant_id
    tenant = store.upsert_tenant(data)
    return {"ok": True, "tenant": tenant}


@app.get("/api/tenants/{tenant_id}")
def api_get_tenant(tenant_id: str) -> dict:
    tenant = store.get_tenant(tenant_id)
    if tenant is None:
        raise HTTPException(404, f"Tenant '{tenant_id}' not found")
    return tenant


@app.post("/api/discord/test")
async def api_discord_test(body: dict) -> dict:
    webhook_url = body.get("webhook_url", "")
    if not webhook_url:
        raise HTTPException(400, "webhook_url is required")
    ok = await send_test_embed(webhook_url)
    return {"ok": ok}


@app.get("/api/token")
def api_token() -> dict:
    """Mint a short-lived AssemblyAI session token. The browser never sees the API key."""
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


@app.get("/api/demo-info")
def api_demo_info(tenant_id: str = "bright-dental") -> dict:
    """Everything the active tenant's agent knows, split by where it comes from."""
    import json as _json
    agent_json_path = ROOT / "agent.json"
    definition = _json.loads(agent_json_path.read_text(encoding="utf-8")) if agent_json_path.exists() else {}
    tenant = store.get_tenant(tenant_id) or store.get_tenant("bright-dental")
    services = tenant.get("services", {})

    days = []
    cursor = date.today()
    for _ in range(21):
        if len(days) >= 5:
            break
        slots = store.available_slots(tenant, cursor, limit=99)
        if store.is_open(tenant, cursor) and slots:
            days.append({
                "date": cursor.isoformat(),
                "label": _speak_day(cursor),
                "slots": [_speak_time(s) for s in slots],
                "total": len(slots),
            })
        cursor += timedelta(days=1)

    open_h = tenant.get("open_hour", 9)
    close_h = tenant.get("close_hour", 17)

    return {
        "agent": {
            "name": definition.get("name", "OmniDesk"),
            "voice": definition.get("voice", {}).get("voice_id", "alba"),
            "tools": [
                {"name": t["name"], "url": t["http"]["url"].rsplit("/", 1)[-1]}
                for t in definition.get("tools", [])
            ],
        },
        "tenant": {
            "id": tenant["id"],
            "name": tenant["name"],
            "open_days": tenant.get("open_days", "Monday to Friday"),
            "open": _speak_time(f"{open_h:02d}:00"),
            "close": _speak_time(f"{close_h:02d}:00"),
        },
        "services": [
            {"key": k, "label": v.get("label", k), "minutes": v.get("minutes", 30)}
            for k, v in sorted(services.items())
        ],
        "days": days,
    }


# Serve the frontend SPA from /web
if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
