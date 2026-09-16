"""Publish agent.json to AssemblyAI as a stored agent.

Run once to create, then re-run with --update <agent_id> after every edit to
agent.json. The agent lives on AssemblyAI's servers; nothing of yours stays
connected during a call except the booking API.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

AGENTS_URL = "https://agents.assemblyai.com/v1/agents"
ROOT = Path(__file__).resolve().parent.parent


def load_definition(base_url: str) -> dict:
    raw = (ROOT / "agent.json").read_text(encoding="utf-8")
    return json.loads(raw.replace("{{BASE_URL}}", base_url.rstrip("/")))


def check_reachable(base_url: str) -> None:
    parsed = urlparse(base_url)
    if parsed.scheme != "https":
        sys.exit(f"PUBLIC_API_BASE_URL must be https, got: {base_url}")
    if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
        sys.exit(
            "PUBLIC_API_BASE_URL points at localhost. AssemblyAI calls your tools "
            "from its own servers, so the URL has to be publicly reachable.\n"
            "Try: cloudflared tunnel --url http://localhost:8000"
        )
    try:
        resp = httpx.post(f"{base_url.rstrip('/')}/tools/get_today", timeout=10)
        resp.raise_for_status()
    except Exception as exc:
        sys.exit(f"Could not reach {base_url}/tools/get_today — is the API running?\n{exc}")
    print(f"  booking API reachable: {resp.json()['message']}")


def main() -> None:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", metavar="AGENT_ID", help="update an existing agent")
    parser.add_argument("--skip-reachability", action="store_true")
    args = parser.parse_args()

    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    base_url = os.getenv("PUBLIC_API_BASE_URL")
    if not api_key:
        sys.exit("ASSEMBLYAI_API_KEY is not set. Copy .env.example to .env and fill it in.")
    if not base_url:
        sys.exit("PUBLIC_API_BASE_URL is not set. See .env.example.")

    if not args.skip_reachability:
        check_reachable(base_url)

    definition = load_definition(base_url)
    headers = {"Authorization": api_key, "Content-Type": "application/json"}

    if args.update:
        resp = httpx.put(f"{AGENTS_URL}/{args.update}", headers=headers, json=definition, timeout=30)
    else:
        resp = httpx.post(AGENTS_URL, headers=headers, json=definition, timeout=30)

    if resp.status_code >= 400:
        sys.exit(f"AssemblyAI returned {resp.status_code}:\n{resp.text}")

    agent_id = resp.json().get("id", args.update)
    (ROOT / "agent_id.txt").write_text(agent_id, encoding="utf-8")
    verb = "Updated" if args.update else "Created"
    print(f"\n{verb} agent {agent_id}")
    print(f"  {len(definition['tools'])} HTTP tools pointed at {base_url}")
    print("  saved to agent_id.txt")


if __name__ == "__main__":
    main()
