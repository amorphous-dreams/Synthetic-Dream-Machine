"""A repository fixture keeps its own provenance and replays into disposable state."""

import hashlib
import json
import sqlite3

import pytest

from trial_fixture_replay import replay_fixture
from trial_intake import intake_status


def fixture(tmp_path):
    root = tmp_path / "claude-week-2026-10-07"
    entries = []
    for role, relative, agent in (
        ("main", "sources/claude/session.jsonl", None),
        ("subagent", "sources/claude/session/subagents/agent-a.jsonl", "a"),
    ):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        row = {"timestamp": "2026-10-08T12:00:00Z", "type": "user",
               "uuid": f"turn-{role}", "sessionId": "session", "message": role}
        if agent:
            row["agentId"] = agent
        raw = (json.dumps(row) + "\n").encode()
        path.write_bytes(raw)
        entries.append({"role": role, "path": relative, "scope": "whole source",
                        "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
                        "rows": 1, "rows_by_type": {"user": 1}})
    manifest = root / "manifest.json"
    manifest.write_text(json.dumps({
        "schema": "lararium.sensorium.fixture.claude-week.v1",
        "window": {"start_inclusive": "2026-10-07T00:00:00-07:00",
                   "end_exclusive": "2026-10-14T00:00:00-07:00"},
        "sources": entries,
    }))
    return manifest


def test_fixture_replay_keeps_provenance_and_both_frontiers(tmp_path):
    manifest = fixture(tmp_path)
    trial = tmp_path / "trial"
    result = replay_fixture(manifest, trial, source_host="fixture-test")
    assert result["observations"] == 2
    assert result["typed_blocks"] == 2
    assert {item["role"] for item in result["sources"]} == {"main", "subagent"}
    assert all(item["source_frontier"] == item["content_frontier"] == 1
               for item in result["sources"])
    assert intake_status(trial / "state")["projection_pending"] == 0
    with sqlite3.connect(trial / "state/trial-intake-v2.sqlite3") as conn:
        manifests = [json.loads(row[0]) for row in conn.execute("SELECT manifest_json FROM source_manifest")]
    assert all(item["provenance_kind"] == "repository-fixture" for item in manifests)
    assert all("native_locator" not in item and "native_root" not in item for item in manifests)
    with pytest.raises(ValueError, match="fresh"):
        replay_fixture(manifest, trial, source_host="fixture-test")


def test_fixture_tamper_refuses_before_creating_state(tmp_path):
    manifest = fixture(tmp_path)
    (manifest.parent / "sources/claude/session.jsonl").write_text("changed\n")
    trial = tmp_path / "trial"
    with pytest.raises(ValueError, match="hash, length or row count"):
        replay_fixture(manifest, trial, source_host="fixture-test")
    assert not trial.exists()
