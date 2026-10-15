"""The inventory selects by event time and leaves native transcript bytes alone."""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

from trial_inventory import inventory_claude


def test_bounded_inventory_preserves_source_and_reports_unknowns(tmp_path):
    root = tmp_path / "native"
    root.mkdir()
    transcript = root / "session.jsonl"
    rows = [
        {"timestamp": "2026-10-06T23:59:59-07:00", "type": "user"},
        {"timestamp": "2026-10-07T00:00:00-07:00", "type": "user", "uuid": "a"},
        {"timestamp": "2026-10-13T23:59:59-07:00", "type": "assistant", "uuid": "b"},
        {"timestamp": "2026-10-14T00:00:00-07:00", "type": "assistant"},
        {"type": "summary"},
    ]
    original = b"".join(json.dumps(row).encode() + b"\n" for row in rows) + b"{broken\n"
    transcript.write_bytes(original)
    before = transcript.stat().st_mtime_ns
    result = inventory_claude(
        root,
        datetime.fromisoformat("2026-10-07T00:00:00-07:00"),
        datetime.fromisoformat("2026-10-14T00:00:00-07:00"),
    )
    assert result["counts"]["rows_selected"] == 2
    assert result["counts"]["rows_without_event_time"] == 1
    assert result["counts"]["invalid_json"] == 1
    assert [row["uuid"] for row in result["files"][0]["selected"]] == ["a", "b"]
    assert transcript.read_bytes() == original
    assert transcript.stat().st_mtime_ns == before


def test_window_requires_offsets(tmp_path):
    with pytest.raises(ValueError, match="time zones"):
        inventory_claude(tmp_path, datetime(2026, 10, 7), datetime(2026, 10, 14))


def test_cli_creates_private_manifest_once_outside_source(tmp_path):
    root = tmp_path / "native"
    root.mkdir()
    (root / "session.jsonl").write_text('{"timestamp":"2026-10-07T12:00:00Z"}\n')
    out = tmp_path / "trial.json"
    base = [sys.executable, str(Path(__file__).with_name("trial_inventory.py")),
            "--root", str(root), "--start", "2026-10-07T00:00:00Z",
            "--end", "2026-10-14T00:00:00Z", "--out"]
    assert subprocess.run([*base, str(root / "trial.json")], capture_output=True).returncode != 0
    assert subprocess.run([*base, str(out)], capture_output=True).returncode == 0
    assert out.stat().st_mode & 0o777 == 0o600
    assert subprocess.run([*base, str(out)], capture_output=True).returncode != 0
