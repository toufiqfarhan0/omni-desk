"""Async LeMUR post-call intelligence wrapper for OmniDesk.

Sends the full call transcript to AssemblyAI LeMUR and extracts a structured
executive dossier: intent, urgency score, sentiment, summary, action items,
and a pre-written follow-up message for the business owner.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid

import httpx

logger = logging.getLogger(__name__)

LEMUR_URL = "https://api.assemblyai.com/lemur/v3/generate/task"

_EXTRACTION_PROMPT = """
You are an executive business intelligence analyst. Analyze this phone call transcript
and return a JSON object with exactly these fields:

{
  "intent": "One of: New Booking | Reschedule | Cancellation | FAQ | Emergency | Complaint | Sales Inquiry | Other",
  "urgency": <integer 1-5 where 1=Routine, 2=Moderate, 3=Important, 4=Urgent, 5=Critical Emergency>,
  "sentiment": "<Describe the caller's emotional trajectory in one sentence, e.g. 'Anxious at start, reassured and grateful by end'>",
  "summary": "<Two sentences max. What the caller needed and what was resolved.>",
  "actions": ["<Action item 1 for the business owner>", "<Action item 2>"],
  "draft_message": "<A ready-to-send follow-up message to the caller. 1-2 sentences. Include confirmation code if booked.>"
}

Rules:
- Return ONLY valid JSON. No markdown fences, no extra text.
- If no booking was made, draft_message should still acknowledge the call and offer a next step.
- If urgency is 4 or 5, the first action item must be "IMMEDIATE: <what to do right now>".
- Keep summary and draft_message short enough to read in under 10 seconds.
- Base everything strictly on what was said in the transcript. Do not invent details.

Transcript:
"""


async def extract_dossier(
    transcript: str,
    tenant_id: str,
    tenant_name: str,
    caller_name: str = "",
    caller_phone: str = "",
    call_id: str = "",
) -> dict:
    """Call LeMUR and return a structured dossier dict.

    Returns a safe fallback dict on any error so callers never see an exception.
    """
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "")
    if not api_key or not transcript.strip():
        return _fallback_dossier(call_id, tenant_id, tenant_name, caller_name, caller_phone)

    prompt = _EXTRACTION_PROMPT + transcript.strip()
    payload = {
        "prompt": prompt,
        "final_model": "anthropic/claude-3-5-sonnet",
        "temperature": 0.1,
        "max_output_size": 800,
        "input_text": transcript,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                LEMUR_URL,
                headers={
                    "Authorization": api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "")
    except Exception as exc:
        logger.warning("LeMUR request failed: %s", exc)
        return _fallback_dossier(call_id, tenant_id, tenant_name, caller_name, caller_phone)

    parsed = _parse_json(raw)
    return {
        "call_id": call_id or str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "caller_name": caller_name,
        "caller_phone": caller_phone,
        "intent": parsed.get("intent", "Other"),
        "urgency": max(1, min(5, int(parsed.get("urgency", 1)))),
        "sentiment": parsed.get("sentiment", ""),
        "summary": parsed.get("summary", ""),
        "actions": parsed.get("actions", []),
        "draft_message": parsed.get("draft_message", ""),
        "raw_lemur": raw,
    }


def _parse_json(raw: str) -> dict:
    """Extract JSON from LeMUR output even when wrapped in extra text."""
    raw = raw.strip()
    # Strip markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to find the first {...} block
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def _fallback_dossier(
    call_id: str,
    tenant_id: str,
    tenant_name: str,
    caller_name: str,
    caller_phone: str,
) -> dict:
    return {
        "call_id": call_id or str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "caller_name": caller_name,
        "caller_phone": caller_phone,
        "intent": "Other",
        "urgency": 1,
        "sentiment": "Unable to analyse — transcript too short or LeMUR unavailable.",
        "summary": "Call completed. Dossier analysis unavailable for this session.",
        "actions": ["Review call manually if important."],
        "draft_message": f"Thank you for calling {tenant_name}. We look forward to assisting you.",
        "raw_lemur": "",
    }
