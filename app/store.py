"""In-memory booking store. Swap for a real database when you deploy for real."""

from __future__ import annotations

import json
import random
import string
from datetime import date, datetime, timedelta

SERVICES = {
    "haircut": {
        "label": "Signature Haircut & Styling",
        "minutes": 45,
        "price": 85,
        "description": "Custom consultation, precision shear or razor cut, wash, and luxury blowout.",
    },
    "coloring": {
        "label": "Full Color & Gloss",
        "minutes": 90,
        "price": 185,
        "description": "All-over single process coloring, custom formulation, nourishing gloss, and blowout.",
    },
    "balayage": {
        "label": "Artisan Balayage & Highlights",
        "minutes": 120,
        "price": 280,
        "description": "Hand-painted dimensional highlights, toner formulation, deep conditioning mask, and style.",
    },
    "blowout": {
        "label": "Signature Blowout & Treatment",
        "minutes": 45,
        "price": 65,
        "description": "Revitalizing scalp massage, clarifying shampoo, hydrating mask, and voluminous blowout styling.",
    },
}

OPEN_HOUR = 9
CLOSE_HOUR = 17
SLOT_MINUTES = 30
HORIZON_DAYS = 14

_appointments: dict[str, dict] = {}
_taken: set[tuple[str, str]] = set()


def _slots_for_day(day: date) -> list[str]:
    start = datetime.combine(day, datetime.min.time()).replace(hour=OPEN_HOUR)
    end = datetime.combine(day, datetime.min.time()).replace(hour=CLOSE_HOUR)
    slots: list[str] = []
    cursor = start
    while cursor < end:
        slots.append(cursor.strftime("%H:%M"))
        cursor += timedelta(minutes=SLOT_MINUTES)
    return slots


def _seed_existing_bookings() -> None:
    """Pre-book a deterministic scatter of slots so availability looks real."""
    rng = random.Random(20260901)
    for day_offset in range(HORIZON_DAYS):
        day = date.today() + timedelta(days=day_offset)
        if day.weekday() >= 5:
            continue
        for slot in _slots_for_day(day):
            if rng.random() < 0.45:
                _taken.add((day.isoformat(), slot))

    # Seed 4 realistic appointments for the Owner Dashboard
    seed_data = [
        ("haircut", 0, "10:00", "Eleanor Vance", "eleanor.vance@gmail.com", True),
        ("blowout", 0, "14:30", "Marcus Sterling", "marcus.sterling@gmail.com", True),
        ("coloring", 1, "11:00", "Sophia Al-Mansoor", "sophia.mansoor@gmail.com", False),
        ("balayage", 2, "09:30", "James Thornton", "james.thornton@gmail.com", True),
    ]
    for service, offset, time_str, name, email, confirmed in seed_data:
        target_day = date.today() + timedelta(days=offset)
        if target_day.weekday() >= 5:
            target_day += timedelta(days=2)
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        _taken.add((target_day.isoformat(), time_str))
        _appointments[code] = {
            "confirmation_code": code,
            "service": service,
            "service_label": SERVICES[service]["label"],
            "date": target_day.isoformat(),
            "time": time_str,
            "customer_name": name,
            "email": email,
            "confirmation_sent": confirmed,
            "price": SERVICES[service]["price"],
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }


def _confirmation_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(alphabet, k=6))
        if code not in _appointments:
            return code


def is_open(day: date) -> bool:
    return day.weekday() < 5


def available_slots(day: date, limit: int = 4) -> list[str]:
    if not is_open(day):
        return []
    free = [s for s in _slots_for_day(day) if (day.isoformat(), s) not in _taken]
    return free[:limit]


def next_open_days(after: date, count: int = 2) -> list[date]:
    found: list[date] = []
    cursor = after
    while len(found) < count:
        cursor += timedelta(days=1)
        if (cursor - date.today()).days > HORIZON_DAYS:
            break
        if is_open(cursor) and available_slots(cursor):
            found.append(cursor)
    return found


def book(service: str, day: date, time_str: str, name: str, email: str) -> dict:
    key = (day.isoformat(), time_str)
    if key in _taken:
        raise SlotUnavailable(f"{time_str} on {day.isoformat()} is already booked")
    _taken.add(key)
    code = _confirmation_code()
    record = {
        "confirmation_code": code,
        "service": service,
        "service_label": SERVICES[service]["label"],
        "date": day.isoformat(),
        "time": time_str,
        "customer_name": name,
        "email": email,
        "confirmation_sent": False,
        "price": SERVICES[service].get("price", 120),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    _appointments[code] = record
    return record


def get(code: str) -> dict | None:
    return _appointments.get(code)


def mark_confirmation_sent(code: str) -> dict | None:
    record = _appointments.get(code)
    if record:
        record["confirmation_sent"] = True
    return record


class SlotUnavailable(Exception):
    pass


_seed_existing_bookings()


# --- demo event log -------------------------------------------------------
# HTTP tools run on AssemblyAI's servers, so the browser never sees a
# tool.call event. Recording each hit here is what lets the demo page show
# them arriving.

_events: list[dict] = []


def _safe_json(raw: bytes) -> dict:
    try:
        return json.loads(raw or b"{}")
    except (ValueError, TypeError):
        return {}


def log_event(path: str, request_body: bytes, response_body: bytes) -> None:
    _events.append({
        "seq": len(_events) + 1,
        "tool": path.rsplit("/", 1)[-1],
        "arguments": _safe_json(request_body),
        "result": _safe_json(response_body),
        "at": datetime.now().strftime("%H:%M:%S"),
    })


def events_since(cursor: int) -> list[dict]:
    return [e for e in _events if e["seq"] > cursor]
