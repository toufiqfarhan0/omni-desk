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
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "omnidesk.db"


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
            industry TEXT NOT NULL DEFAULT 'dental',
            tone TEXT NOT NULL DEFAULT 'professional',
            greeting TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            voice_id TEXT NOT NULL DEFAULT '131a436c-0fc4-4797-90f7-d0e515d18b06',
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

    # Check if flagship dental clinic exists
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
                "OmniDesk Dental Clinic",
                "dental",
                "warm",
                "Thanks for calling OmniDesk Dental Clinic. Are you looking to book an appointment?",
                "You are an autonomous receptionist for OmniDesk Dental Clinic. You speak naturally, answer questions about dental services, check real calendar slots using your tools, and book appointments for callers.",
                "131a436c-0fc4-4797-90f7-d0e515d18b06",
                30,
                9,
                17,
                json.dumps(["OmniDesk", "OmniDesk Dental Clinic", "cleaning", "checkup", "whitening", "root canal"]),
                agent_id,
                now_str,
                now_str,
            ),
        )

        services = [
            ("checkup", "Routine Checkup", 30, 85.0, "Comprehensive dental examination, gum health check and preventive evaluation."),
            ("cleaning", "Dental Cleaning", 30, 120.0, "Full dental hygiene cleaning, ultrasonic plaque removal and enamel polish."),
            ("whitening", "Teeth Whitening", 60, 250.0, "Professional clinical teeth whitening for stain removal and enamel brightening."),
            ("root-canal", "Root Canal", 90, 650.0, "Specialized endodontic therapy, pulp restoration and tooth preservation."),
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
            ("7JFREK", "cleaning", "Dental Cleaning", 0, "10:00", "Eleanor Vance", "eleanor.vance@gmail.com", 120.0, 1),
            ("DIWA7R", "checkup", "Routine Checkup", 0, "14:30", "Marcus Sterling", "marcus.sterling@gmail.com", 85.0, 1),
            ("YQMD7S", "whitening", "Teeth Whitening", 1, "11:00", "Sophia Al-Mansoor", "sophia.mansoor@gmail.com", 250.0, 0),
            ("K4H3RI", "root-canal", "Root Canal", 2, "09:30", "James Thornton", "james.thornton@gmail.com", 650.0, 1),
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
        conv_transcript = [
            {"who": "agent", "text": "Thanks for calling OmniDesk Dental Clinic. Are you looking to book an appointment?"},
            {"who": "user", "text": "Hi, I'd like to schedule a dental cleaning for today if possible."},
            {"who": "agent", "text": "I would be happy to help with that. Let me check our availability for today. We have a slot open at 10:00 AM. Does that work for you?"},
            {"who": "user", "text": "Yes, 10:00 AM works perfectly."},
            {"who": "agent", "text": "May I have your name and email address to confirm the reservation?"},
            {"who": "user", "text": "Eleanor Vance, eleanor dot vance at gmail dot com."},
            {"who": "agent", "text": "You're all set, Eleanor! Your Dental Cleaning is confirmed for today at 10:00 AM. Your confirmation code is 7JFREK and I have sent the calendar invite to your email."},
        ]
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
    return [dict(r) for r in rows]


def get_booking_by_code(code: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM bookings WHERE confirmation_code = ?", (code,)).fetchone()
    conn.close()
    return dict(row) if row else None


def mark_booking_confirmation_sent(code: str) -> None:
    conn = get_connection()
    conn.execute("UPDATE bookings SET confirmation_sent = 1 WHERE confirmation_code = ?", (code,))
    conn.commit()
    conn.close()


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
    conn.commit()
    row = cur.execute("SELECT * FROM bookings WHERE confirmation_code = ?", (code,)).fetchone()
    res = dict(row)
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
            caller_name,
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
    row = cur.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    res = dict(row)
    res["transcript"] = json.loads(res["transcript"])
    res["tool_calls"] = json.loads(res["tool_calls"])
    conn.close()
    return res


def list_conversations_for_business(business_id: str, limit: int = 50) -> list[dict]:
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


def uuid_short() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=10))


# Initialize on import
init_db()
