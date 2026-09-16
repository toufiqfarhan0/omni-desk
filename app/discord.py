"""Discord webhook sender for OmniDesk.

Builds and fires rich embed cards to the business owner's Discord channel
at call end (standard dossier) or immediately during a call (urgent escalation).
Non-fatal: all errors are logged and swallowed so a missing webhook never
breaks a call.
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

_URGENCY_COLOR = {
    1: 0x22C55E,   # green-500
    2: 0x84CC16,   # lime-500
    3: 0xF59E0B,   # amber-500
    4: 0xF97316,   # orange-500
    5: 0xEF4444,   # red-500
}

_URGENCY_LABEL = {1: "Routine", 2: "Moderate", 3: "Important", 4: "Urgent", 5: "Critical"}


async def send_dossier_embed(webhook_url: str, dossier: dict) -> bool:
    """Send a post-call executive dossier as a Discord rich embed.

    Returns True on success, False on any error.
    """
    if not webhook_url:
        return False

    urgency = max(1, min(5, int(dossier.get("urgency", 1))))
    color = _URGENCY_COLOR[urgency]
    urgency_label = _URGENCY_LABEL[urgency]

    actions = dossier.get("actions", [])
    actions_text = "\n".join(f"- {a}" for a in actions[:5]) if actions else "None recorded."

    caller_name = dossier.get("caller_name") or "Unknown caller"
    caller_phone = dossier.get("caller_phone") or "—"
    tenant_name = dossier.get("tenant_name", "OmniDesk")

    embed = {
        "title": f"New Call — {tenant_name}",
        "color": color,
        "fields": [
            {"name": "Caller", "value": caller_name, "inline": True},
            {"name": "Phone", "value": caller_phone, "inline": True},
            {"name": "Intent", "value": dossier.get("intent", "—"), "inline": True},
            {"name": "Urgency", "value": urgency_label, "inline": True},
            {"name": "Sentiment", "value": dossier.get("sentiment") or "—", "inline": False},
            {"name": "Summary", "value": dossier.get("summary") or "—", "inline": False},
            {"name": "Action Items", "value": actions_text, "inline": False},
            {
                "name": "Draft Follow-Up (copy and send)",
                "value": f"```{dossier.get('draft_message', '—')}```",
                "inline": False,
            },
        ],
        "footer": {"text": "OmniDesk — Switchboard AI"},
        "timestamp": _utc_now(),
    }

    return await _post_embed(webhook_url, embed)


async def send_escalation_embed(webhook_url: str, payload: dict) -> bool:
    """Send an immediate escalation alert during an active call."""
    if not webhook_url:
        return False

    embed = {
        "title": "URGENT ESCALATION",
        "description": (
            f"**{payload.get('caller_name', 'A caller')}** requires immediate attention."
        ),
        "color": _URGENCY_COLOR[5],
        "fields": [
            {"name": "Caller", "value": payload.get("caller_name", "—"), "inline": True},
            {"name": "Phone", "value": payload.get("phone", "—"), "inline": True},
            {"name": "Reason", "value": payload.get("reason", "—"), "inline": False},
        ],
        "footer": {"text": "OmniDesk — Escalation Alert"},
        "timestamp": _utc_now(),
    }

    return await _post_embed(webhook_url, embed, content="@here An urgent call needs attention.")


async def send_test_embed(webhook_url: str) -> bool:
    """Fire a test embed to verify the webhook is live."""
    if not webhook_url:
        return False

    embed = {
        "title": "OmniDesk Webhook Test",
        "description": "Your Discord integration is working. Call summaries will appear here.",
        "color": 0x0066FF,
        "footer": {"text": "OmniDesk — Switchboard AI"},
        "timestamp": _utc_now(),
    }
    return await _post_embed(webhook_url, embed)


async def _post_embed(webhook_url: str, embed: dict, content: str = "") -> bool:
    payload: dict = {"embeds": [embed]}
    if content:
        payload["content"] = content
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code not in (200, 204):
                logger.warning("Discord webhook returned %s: %s", resp.status_code, resp.text[:200])
                return False
        return True
    except Exception as exc:
        logger.warning("Discord webhook failed: %s", exc)
        return False


def _utc_now() -> str:
    from datetime import timezone, datetime
    return datetime.now(timezone.utc).isoformat()
