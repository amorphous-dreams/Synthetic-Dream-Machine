#!/usr/bin/env python3
"""
Smoke test the repo MCP server over stdio.

Usage:
  python scripts/mcp-smoke.py
  python scripts/mcp-smoke.py -- python -m lares.lararium_mcp
  python scripts/mcp-smoke.py -- ./lares/lararium_mcp/run.sh
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

DEFAULT_CMD = [sys.executable, "-m", "lares.lararium_mcp"]


def send(proc: subprocess.Popen[str], msg: dict[str, Any]) -> None:
    assert proc.stdin is not None
    proc.stdin.write(json.dumps(msg) + "\n")
    proc.stdin.flush()


def recv(proc: subprocess.Popen[str]) -> dict[str, Any]:
    assert proc.stdout is not None
    line = proc.stdout.readline()
    if not line:
        stderr = proc.stderr.read() if proc.stderr else ""
        raise RuntimeError(f"MCP server exited without response.\nSTDERR:\n{stderr}")
    return json.loads(line)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    if not Path("pyproject.toml").exists():
        print("ERROR: run from repo root", file=sys.stderr)
        return 1

    cmd = args.cmd
    if cmd and cmd[0] == "--":
        cmd = cmd[1:]
    if not cmd:
        cmd = DEFAULT_CMD

    print(f"[mcp-smoke] launching: {' '.join(cmd)}", file=sys.stderr)

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    try:
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "lares-mcp-smoke", "version": "0.1.0"},
                },
            },
        )
        init = recv(proc)
        print(json.dumps(init, indent=2))

        send(proc, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})

        send(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        tools = recv(proc)
        print(json.dumps(tools, indent=2))

        return 0 if "result" in tools else 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
