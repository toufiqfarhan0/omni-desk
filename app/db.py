"""SQLite database setup for OmniDesk.

Creates schema on first run, seeds three demo tenants (Apex Legal,
Bright Dental, Metro Plumbing) so the dashboard works out of the box.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "omniDesk.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                persona TEXT NOT NULL,
                greeting TEXT NOT NULL,
                open_days TEXT NOT NULL DEFAULT 'Monday to Friday',
                open_hour INTEGER NOT NULL DEFAULT 9,
                close_hour INTEGER NOT NULL DEFAULT 17,
                slot_minutes INTEGER NOT NULL DEFAULT 30,
                services TEXT NOT NULL DEFAULT '{}',
                faq TEXT NOT NULL DEFAULT '{}',
                discord_webhook TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS bookings (
                code TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                service TEXT NOT NULL,
                service_label TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed',
                confirmation_sent INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(tenant_id) REFERENCES tenants(id)
            );

            CREATE TABLE IF NOT EXISTS call_records (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL DEFAULT '',
                transcript TEXT NOT NULL DEFAULT '',
                duration_s INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS lemur_dossiers (
                call_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL DEFAULT '',
                tenant_name TEXT NOT NULL DEFAULT '',
                caller_name TEXT NOT NULL DEFAULT '',
                caller_phone TEXT NOT NULL DEFAULT '',
                intent TEXT NOT NULL DEFAULT '',
                urgency INTEGER NOT NULL DEFAULT 1,
                sentiment TEXT NOT NULL DEFAULT '',
                summary TEXT NOT NULL DEFAULT '',
                actions TEXT NOT NULL DEFAULT '[]',
                draft_message TEXT NOT NULL DEFAULT '',
                raw_lemur TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tool_events (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL DEFAULT '',
                tool TEXT NOT NULL,
                arguments TEXT NOT NULL DEFAULT '{}',
                result TEXT NOT NULL DEFAULT '{}',
                at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );
        """)
        _seed_tenants(conn)


_DEMO_TENANTS = [
    {
        "id": "bright-dental",
        "name": "Brightsmile Dental",
        "persona": (
            "You are the scheduling assistant for Brightsmile Dental. "
            "Keep every reply under two sentences and speak naturally, like a receptionist on the phone."
        ),
        "greeting": "Thanks for calling Brightsmile Dental. Are you looking to book an appointment?",
        "open_days": "Monday to Friday",
        "open_hour": 9,
        "close_hour": 17,
        "slot_minutes": 30,
        "services": json.dumps({
            "cleaning": {"label": "Dental Cleaning", "minutes": 30},
            "checkup": {"label": "Routine Checkup", "minutes": 30},
            "whitening": {"label": "Teeth Whitening", "minutes": 60},
            "root-canal": {"label": "Root Canal", "minutes": 90},
        }),
        "faq": json.dumps({
            "parking": "We have free parking in the lot directly behind the building.",
            "insurance": "We accept most major dental insurance plans including Delta Dental and Cigna.",
            "emergency": "For dental emergencies outside office hours, please call our emergency line.",
            "pricing": "Cleanings start at $85. Please call for a full price list.",
        }),
        "discord_webhook": "",
    },
    {
        "id": "apex-legal",
        "name": "Apex Legal Partners",
        "persona": (
            "You are a formal, professional, and discreet legal intake receptionist "
            "for Apex Legal Partners. Keep every reply under two sentences."
        ),
        "greeting": "Thank you for contacting Apex Legal Partners. Are you a new or existing client?",
        "open_days": "Monday to Friday",
        "open_hour": 8,
        "close_hour": 18,
        "slot_minutes": 45,
        "services": json.dumps({
            "consultation": {"label": "Initial Legal Consultation", "minutes": 45},
            "case-review": {"label": "Document and Case Review", "minutes": 60},
            "deposition": {"label": "Deposition Preparation", "minutes": 90},
        }),
        "faq": json.dumps({
            "retainer": "Initial retainers start at $2,500 depending on the case type.",
            "parking": "Validated parking is available underground at 400 Madison Ave.",
            "emergency": "For urgent police arrests or arraignments, call our 24/7 hotline directly.",
            "confidentiality": "All consultations are strictly confidential under attorney-client privilege.",
        }),
        "discord_webhook": "",
    },
    {
        "id": "metro-plumbing",
        "name": "Metro Plumbing and Heating",
        "persona": (
            "You are a friendly and efficient dispatcher for Metro Plumbing and Heating. "
            "Assess urgency quickly and speak in short, clear sentences."
        ),
        "greeting": "Metro Plumbing, how can I help you today?",
        "open_days": "Monday to Saturday",
        "open_hour": 7,
        "close_hour": 19,
        "slot_minutes": 60,
        "services": json.dumps({
            "inspection": {"label": "Plumbing Inspection", "minutes": 60},
            "repair": {"label": "Emergency Repair", "minutes": 120},
            "installation": {"label": "Fixture Installation", "minutes": 90},
            "drain-clean": {"label": "Drain Cleaning", "minutes": 60},
        }),
        "faq": json.dumps({
            "emergency": "We offer 24/7 emergency callouts. Emergency rates apply after 7pm and weekends.",
            "pricing": "Service call starts at $95. Parts and labour quoted on-site.",
            "areas": "We cover the greater metro area within 25 miles of downtown.",
            "guarantee": "All work is guaranteed for 12 months. Parts carry the manufacturer warranty.",
        }),
        "discord_webhook": "",
    },
]


def _seed_tenants(conn: sqlite3.Connection) -> None:
    for t in _DEMO_TENANTS:
        existing = conn.execute(
            "SELECT id FROM tenants WHERE id = ?", (t["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO tenants
                   (id, name, persona, greeting, open_days, open_hour, close_hour,
                    slot_minutes, services, faq, discord_webhook)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    t["id"], t["name"], t["persona"], t["greeting"],
                    t["open_days"], t["open_hour"], t["close_hour"],
                    t["slot_minutes"], t["services"], t["faq"], t["discord_webhook"],
                ),
            )
    conn.commit()
