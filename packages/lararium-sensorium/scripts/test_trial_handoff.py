"""A relocated, read-only handoff carries the same source bytes into intake."""

import json
import shutil

import pytest

from test_trial_intake import HOST, frozen
from trial_handoff import stage_frozen
from trial_intake import intake_frozen, intake_status, read_evidence


def test_handoff_survives_container_path_relocation(tmp_path):
    original, raw = frozen(tmp_path, "freeze", "alpha")
    original_bytes = original.read_bytes()
    staged = tmp_path / "host-handoff"
    handoff = stage_frozen(original, staged, source_host=HOST)
    relocated = tmp_path / "container-handoff"
    shutil.move(staged, relocated)
    receipt = relocated / "freeze-receipt.json"
    assert json.loads(receipt.read_text())["evidence"] == "evidence.jsonl"
    assert handoff["evidence_bytes"] == len(raw)
    result = intake_frozen(tmp_path / "state", receipt, "one", source_host=HOST)
    assert result["source_key"] == handoff["source_key"]
    assert read_evidence(tmp_path / "state", result["source_key"], result["revision_sha256"]) == raw
    assert original.read_bytes() == original_bytes
    assert intake_status(tmp_path / "state")["content_frontiers"] == {}


def test_handoff_refuses_renamed_host_and_changed_evidence(tmp_path):
    original, _ = frozen(tmp_path, "freeze", "alpha")
    staged = tmp_path / "handoff"
    stage_frozen(original, staged, source_host=HOST)
    receipt = staged / "freeze-receipt.json"
    with pytest.raises(ValueError, match="host namespace"):
        intake_frozen(tmp_path / "state", receipt, "one", source_host="another-host")
    assert not (tmp_path / "state").exists()
    (staged / "evidence.jsonl").write_bytes(b"changed\n")
    with pytest.raises(ValueError, match="evidence hash"):
        intake_frozen(tmp_path / "state", receipt, "one", source_host=HOST)
    assert not (tmp_path / "state").exists()


def test_handoff_refuses_reuse_and_nested_freeze(tmp_path):
    original, _ = frozen(tmp_path, "freeze", "alpha")
    staged = tmp_path / "handoff"
    stage_frozen(original, staged, source_host=HOST)
    with pytest.raises(FileExistsError):
        stage_frozen(original, staged, source_host=HOST)
    with pytest.raises(ValueError, match="outside"):
        stage_frozen(original, original.parent / "nested", source_host=HOST)


def test_handoff_without_ready_marker_never_enters_state(tmp_path):
    original, _ = frozen(tmp_path, "freeze", "alpha")
    staged = tmp_path / "handoff"
    stage_frozen(original, staged, source_host=HOST)
    (staged / "handoff-ready.json").unlink()
    with pytest.raises(OSError):
        intake_frozen(tmp_path / "state", staged / "freeze-receipt.json", "one", source_host=HOST)
    assert not (tmp_path / "state").exists()
