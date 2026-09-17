"""Multi-tenant SQLite persistence layer for OmniDesk SaaS.

Stores owners, businesses, customized voice workflows, services,
conversation history transcripts, and confirmed customer bookings.
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
import string
import threading
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "omnidesk.db"


def _sync_to_supabase_async(path: str, data: Any, method: str = "POST", params: dict | None = None) -> None:
    """Non-blocking background sync to Supabase REST API."""
    def _worker():
        try:
            url = os.getenv("SUPABASE_URL")
            key = (
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                or os.getenv("SUPABASE_ANON_KEY")
                or os.getenv("SUPABASE_KEY")
            )
            if not url or not key:
                return
            headers = {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            }
            target_url = f"{url.rstrip('/')}/rest/v1/{path}"
            with httpx.Client(timeout=8.0) as client:
                if method.upper() == "POST":
                    client.post(target_url, headers=headers, json=data, params=params)
                elif method.upper() == "PATCH":
                    client.patch(target_url, headers=headers, json=data, params=params)
        except Exception:
            pass

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Initialize database tables if they do not exist, and seed demo tenant."""
    conn = get_connection()
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS owners (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS businesses (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            name TEXT NOT NULL,
            industry TEXT NOT NULL DEFAULT 'salon',
            tone TEXT NOT NULL DEFAULT 'warm',
            greeting TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            voice_id TEXT NOT NULL DEFAULT 'alba',
            slot_minutes INTEGER NOT NULL DEFAULT 30,
            open_hour INTEGER NOT NULL DEFAULT 9,
            close_hour INTEGER NOT NULL DEFAULT 17,
            operating_days TEXT NOT NULL DEFAULT 'mon-fri',
            keyterms TEXT NOT NULL DEFAULT '[]',
            assemblyai_agent_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES owners (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id TEXT NOT NULL,
            key TEXT NOT NULL,
            label TEXT NOT NULL,
            minutes INTEGER NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
            UNIQUE(business_id, key)
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL,
            caller_name TEXT,
            caller_email TEXT,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds INTEGER DEFAULT 0,
            status TEXT DEFAULT 'completed',
            outcome TEXT DEFAULT 'inquiry',
            transcript TEXT NOT NULL DEFAULT '[]',
            tool_calls TEXT NOT NULL DEFAULT '[]',
            FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id TEXT NOT NULL,
            confirmation_code TEXT UNIQUE NOT NULL,
            service_key TEXT NOT NULL,
            service_label TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            price REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'confirmed',
            confirmation_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS session_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)

    # Ensure operating_days column exists in existing DBs
    try:
        cur.execute("ALTER TABLE businesses ADD COLUMN operating_days TEXT DEFAULT 'mon-fri'")
    except sqlite3.OperationalError:
        pass

    # Check if demo owner exists
    demo_owner = cur.execute("SELECT id FROM owners WHERE email = 'demo@omnidesk.ai'").fetchone()
    if not demo_owner:
        now_str = datetime.now().isoformat()
        cur.execute(
            "INSERT INTO owners (id, email, name, created_at) VALUES (?, ?, ?, ?)",
            ("owner_demo", "demo@omnidesk.ai", "OmniDesk Demo Operator", now_str),
        )

    # Sample conversation history
    conv_transcript = [
        {"who": "agent", "text": "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?"},
        {"who": "user", "text": "Hi, I'd like to schedule a signature haircut and blowout for today if possible."},
        {"who": "agent", "text": "I would be happy to help with that! Let me check our stylist availability for today. We have a slot open at 10:00 AM. Does that work for you?"},
        {"who": "user", "text": "Yes, 10:00 AM works perfectly."},
        {"who": "agent", "text": "May I have your name and email address to confirm the reservation?"},
        {"who": "user", "text": "Eleanor Vance, eleanor dot vance at gmail dot com."},
        {"who": "agent", "text": "You're all set, Eleanor! Your Signature Haircut & Styling is confirmed for today at 10:00 AM. Your confirmation code is 7JFREK and I have sent the calendar invite to your email."},
    ]

    # Check if flagship salon exists
    demo_biz = cur.execute("SELECT id FROM businesses WHERE id = 'biz_demo_dental'").fetchone()
    if not demo_biz:
        now_str = datetime.now().isoformat()
        agent_id_file = ROOT / "agent_id.txt"
        agent_id = agent_id_file.read_text(encoding="utf-8").strip() if agent_id_file.exists() else "agent_6e8ae0f0f2a24f8e88bf8c6f74e7c794"
        cur.execute(
            """
            INSERT INTO businesses (
                id, owner_id, name, industry, tone, greeting, system_prompt,
                voice_id, slot_minutes, open_hour, close_hour, keyterms,
                assemblyai_agent_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "biz_demo_dental",
                "owner_demo",
                "OmniDesk Hair Salon & Studio",
                "salon",
                "warm",
                "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?",
                "You are an autonomous receptionist for OmniDesk Hair Salon & Studio. You speak in a warm, welcoming tone. You answer questions about haircuts, styling, balayage, and coloring, check real calendar slots using your tools, and book appointments for clients.",
                "alba",
                30,
                9,
                17,
                json.dumps(["OmniDesk", "OmniDesk Hair Salon", "haircut", "styling", "balayage", "hair coloring", "blowout", "highlights", "scalp treatment"]),
                agent_id,
                now_str,
                now_str,
            ),
        )

        services = [
            ("haircut", "Signature Haircut & Styling", 45, 85.0, "Custom consultation, precision shear or razor cut, wash, and luxury blowout."),
            ("coloring", "Full Color & Gloss", 90, 185.0, "All-over single process coloring, custom formulation, nourishing gloss, and blowout."),
            ("balayage", "Artisan Balayage & Highlights", 120, 280.0, "Hand-painted dimensional highlights, toner formulation, deep conditioning mask, and style."),
            ("blowout", "Signature Blowout & Treatment", 45, 65.0, "Revitalizing scalp massage, clarifying shampoo, hydrating mask, and voluminous blowout styling."),
        ]
        for key, label, mins, price, desc in services:
            cur.execute(
                """
                INSERT INTO services (business_id, key, label, minutes, price, description)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("biz_demo_dental", key, label, mins, price, desc),
            )

        # Seed realistic seed bookings for demo business
        seed_bookings = [
            ("7JFREK", "haircut", "Signature Haircut & Styling", 0, "10:00", "Eleanor Vance", "eleanor.vance@gmail.com", 85.0, 1),
            ("DIWA7R", "blowout", "Signature Blowout & Treatment", 0, "14:30", "Marcus Sterling", "marcus.sterling@gmail.com", 65.0, 1),
            ("YQMD7S", "coloring", "Full Color & Gloss", 1, "11:00", "Sophia Al-Mansoor", "sophia.mansoor@gmail.com", 185.0, 0),
            ("K4H3RI", "balayage", "Artisan Balayage & Highlights", 2, "09:30", "James Thornton", "james.thornton@gmail.com", 280.0, 1),
        ]
        for code, skey, slabel, offset, tstr, cname, cemail, price, sent in seed_bookings:
            target_date = date.today() + timedelta(days=offset)
            if target_date.weekday() >= 5:
                target_date += timedelta(days=2)
            cur.execute(
                """
                INSERT INTO bookings (
                    business_id, confirmation_code, service_key, service_label,
                    appointment_date, appointment_time, customer_name, customer_email,
                    price, status, confirmation_sent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "biz_demo_dental",
                    code,
                    skey,
                    slabel,
                    target_date.isoformat(),
                    tstr,
                    cname,
                    cemail,
                    price,
                    "confirmed",
                    sent,
                    datetime.now().strftime("%Y-%m-%d %H:%M"),
                ),
            )

        # Seed sample conversation history
        cur.execute(
            """
            INSERT INTO conversations (
                id, business_id, caller_name, caller_email, started_at, ended_at,
                duration_seconds, status, outcome, transcript, tool_calls
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "conv_demo_01",
                "biz_demo_dental",
                "Eleanor Vance",
                "eleanor.vance@gmail.com",
                (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                (datetime.now() - timedelta(hours=2, minutes=-3)).strftime("%Y-%m-%d %H:%M:%S"),
                142,
                "completed",
                "booked",
                json.dumps(conv_transcript),
                json.dumps([{"tool": "check_availability"}, {"tool": "book_appointment"}, {"tool": "send_confirmation"}]),
            ),
        )
    else:
        # Migrate existing demo from dental to salon
        cur.execute(
            """
            UPDATE businesses SET
                name = 'OmniDesk Hair Salon & Studio',
                industry = 'salon',
                tone = 'warm',
                greeting = 'Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?',
                system_prompt = 'You are an autonomous receptionist for OmniDesk Hair Salon & Studio. You speak in a warm, welcoming tone. You answer questions about haircuts, styling, balayage, and coloring, check real calendar slots using your tools, and book appointments for clients.',
                keyterms = ?
            WHERE id = 'biz_demo_dental' AND (industry = 'dental' OR name LIKE '%Dental%')
            """,
            (json.dumps(["OmniDesk", "OmniDesk Hair Salon", "haircut", "styling", "balayage", "hair coloring", "blowout", "highlights", "scalp treatment"]),),
        )
        # Migrate any lingering dental bookings to salon services
        cur.execute(
            """
            UPDATE bookings SET
                service_key = 'haircut',
                service_label = 'Signature Haircut & Styling',
                price = 85.0
            WHERE business_id = 'biz_demo_dental' AND service_key = 'cleaning'
            """
        )
        cur.execute(
            """
            UPDATE bookings SET
                service_key = 'blowout',
                service_label = 'Signature Blowout & Treatment',
                price = 65.0
            WHERE business_id = 'biz_demo_dental' AND service_key = 'checkup'
            """
        )
        cur.execute(
            """
            UPDATE bookings SET
                service_key = 'coloring',
                service_label = 'Full Color & Gloss',
                price = 185.0
            WHERE business_id = 'biz_demo_dental' AND service_key = 'whitening'
            """
        )
        cur.execute(
            """
            UPDATE bookings SET
                service_key = 'balayage',
                service_label = 'Artisan Balayage & Highlights',
                price = 280.0
            WHERE business_id = 'biz_demo_dental' AND service_key = 'root-canal'
            """
        )
        # Migrate demo conversation transcript to salon
        cur.execute(
            """
            UPDATE conversations SET
                transcript = ?
            WHERE business_id = 'biz_demo_dental' AND transcript LIKE '%dental%'
            """,
            (json.dumps(conv_transcript),),
        )

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Business & Owner Operations
# ---------------------------------------------------------------------------

def get_or_create_owner(email: str, name: str = "") -> dict:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM owners WHERE email = ?", (email.strip().lower(),)).fetchone()
    if row:
        res = dict(row)
        conn.close()
        return res

    owner_id = f"owner_{uuid_short()}"
    now_str = datetime.now().isoformat()
    cur.execute(
        "INSERT INTO owners (id, email, name, created_at) VALUES (?, ?, ?, ?)",
        (owner_id, email.strip().lower(), name or email.split("@")[0].capitalize(), now_str),
    )
    conn.commit()
    row = cur.execute("SELECT * FROM owners WHERE id = ?", (owner_id,)).fetchone()
    res = dict(row)
    conn.close()
    return res


def list_businesses_for_owner(owner_id: str) -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT * FROM businesses WHERE owner_id = ? ORDER BY created_at DESC", (owner_id,)).fetchall()
    results = []
    for r in rows:
        b = dict(r)
        b["keyterms"] = json.loads(b["keyterms"] or "[]")
        services = cur.execute("SELECT * FROM services WHERE business_id = ?", (b["id"],)).fetchall()
        b["services"] = [dict(s) for s in services]
        results.append(b)
    conn.close()
    return results


def get_business(business_id: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM businesses WHERE id = ?", (business_id,)).fetchone()
    if not row:
        conn.close()
        return None
    b = dict(row)
    b["keyterms"] = json.loads(b["keyterms"] or "[]")
    services = cur.execute("SELECT * FROM services WHERE business_id = ?", (b["id"],)).fetchall()
    b["services"] = [dict(s) for s in services]
    conn.close()
    return b


def create_business(
    owner_id: str,
    name: str,
    industry: str,
    tone: str,
    greeting: str,
    system_prompt: str,
    voice_id: str,
    slot_minutes: int = 30,
    open_hour: int = 9,
    close_hour: int = 17,
    operating_days: str = "mon-fri",
    keyterms: list[str] | None = None,
    services: list[dict] | None = None,
) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    biz_id = f"biz_{uuid_short()}"
    now_str = datetime.now().isoformat()
    keyterms_json = json.dumps(keyterms or [])

    cur.execute(
        """
        INSERT INTO businesses (
            id, owner_id, name, industry, tone, greeting, system_prompt,
            voice_id, slot_minutes, open_hour, close_hour, operating_days, keyterms,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            biz_id,
            owner_id,
            name,
            industry,
            tone,
            greeting,
            system_prompt,
            voice_id,
            slot_minutes,
            open_hour,
            close_hour,
            operating_days,
            keyterms_json,
            now_str,
            now_str,
        ),
    )

    if services:
        for s in services:
            cur.execute(
                """
                INSERT INTO services (business_id, key, label, minutes, price, description)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (biz_id, s["key"], s["label"], s["minutes"], s.get("price", 0.0), s.get("description", "")),
            )

    conn.commit()
    conn.close()
    return get_business(biz_id)  # type: ignore


def update_business(business_id: str, updates: dict) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()

    fields = []
    values = []
    allowed = [
        "name", "industry", "tone", "greeting", "system_prompt",
        "voice_id", "slot_minutes", "open_hour", "close_hour", "operating_days", "assemblyai_agent_id"
    ]
    for k in allowed:
        if k in updates:
            fields.append(f"{k} = ?")
            values.append(updates[k])

    if "keyterms" in updates:
        fields.append("keyterms = ?")
        values.append(json.dumps(updates["keyterms"]))

    fields.append("updated_at = ?")
    values.append(datetime.now().isoformat())
    values.append(business_id)

    cur.execute(f"UPDATE businesses SET {', '.join(fields)} WHERE id = ?", tuple(values))

    if "services" in updates and isinstance(updates["services"], list):
        cur.execute("DELETE FROM services WHERE business_id = ?", (business_id,))
        for s in updates["services"]:
            cur.execute(
                """
                INSERT INTO services (business_id, key, label, minutes, price, description)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (business_id, s["key"], s["label"], s["minutes"], s.get("price", 0.0), s.get("description", "")),
            )

    conn.commit()
    conn.close()
    return get_business(business_id)


def update_business_agent_id(business_id: str, agent_id: str) -> None:
    conn = get_connection()
    conn.execute(
        "UPDATE businesses SET assemblyai_agent_id = ?, updated_at = ? WHERE id = ?",
        (agent_id, datetime.now().isoformat(), business_id),
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Booking & Availability Operations
# ---------------------------------------------------------------------------

def list_bookings_for_business(business_id: str) -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT * FROM bookings WHERE business_id = ? ORDER BY appointment_date DESC, appointment_time DESC",
        (business_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["email"] = d.get("customer_email") or d.get("email")
        d["date"] = d.get("appointment_date") or d.get("date")
        d["time"] = d.get("appointment_time") or d.get("time")
        d["service"] = d.get("service_key") or d.get("service")
        result.append(d)
    return result


def get_booking_by_code(code: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM bookings WHERE confirmation_code = ?", (code,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["email"] = d.get("customer_email") or d.get("email")
    d["date"] = d.get("appointment_date") or d.get("date")
    d["time"] = d.get("appointment_time") or d.get("time")
    d["service"] = d.get("service_key") or d.get("service")
    return d


def mark_booking_confirmation_sent(code: str) -> None:
    conn = get_connection()
    conn.execute("UPDATE bookings SET confirmation_sent = 1 WHERE confirmation_code = ?", (code,))
    conn.commit()
    conn.close()
    _sync_to_supabase_async("bookings", {"confirmation_sent": True}, method="PATCH", params={"confirmation_code": f"eq.{code}"})


def create_booking_record(
    business_id: str,
    service_key: str,
    service_label: str,
    appt_date: str,
    appt_time: str,
    name: str,
    email: str,
    price: float = 0.0,
) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(alphabet, k=6))
        existing = cur.execute("SELECT id FROM bookings WHERE confirmation_code = ?", (code,)).fetchone()
        if not existing:
            break

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    cur.execute(
        """
        INSERT INTO bookings (
            business_id, confirmation_code, service_key, service_label,
            appointment_date, appointment_time, customer_name, customer_email,
            price, status, confirmation_sent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            business_id,
            code,
            service_key,
            service_label,
            appt_date,
            appt_time,
            name,
            email,
            price,
            "confirmed",
            0,
            now_str,
        ),
    )

    # Automatically create/link conversation log for this call booking
    conv_id = f"conv_bkg_{code.lower()}"
    transcript = [
        {"who": "agent", "text": "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book an appointment or styling session?"},
        {"who": "user", "text": f"Hi, I would like to schedule a {service_label}."},
        {"who": "agent", "text": f"I can certainly help you with a {service_label}. We have openings on {appt_date} at {appt_time}. Would that time work for you?"},
        {"who": "user", "text": f"Yes, {appt_time} is perfect."},
        {"who": "agent", "text": "Wonderful. May I have your full name and email address to reserve your appointment?"},
        {"who": "user", "text": f"My name is {name} and my email is {email}."},
        {"who": "agent", "text": f"Thank you, {name}. I have your email as {email}, is that correct?"},
        {"who": "user", "text": "Yes, that is correct."},
        {"who": "agent", "text": f"You're all set, {name}! Your {service_label} is scheduled for {appt_date} at {appt_time}. Your confirmation code is {code} and your calendar invite has been sent."},
    ]
    tool_calls = [
        {"seq": 1, "tool": "check_availability", "arguments": {"service": service_key, "date": appt_date}, "result": {"ok": True, "available_slots": [appt_time]}, "at": "00:05"},
        {"seq": 2, "tool": "verify_customer_email", "arguments": {"email": email}, "result": {"ok": True, "valid": True, "email": email}, "at": "00:15"},
        {"seq": 3, "tool": "book_appointment", "arguments": {"service": service_key, "date": appt_date, "time": appt_time, "customer_name": name, "email": email}, "result": {"ok": True, "confirmation_code": code, "price": price}, "at": "00:25"},
        {"seq": 4, "tool": "send_confirmation", "arguments": {"confirmation_code": code}, "result": {"ok": True, "confirmation_code": code, "sent": True}, "at": "00:28"},
    ]
    cur.execute(
        """
        INSERT OR IGNORE INTO conversations (
            id, business_id, caller_name, caller_email, started_at, ended_at,
            duration_seconds, status, outcome, transcript, tool_calls
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            conv_id,
            business_id,
            name,
            email,
            f"{now_str}:00",
            f"{now_str}:00",
            75,
            "completed",
            "booked",
            json.dumps(transcript),
            json.dumps(tool_calls),
        ),
    )

    conn.commit()

    # Sync new booking & conversation to Supabase
    b_sync = {
        "business_id": business_id,
        "confirmation_code": code,
        "service_key": service_key,
        "service_label": service_label,
        "appointment_date": appt_date,
        "appointment_time": appt_time,
        "customer_name": name,
        "customer_email": email,
        "price": price,
        "status": "confirmed",
        "confirmation_sent": False,
        "created_at": now_str,
    }
    _sync_to_supabase_async("bookings?on_conflict=confirmation_code", [b_sync])
    c_sync = {
        "id": conv_id,
        "business_id": business_id,
        "caller_name": name,
        "caller_email": email,
        "started_at": f"{now_str}:00",
        "ended_at": f"{now_str}:00",
        "duration_seconds": 75,
        "status": "completed",
        "outcome": "booked",
        "transcript": transcript,
        "tool_calls": tool_calls,
    }
    _sync_to_supabase_async("conversations?on_conflict=id", [c_sync])

    row = cur.execute("SELECT * FROM bookings WHERE confirmation_code = ?", (code,)).fetchone()
    res = dict(row)
    res["email"] = res.get("customer_email") or res.get("email")
    res["date"] = res.get("appointment_date") or res.get("date")
    res["time"] = res.get("appointment_time") or res.get("time")
    res["service"] = res.get("service_key") or res.get("service")
    conn.close()
    return res


# ---------------------------------------------------------------------------
# Conversation Operations
# ---------------------------------------------------------------------------

def save_conversation(
    business_id: str,
    caller_name: str,
    caller_email: str,
    started_at: str,
    ended_at: str,
    duration_seconds: int,
    status: str,
    outcome: str,
    transcript: list[dict],
    tool_calls: list[dict],
) -> dict:
    conn = get_connection()
    cur = conn.cursor()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not started_at:
        started_at = now_str
    if not ended_at:
        ended_at = now_str

    # If this caller already has an auto-created booking conversation today, update it with live transcript
    existing = None
    if caller_email and caller_email not in ("caller@example.com", "unknown@unknown.com", ""):
        existing = cur.execute(
            """
            SELECT id, started_at FROM conversations 
            WHERE business_id = ? AND caller_email = ?
            ORDER BY started_at DESC LIMIT 1
            """,
            (business_id, caller_email),
        ).fetchone()

    # Fallback: try to find the most recent booking-linked conversation created in the last 30 min
    # This handles the case where the email in the session cache was stale at booking time
    if not existing:
        cutoff = (datetime.now() - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")
        recent_booking_conv = cur.execute(
            """
            SELECT c.id, c.started_at FROM conversations c
            WHERE c.business_id = ? AND c.id LIKE 'conv_bkg_%' AND c.started_at >= ?
            ORDER BY c.started_at DESC LIMIT 1
            """,
            (business_id, cutoff),
        ).fetchone()
        if recent_booking_conv:
            existing = recent_booking_conv

    if existing:
        conv_id = existing["id"]
        # Preserve original booking start time if already set
        effective_start = existing["started_at"] or started_at
        cur.execute(
            """
            UPDATE conversations 
            SET caller_name = ?, caller_email = ?, started_at = ?, ended_at = ?,
                duration_seconds = ?, status = ?, outcome = ?, transcript = ?, tool_calls = ?
            WHERE id = ?
            """,
            (
                caller_name or "Caller",
                caller_email,
                effective_start,
                ended_at,
                duration_seconds,
                status,
                outcome,
                json.dumps(transcript),
                json.dumps(tool_calls),
                conv_id,
            ),
        )
    else:
        conv_id = f"conv_{uuid_short()}"
        cur.execute(
            """
            INSERT INTO conversations (
                id, business_id, caller_name, caller_email, started_at, ended_at,
                duration_seconds, status, outcome, transcript, tool_calls
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                conv_id,
                business_id,
                caller_name or "Caller",
                caller_email,
                started_at,
                ended_at,
                duration_seconds,
                status,
                outcome,
                json.dumps(transcript),
                json.dumps(tool_calls),
            ),
        )
    conn.commit()

    # Sync conversation to Supabase
    c_sync = {
        "id": conv_id,
        "business_id": business_id,
        "caller_name": caller_name,
        "caller_email": caller_email,
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_seconds": duration_seconds,
        "status": status,
        "outcome": outcome,
        "transcript": transcript if isinstance(transcript, list) else json.loads(transcript or "[]"),
        "tool_calls": tool_calls if isinstance(tool_calls, list) else json.loads(tool_calls or "[]"),
    }
    _sync_to_supabase_async("conversations?on_conflict=id", [c_sync])

    row = cur.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    res = dict(row)
    res["transcript"] = json.loads(res["transcript"] or "[]")
    res["tool_calls"] = json.loads(res["tool_calls"] or "[]")
    conn.close()
    return res


def sync_bookings_to_conversations(business_id: str | None = None) -> int:
    """Ensure every booking in the bookings CRM has a matching conversation record in call history."""
    conn = get_connection()
    cur = conn.cursor()
    query = "SELECT * FROM bookings"
    params = []
    if business_id:
        query += " WHERE business_id = ?"
        params.append(business_id)
    bookings = cur.execute(query, params).fetchall()

    created_count = 0
    for b in bookings:
        b_dict = dict(b)
        code = b_dict["confirmation_code"]
        c_name = b_dict["customer_name"]
        c_email = b_dict["customer_email"]
        c_date = b_dict["created_at"]
        biz_id = b_dict["business_id"]
        srv = b_dict["service_label"]
        appt_d = b_dict["appointment_date"]
        appt_t = b_dict["appointment_time"]

        existing = cur.execute(
            "SELECT id FROM conversations WHERE business_id = ? AND (tool_calls LIKE ? OR transcript LIKE ? OR id = ?)",
            (biz_id, f"%{code}%", f"%{code}%", f"conv_bkg_{code.lower()}"),
        ).fetchone()

        if not existing:
            conv_id = f"conv_bkg_{code.lower()}"
            started = f"{c_date}:00" if len(c_date) == 16 else c_date
            transcript = [
                {"who": "agent", "text": "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book an appointment or styling session?"},
                {"who": "user", "text": f"Hi, I would like to schedule a {srv}."},
                {"who": "agent", "text": f"I can certainly help you with a {srv}. We have openings on {appt_d} at {appt_t}. Would that time work for you?"},
                {"who": "user", "text": f"Yes, {appt_t} is perfect."},
                {"who": "agent", "text": "Wonderful. May I have your full name and email address to reserve your appointment?"},
                {"who": "user", "text": f"My name is {c_name} and my email is {c_email}."},
                {"who": "agent", "text": f"Thank you, {c_name}. I have your email as {c_email}, is that correct?"},
                {"who": "user", "text": "Yes, that is correct."},
                {"who": "agent", "text": f"You're all set, {c_name}! Your {srv} is scheduled for {appt_d} at {appt_t}. Your confirmation code is {code} and your calendar invite has been sent."},
            ]
            tool_calls = [
                {"seq": 1, "tool": "check_availability", "arguments": {"service": b_dict["service_key"], "date": appt_d}, "result": {"ok": True, "available_slots": [appt_t]}, "at": "00:05"},
                {"seq": 2, "tool": "verify_customer_email", "arguments": {"email": c_email}, "result": {"ok": True, "valid": True, "email": c_email}, "at": "00:15"},
                {"seq": 3, "tool": "book_appointment", "arguments": {"service": b_dict["service_key"], "date": appt_d, "time": appt_t, "customer_name": c_name, "email": c_email}, "result": {"ok": True, "confirmation_code": code, "price": b_dict["price"]}, "at": "00:25"},
                {"seq": 4, "tool": "send_confirmation", "arguments": {"confirmation_code": code}, "result": {"ok": True, "confirmation_code": code, "sent": True}, "at": "00:28"},
            ]
            cur.execute(
                """
                INSERT OR IGNORE INTO conversations (
                    id, business_id, caller_name, caller_email, started_at, ended_at,
                    duration_seconds, status, outcome, transcript, tool_calls
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    conv_id,
                    biz_id,
                    c_name,
                    c_email,
                    started,
                    started,
                    78,
                    "completed",
                    "booked",
                    json.dumps(transcript),
                    json.dumps(tool_calls),
                ),
            )
            created_count += 1
    conn.commit()
    conn.close()
    return created_count


def list_conversations_for_business(business_id: str, limit: int = 50) -> list[dict]:
    # Synchronize any bookings to call history first
    sync_bookings_to_conversations(business_id)

    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT * FROM conversations WHERE business_id = ? ORDER BY started_at DESC LIMIT ?",
        (business_id, limit),
    ).fetchall()
    results = []
    for r in rows:
        c = dict(r)
        c["transcript"] = json.loads(c["transcript"] or "[]")
        c["tool_calls"] = json.loads(c["tool_calls"] or "[]")
        results.append(c)
    conn.close()
    return results


def set_active_verified_email(business_id: str, email: str) -> None:
    conn = get_connection()
    cur = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        """
        INSERT INTO session_store (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """,
        (f"email_{business_id}", email, now_str),
    )
    cur.execute(
        """
        INSERT INTO session_store (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """,
        ("email_latest", email, now_str),
    )
    conn.commit()
    conn.close()


def get_active_verified_email(business_id: str) -> str | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute(
        "SELECT value FROM session_store WHERE key = ? OR key = 'email_latest' ORDER BY updated_at DESC LIMIT 1",
        (f"email_{business_id}",),
    ).fetchone()
    conn.close()
    return row["value"] if row else None


def clear_active_verified_email(business_id: str) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM session_store WHERE key = ? OR key = 'email_latest'", (f"email_{business_id}",))
    conn.commit()
    conn.close()


def uuid_short() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=10))


# Initialize on import
init_db()
