"""Multi-tenant store for OmniDesk.

All booking and availability logic reads tenant configuration from SQLite,
so the same agent.json serves every registered business without redeployment.
"""

from __future__ import annotations

import json
import random
import string
from datetime import date, datetime, timedelta
from typing import Optional

from .db import get_conn

# ---------------------------------------------------------------------------
# Tenant helpers
# ---------------------------------------------------------------------------


def get_tenant(tenant_id: str) -> Optional[dict]:
    row = get_conn().execute(
        "SELECT * FROM tenants WHERE id = ?", (tenant_id,)
    ).fetchone()
    if row is None:
        return None
    d = dict(row)
    d["services"] = json.loads(d["services"])
    d["faq"] = json.loads(d["faq"])
    return d


def list_tenants() -> list[dict]:
    rows = get_conn().execute(
        "SELECT id, name, greeting, open_days, open_hour, close_hour, slot_minutes, services, discord_webhook "
        "FROM tenants ORDER BY name"
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["services"] = json.loads(d["services"])
        result.append(d)
    return result


def upsert_tenant(data: dict) -> dict:
    conn = get_conn()
    conn.execute(
        """INSERT INTO tenants
           (id, name, persona, greeting, open_days, open_hour, close_hour,
            slot_minutes, services, faq, discord_webhook)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name, persona=excluded.persona,
             greeting=excluded.greeting, open_days=excluded.open_days,
             open_hour=excluded.open_hour, close_hour=excluded.close_hour,
             slot_minutes=excluded.slot_minutes, services=excluded.services,
             faq=excluded.faq, discord_webhook=excluded.discord_webhook""",
        (
            data["id"], data["name"], data.get("persona", ""),
            data.get("greeting", ""), data.get("open_days", "Monday to Friday"),
            int(data.get("open_hour", 9)), int(data.get("close_hour", 17)),
            int(data.get("slot_minutes", 30)),
            json.dumps(data.get("services", {})),
            json.dumps(data.get("faq", {})),
            data.get("discord_webhook", ""),
        ),
    )
    conn.commit()
    return get_tenant(data["id"])


# ---------------------------------------------------------------------------
# Calendar / slot helpers (per-tenant)
# ---------------------------------------------------------------------------

_WEEKDAY_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}

_OPEN_DAYS_CACHE: dict[str, set[int]] = {}


def _open_weekdays(tenant: dict) -> set[int]:
    key = tenant["id"]
    if key not in _OPEN_DAYS_CACHE:
        # Parse "Monday to Friday" or "Monday to Saturday"
        days_str = tenant.get("open_days", "Monday to Friday")
        parts = [p.strip() for p in days_str.split("to")]
        if len(parts) == 2:
            start = _WEEKDAY_MAP.get(parts[0], 0)
            end = _WEEKDAY_MAP.get(parts[1], 4)
            _OPEN_DAYS_CACHE[key] = set(range(start, end + 1))
        else:
            _OPEN_DAYS_CACHE[key] = {0, 1, 2, 3, 4}
    return _OPEN_DAYS_CACHE[key]


def is_open(tenant: dict, day: date) -> bool:
    return day.weekday() in _open_weekdays(tenant)


def _slots_for_day(tenant: dict, day: date) -> list[str]:
    open_h = tenant.get("open_hour", 9)
    close_h = tenant.get("close_hour", 17)
    slot_m = tenant.get("slot_minutes", 30)
    start = datetime.combine(day, datetime.min.time()).replace(hour=open_h, minute=0, second=0)
    end = datetime.combine(day, datetime.min.time()).replace(hour=close_h, minute=0, second=0)
    slots: list[str] = []
    cursor = start
    while cursor < end:
        slots.append(cursor.strftime("%H:%M"))
        cursor += timedelta(minutes=slot_m)
    return slots


def _taken_slots(tenant_id: str, day: date) -> set[str]:
    rows = get_conn().execute(
        "SELECT time FROM bookings WHERE tenant_id=? AND date=? AND status!='cancelled'",
        (tenant_id, day.isoformat()),
    ).fetchall()
    return {r["time"] for r in rows}


def available_slots(tenant: dict, day: date, limit: int = 4) -> list[str]:
    if not is_open(tenant, day):
        return []
    taken = _taken_slots(tenant["id"], day)
    free = [s for s in _slots_for_day(tenant, day) if s not in taken]
    return free[:limit]


HORIZON_DAYS = 14


def next_open_days(tenant: dict, after: date, count: int = 2) -> list[date]:
    found: list[date] = []
    cursor = after
    while len(found) < count:
        cursor += timedelta(days=1)
        if (cursor - date.today()).days > HORIZON_DAYS:
            break
        if is_open(tenant, cursor) and available_slots(tenant, cursor):
            found.append(cursor)
    return found


# ---------------------------------------------------------------------------
# Booking
# ---------------------------------------------------------------------------


class SlotUnavailable(Exception):
    pass


def _confirmation_code(tenant_id: str) -> str:
    alphabet = string.ascii_uppercase + string.digits
    conn = get_conn()
    while True:
        code = "".join(random.choices(alphabet, k=6))
        existing = conn.execute(
            "SELECT code FROM bookings WHERE code=?", (code,)
        ).fetchone()
        if not existing:
            return code


def book(tenant: dict, service: str, day: date, time_str: str, name: str, phone: str) -> dict:
    taken = _taken_slots(tenant["id"], day)
    if time_str in taken:
        raise SlotUnavailable(f"{time_str} on {day.isoformat()} is already booked")

    services = tenant.get("services", {})
    service_info = services.get(service, {})
    service_label = service_info.get("label", service)

    code = _confirmation_code(tenant["id"])
    conn = get_conn()
    conn.execute(
        """INSERT INTO bookings
           (code, tenant_id, service, service_label, date, time, customer_name, phone, status)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (code, tenant["id"], service, service_label, day.isoformat(), time_str, name, phone, "confirmed"),
    )
    conn.commit()
    return {
        "confirmation_code": code,
        "service": service,
        "service_label": service_label,
        "date": day.isoformat(),
        "time": time_str,
        "customer_name": name,
        "phone": phone,
        "status": "confirmed",
    }


def mark_confirmation_sent(code: str) -> Optional[dict]:
    conn = get_conn()
    conn.execute(
        "UPDATE bookings SET confirmation_sent=1 WHERE code=?", (code.upper(),)
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM bookings WHERE code=?", (code.upper(),)
    ).fetchone()
    return dict(row) if row else None


def list_bookings(tenant_id: Optional[str] = None) -> list[dict]:
    conn = get_conn()
    if tenant_id:
        rows = conn.execute(
            "SELECT * FROM bookings WHERE tenant_id=? ORDER BY date DESC, time DESC",
            (tenant_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM bookings ORDER BY date DESC, time DESC"
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Tool event log (written by middleware, read by /api/events)
# ---------------------------------------------------------------------------


def log_event(path: str, request_body: bytes, response_body: bytes, tenant_id: str = "") -> None:
    tool = path.rsplit("/", 1)[-1]
    try:
        args = json.loads(request_body or b"{}")
    except Exception:
        args = {}
    try:
        result = json.loads(response_body or b"{}")
    except Exception:
        result = {}
    conn = get_conn()
    conn.execute(
        "INSERT INTO tool_events (tenant_id, tool, arguments, result) VALUES (?,?,?,?)",
        (tenant_id, tool, json.dumps(args), json.dumps(result)),
    )
    conn.commit()


def events_since(cursor: int, tenant_id: Optional[str] = None) -> list[dict]:
    conn = get_conn()
    if tenant_id:
        rows = conn.execute(
            "SELECT * FROM tool_events WHERE seq>? AND tenant_id=? ORDER BY seq",
            (cursor, tenant_id),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM tool_events WHERE seq>? ORDER BY seq", (cursor,)
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["arguments"] = json.loads(d["arguments"])
        d["result"] = json.loads(d["result"])
        result.append(d)
    return result


# ---------------------------------------------------------------------------
# LeMUR dossier storage
# ---------------------------------------------------------------------------


def save_dossier(dossier: dict) -> None:
    conn = get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO lemur_dossiers
           (call_id, tenant_id, tenant_name, caller_name, caller_phone,
            intent, urgency, sentiment, summary, actions, draft_message, raw_lemur)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            dossier.get("call_id", ""),
            dossier.get("tenant_id", ""),
            dossier.get("tenant_name", ""),
            dossier.get("caller_name", ""),
            dossier.get("caller_phone", ""),
            dossier.get("intent", ""),
            int(dossier.get("urgency", 1)),
            dossier.get("sentiment", ""),
            dossier.get("summary", ""),
            json.dumps(dossier.get("actions", [])),
            dossier.get("draft_message", ""),
            dossier.get("raw_lemur", ""),
        ),
    )
    conn.commit()


def list_dossiers(tenant_id: Optional[str] = None) -> list[dict]:
    conn = get_conn()
    if tenant_id:
        rows = conn.execute(
            "SELECT * FROM lemur_dossiers WHERE tenant_id=? ORDER BY created_at DESC",
            (tenant_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM lemur_dossiers ORDER BY created_at DESC"
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["actions"] = json.loads(d["actions"])
        result.append(d)
    return result
