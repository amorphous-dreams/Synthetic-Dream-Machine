"""A freeze keeps exact selected bytes and refuses changed native evidence."""

import hashlib
import json
from datetime import datetime

import pytest

from trial_freeze import freeze_one
from trial_inventory import inventory_claude
from capture_sources import _source_key


def arrange(tmp_path):
    root = tmp_path / "native"
    root.mkdir()
    path = root / "session.jsonl"
    old = b'{"timestamp":"2026-10-06T10:00:00Z","type":"user"}\n'
    user = b'{"timestamp":"2026-10-07T10:00:00Z","type":"user","uuid":"a"}\n'
    attachment = b'{"timestamp":"2026-10-07T10:01:00Z","type":"attachment"}\n'
    assistant = b'{"timestamp":"2026-10-07T10:02:00Z","type":"assistant","uuid":"b"}\n'
    path.write_bytes(old + user + attachment + assistant)
    inventory = inventory_claude(root, datetime.fromisoformat("2026-10-07T00:00:00Z"),
                                 datetime.fromisoformat("2026-10-14T00:00:00Z"))
    manifest = tmp_path / "inventory.json"
    manifest.write_text(json.dumps(inventory))
    return path, manifest, user + attachment + assistant


def test_freeze_copies_exact_bounded_rows_and_receipts_partial_scope(tmp_path):
    path, manifest, wanted = arrange(tmp_path)
    before = path.read_bytes(), path.stat().st_mtime_ns
    receipt = freeze_one(manifest, path, tmp_path / "trial")
    assert (tmp_path / "trial/sources/claude/session.jsonl").read_bytes() == wanted
    assert receipt["evidence_sha256"] == hashlib.sha256(wanted).hexdigest()
    assert receipt["rows_by_type"] == {"user": 1, "attachment": 1, "assistant": 1}
    assert receipt["scope"] == "partial session"
    assert (path.read_bytes(), path.stat().st_mtime_ns) == before
    assert (tmp_path / "trial").stat().st_mode & 0o777 == 0o700


def test_freeze_refuses_source_changed_since_inventory(tmp_path):
    path, manifest, _wanted = arrange(tmp_path)
    path.write_bytes(path.read_bytes() + b'{}\n')
    with pytest.raises(ValueError, match="changed after inventory"):
        freeze_one(manifest, path, tmp_path / "trial")
    assert not (tmp_path / "trial").exists()


def test_subagent_freeze_preserves_source_identity(tmp_path):
    root = tmp_path / "native"
    child = root / "project" / "parent-session" / "subagents" / "agent-child.jsonl"
    child.parent.mkdir(parents=True)
    child.write_text('{"timestamp":"2026-10-07T10:00:00Z","type":"user",'
                     '"sessionId":"parent-session","agentId":"child"}\n')
    inventory = inventory_claude(root, datetime.fromisoformat("2026-10-07T00:00:00Z"),
                                 datetime.fromisoformat("2026-10-14T00:00:00Z"))
    manifest = tmp_path / "inventory.json"
    manifest.write_text(json.dumps(inventory))
    receipt = freeze_one(manifest, child, tmp_path / "trial")
    assert _source_key("claude", receipt["evidence"]) == _source_key("claude", str(child))
