#!/usr/bin/env python3
"""OmniDesk One-Command Runner

Starts Uvicorn server and Cloudflare Tunnel simultaneously,
automatically extracts the public HTTPS tunnel URL, updates .env,
and prints clean clickable URLs.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 1. Virtual Environment Auto-Detection and Switch
VENV_PYTHON_WIN = ROOT / ".venv" / "Scripts" / "python.exe"
VENV_PYTHON_UNIX = ROOT / ".venv" / "bin" / "python"
VENV_PYTHON = VENV_PYTHON_WIN if os.name == "nt" else VENV_PYTHON_UNIX

if VENV_PYTHON.exists() and sys.executable.lower() != str(VENV_PYTHON).lower():
    try:
        sys.exit(subprocess.call([str(VENV_PYTHON), str(__file__)] + sys.argv[1:]))
    except KeyboardInterrupt:
        sys.exit(0)

# 2. Ensure .env exists and is loaded
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"
if not ENV_FILE.exists() and ENV_EXAMPLE.exists():
    shutil.copy(ENV_EXAMPLE, ENV_FILE)
    print("[+] Created .env from .env.example")

load_dotenv(ENV_FILE)


def update_env_file(key: str, value: str) -> None:
    """Update or append key=value in .env file."""
    if not ENV_FILE.exists():
        return
    if os.environ.get(key) == value:
        return
    try:
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
        found = False
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(f"{key}=") or stripped.startswith(f"#{key}="):
                new_lines.append(f"{key}={value}")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"{key}={value}")
        ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        os.environ[key] = value
    except Exception as exc:
        print(f"[!] Warning: could not update {key} in .env: {exc}")


def sync_agent_tools(tunnel_url: str) -> bool:
    """Sync AssemblyAI voice agent configuration and tool URLs with active tunnel."""
    try:
        import json, httpx
        from dotenv import load_dotenv
        load_dotenv(ENV_FILE, override=True)
        agent_file = ROOT / "agent_id.txt"
        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not agent_file.exists() or not api_key:
            return False
        aid = agent_file.read_text(encoding="utf-8").strip()
        if not aid:
            return False
        raw_def = (ROOT / "agent.json").read_text(encoding="utf-8")
        synced_def = json.loads(raw_def.replace("{{BASE_URL}}", tunnel_url.rstrip("/")))
        headers = {"Authorization": api_key, "Content-Type": "application/json"}
        for attempt in range(1, 5):
            resp = httpx.put(f"https://agents.assemblyai.com/v1/agents/{aid}", headers=headers, json=synced_def, timeout=15)
            if resp.status_code < 400:
                print(f"[+] Synced Voice Agent tools to active tunnel ({aid})")
                return True
            if "does not resolve" in resp.text and attempt < 4:
                time.sleep(2.0)
                continue
            print(f"[!] Warning: Voice agent sync returned {resp.status_code}: {resp.text}")
            break
    except Exception as exc:
        print(f"[!] Warning: Could not sync agent tools to AssemblyAI: {exc}")
    return False


def parse_args():
    parser = argparse.ArgumentParser(description="OmniDesk One-Command Runner")
    parser.add_argument("--no-tunnel", action="store_true", help="Do not start Cloudflare tunnel")
    parser.add_argument("--port", type=int, default=8000, help="Local port (default: 8000)")
    parser.add_argument("--host", default="127.0.0.1", help="Local host (default: 127.0.0.1)")
    return parser.parse_args()


def main():
    args = parse_args()
    port = args.port
    host = args.host
    tunnel_proc = None
    tunnel_url = None
    shutdown_flag = threading.Event()

    has_cloudflared = bool(shutil.which("cloudflared"))

    print("\n" + "=" * 65)
    print("                 OMNIDESK PLATFORM LAUNCHER")
    print("=" * 65)

    if not args.no_tunnel and has_cloudflared:
        print("[*] Starting Cloudflare Tunnel for AssemblyAI tools...")
        try:
            tunnel_proc = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            def read_tunnel():
                nonlocal tunnel_url
                pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
                while not shutdown_flag.is_set() and tunnel_proc and tunnel_proc.poll() is None:
                    try:
                        line = tunnel_proc.stdout.readline()
                        if not line:
                            break
                        match = pattern.search(line)
                        if match and not tunnel_url:
                            tunnel_url = match.group(0)
                            update_env_file("PUBLIC_API_BASE_URL", tunnel_url)
                            print(f"[+] Cloudflare Tunnel Active: {tunnel_url}")
                            print(f"[+] Automatically updated PUBLIC_API_BASE_URL in .env")
                    except Exception:
                        pass

            t = threading.Thread(target=read_tunnel, daemon=True)
            t.start()

            # Wait up to 15s for tunnel URL to be extracted
            start_time = time.time()
            while not tunnel_url and time.time() - start_time < 15:
                time.sleep(0.3)

            # Ensure sync completed
            if tunnel_url:
                sync_agent_tools(tunnel_url)
        except Exception as exc:
            print(f"[!] Could not start cloudflared: {exc}")
    elif not has_cloudflared and not args.no_tunnel:
        print("[!] 'cloudflared' not found in PATH. Running in local-only mode.")

    print("-" * 65)
    print(f"  Owner Dashboard:    http://localhost:{port}/dashboard")
    print(f"  Public Landing:     http://localhost:{port}/")
    print(f"  Try Salon Demo:     http://localhost:{port}/demo")
    if tunnel_url:
        print(f"  Public Tunnel URL:  {tunnel_url}")
    print("-" * 65)
    print("Press CTRL+C anytime to stop the server and tunnel.\n")

    def cleanup(sig=None, frame=None):
        shutdown_flag.set()
        if tunnel_proc and tunnel_proc.poll() is None:
            print("\n[*] Stopping Cloudflare Tunnel...")
            tunnel_proc.terminate()
            try:
                tunnel_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                tunnel_proc.kill()
        print("[*] OmniDesk stopped cleanly.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        import uvicorn
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=True,
            reload_dirs=[str(ROOT / "app"), str(ROOT / "web")],
            reload_excludes=[".env", "*.txt", "*.db", "data/*", "*.json"],
        )
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
