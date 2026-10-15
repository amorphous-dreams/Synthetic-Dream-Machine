"""Red-first custody contract over private frozen evidence, never native history."""

import hashlib
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from trial_intake import IntentConflict, intake_frozen, intake_status, read_evidence


WINDOW = {"start_inclusive": "2026-10-07T00:00:00-07:00",
          "end_exclusive": "2026-10-14T00:00:00-07:00"}
HOST = "test-host"


def frozen(tmp_path, name, text, native="/native/project/session.jsonl"):
    root = tmp_path / name
    root.mkdir()
    row = {"timestamp": "2026-10-08T12:00:00Z", "type": "user",
           "uuid": "turn-1", "sessionId": "session", "message": text}
    raw = (json.dumps(row) + "\n").encode()
    evidence = root / "session.jsonl"
    evidence.write_bytes(raw)
    receipt = root / "freeze-receipt.json"
    receipt.write_text(json.dumps({
        "schema": "lararium.sensorium.trial-freeze.claude.v1",
        "window": WINDOW, "native_source": native,
        "native_size": len(raw), "native_mtime_ns": 1,
        "evidence": str(evidence), "evidence_bytes": len(raw),
        "evidence_sha256": hashlib.sha256(raw).hexdigest(),
        "rows_by_type": {"user": 1}, "rows_without_event_time": 0,
        "invalid_json": 0, "scope": "whole source",
    }))
    return receipt, raw


def test_atomic_custody_and_same_intent_retry(tmp_path):
    receipt_path, raw = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    first = intake_frozen(state, receipt_path, "observe-A", source_host=HOST)
    assert first == intake_frozen(state, receipt_path, "observe-A", source_host=HOST)
    assert first["source_key"] == "claude:test-host:session"
    assert first["revision_sha256"] == hashlib.sha256(raw).hexdigest()
    assert read_evidence(state, first["source_key"], first["revision_sha256"]) == raw
    assert intake_status(state) == {
        "sources": 1, "revisions": 1, "observations": 1,
        "source_manifests": 1, "receipts": 1, "projection_pending": 1,
        "source_frontiers": {"claude:test-host:session": 1}, "content_frontiers": {},
    }


def test_a_b_a_reuses_revision_but_keeps_three_observations(tmp_path):
    a, a_raw = frozen(tmp_path, "A", "alpha")
    b, _ = frozen(tmp_path, "B", "beta", native="/renamed/project/session.jsonl")
    again, _ = frozen(tmp_path, "A-again", "alpha", native="/another/project/session.jsonl")
    state = tmp_path / "state"
    first = intake_frozen(state, a, "intent-1", source_host=HOST)
    second = intake_frozen(state, b, "intent-2", source_host=HOST)
    third = intake_frozen(state, again, "intent-3", source_host=HOST)
    assert first["source_key"] == second["source_key"] == third["source_key"]
    assert first["revision_sha256"] == third["revision_sha256"] == hashlib.sha256(a_raw).hexdigest()
    assert second["revision_sha256"] != first["revision_sha256"]
    assert [first["frontier"], second["frontier"], third["frontier"]] == [1, 2, 3]
    status = intake_status(state)
    assert (status["revisions"], status["observations"], status["receipts"],
            status["projection_pending"]) == (2, 3, 3, 3)
    assert status["source_frontiers"] == {"claude:test-host:session": 3}


def test_reused_intent_with_new_bytes_refuses_without_advancing(tmp_path):
    a, _ = frozen(tmp_path, "A", "alpha")
    b, _ = frozen(tmp_path, "B", "beta")
    state = tmp_path / "state"
    intake_frozen(state, a, "one-intent", source_host=HOST)
    with pytest.raises(IntentConflict):
        intake_frozen(state, b, "one-intent", source_host=HOST)
    assert intake_status(state)["observations"] == 1


@pytest.mark.parametrize("cut,expected", [
    ("after_evidence", 0), ("after_manifest", 0),
    ("after_receipt", 0), ("before_commit", 0), ("after_commit", 1),
])
def test_process_death_at_transaction_cut_returns_one_receipt(tmp_path, cut, expected):
    receipt_path, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    script = ("import os,sys; from trial_intake import intake_frozen; "
              "intake_frozen(sys.argv[1],sys.argv[2],'same-intent',source_host='test-host',"
              "cut_hook=lambda stage: os._exit(37) if stage==sys.argv[3] else None)")
    env = dict(os.environ)
    env["PYTHONPATH"] = str(Path(__file__).parent)
    process = subprocess.run([sys.executable, "-c", script, str(state), str(receipt_path), cut], env=env)
    assert process.returncode == 37
    assert intake_status(state)["observations"] == expected
    recovered = intake_frozen(state, receipt_path, "same-intent", source_host=HOST)
    assert recovered["frontier"] == 1
    assert intake_status(state)["observations"] == 1


def test_tampered_frozen_bytes_refuse_before_state_creation(tmp_path):
    receipt_path, _ = frozen(tmp_path, "A", "alpha")
    (receipt_path.parent / "session.jsonl").write_text("changed\n")
    state = tmp_path / "state"
    with pytest.raises(ValueError, match="evidence hash"):
        intake_frozen(state, receipt_path, "intent", source_host=HOST)
    assert not state.exists()


def test_trial_state_refuses_native_source_root(tmp_path):
    receipt_path, _ = frozen(tmp_path, "A", "alpha", native=str(tmp_path / "native/project/session.jsonl"))
    state = tmp_path / "native" / "trial-state"
    with pytest.raises(ValueError, match="outside native history"):
        intake_frozen(state, receipt_path, "intent", source_host=HOST)
    assert not state.exists()


def test_retry_refuses_corrupted_stored_evidence(tmp_path):
    receipt_path, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    first = intake_frozen(state, receipt_path, "intent", source_host=HOST)
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        conn.execute("UPDATE revision SET evidence=? WHERE source_key=? AND sha256=?",
                     (b"corrupted", first["source_key"], first["revision_sha256"]))
    with pytest.raises(ValueError, match="stored evidence"):
        intake_frozen(state, receipt_path, "intent", source_host=HOST)
    with pytest.raises(ValueError, match="stored evidence"):
        read_evidence(state, first["source_key"], first["revision_sha256"])


def test_same_producer_session_on_two_hosts_keeps_distinct_sources(tmp_path):
    receipt_path, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    one = intake_frozen(state, receipt_path, "host-a-observation", source_host="host-a")
    two = intake_frozen(state, receipt_path, "host-b-observation", source_host="host-b")
    assert one["source_key"] == "claude:host-a:session"
    assert two["source_key"] == "claude:host-b:session"
    assert intake_status(state)["sources"] == 2
