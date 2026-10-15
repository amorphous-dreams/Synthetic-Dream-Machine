"""Typed ground lands after raw custody; a separate frontier names that fact."""

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from test_trial_intake import HOST, frozen
from capture_sources import _parse_claude_lines
from trial_intake import intake_frozen, intake_status
from trial_project import project_observation


def test_parser_counts_nontext_eligible_rows_without_claiming_blocks():
    rows = [
        {"type": "assistant", "message": {"content": [{"type": "thinking", "thinking": ""}]}},
        {"type": "user", "message": {"content": [{"type": "tool_result",
            "content": [{"type": "tool_reference", "tool_use_id": "tool-1"}]}]}},
        {"type": "user", "message": {"content": "operator text"}},
    ]
    stats = {}
    blocks = _parse_claude_lines((json.dumps(row) for row in rows), stats=stats)
    assert len(blocks) == 1
    assert stats["eligible_rows"] == 3
    assert stats["unprojected_eligible_rows"] == 2
    assert stats["unprojected_shapes"] == {
        "assistant:list:thinking": 1, "user:list:tool_result": 1,
    }


def test_typed_block_lands_once_and_replay_verifies_it(tmp_path):
    freeze, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    intake = intake_frozen(state, freeze, "one", source_host=HOST)
    assert intake_status(state)["content_frontiers"] == {}
    first = project_observation(state, intake["observation_id"])
    assert first == project_observation(state, intake["observation_id"])
    assert first["status"] == "landed" and first["typed_blocks"] == 1
    assert first["content_frontier"] == 1
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        cid, text, metadata = conn.execute(
            "SELECT cid,text,metadata_json FROM typed_content").fetchone()
        assert len(cid) == 64 and text == "alpha"
        assert json.loads(metadata)["lar_speaker"] == "operator"
        assert conn.execute("SELECT count(*) FROM projection_block").fetchone()[0] == 1
    assert intake_status(state)["content_frontiers"] == {intake["source_key"]: 1}


def test_revision_reuse_and_out_of_order_projection_keep_contiguous_frontier(tmp_path):
    a, _ = frozen(tmp_path, "A", "alpha")
    b, _ = frozen(tmp_path, "B", "beta")
    again, _ = frozen(tmp_path, "A-again", "alpha")
    state = tmp_path / "state"
    one = intake_frozen(state, a, "one", source_host=HOST)
    two = intake_frozen(state, b, "two", source_host=HOST)
    three = intake_frozen(state, again, "three", source_host=HOST)
    second = project_observation(state, two["observation_id"])
    assert second["content_frontier"] == 0
    assert intake_status(state)["content_frontiers"] == {}
    assert project_observation(state, one["observation_id"])["content_frontier"] == 2
    assert project_observation(state, three["observation_id"])["content_frontier"] == 3
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM typed_content").fetchone()[0] == 2
        assert conn.execute("SELECT count(*) FROM projection_block").fetchone()[0] == 3
        first_cid = conn.execute("SELECT cid FROM projection_block WHERE observation_id=?",
                                 (one["observation_id"],)).fetchone()[0]
        third_cid = conn.execute("SELECT cid FROM projection_block WHERE observation_id=?",
                                 (three["observation_id"],)).fetchone()[0]
        assert first_cid == third_cid


@pytest.mark.parametrize("cut,landed", [
    ("after_blocks", False), ("before_commit", False), ("after_commit", True),
])
def test_projection_process_death_retries_one_disposition(tmp_path, cut, landed):
    freeze, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    intake = intake_frozen(state, freeze, "one", source_host=HOST)
    script = ("import os,sys; from trial_project import project_observation; "
              "project_observation(sys.argv[1],int(sys.argv[2]),"
              "cut_hook=lambda stage: os._exit(37) if stage==sys.argv[3] else None)")
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).parent))
    result = subprocess.run([sys.executable, "-c", script, str(state),
                             str(intake["observation_id"]), cut], env=env)
    assert result.returncode == 37
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM typed_content").fetchone()[0] == int(landed)
    replay = project_observation(state, intake["observation_id"])
    assert replay["typed_blocks"] == 1
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM projection_receipt").fetchone()[0] == 1


def test_parser_fault_quarantines_without_advancing_content(tmp_path, monkeypatch):
    freeze, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    intake = intake_frozen(state, freeze, "one", source_host=HOST)

    def broken(_lines):
        raise ValueError("bad typed source")

    monkeypatch.setattr("trial_project._parse_claude_lines", broken)
    disposition = project_observation(state, intake["observation_id"])
    assert disposition["status"] == "quarantined"
    assert disposition == project_observation(state, intake["observation_id"])
    assert intake_status(state)["content_frontiers"] == {}


def test_retry_detects_corrupted_typed_ground(tmp_path):
    freeze, _ = frozen(tmp_path, "A", "alpha")
    state = tmp_path / "state"
    intake = intake_frozen(state, freeze, "one", source_host=HOST)
    project_observation(state, intake["observation_id"])
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        conn.execute("UPDATE typed_content SET text='changed'")
    with pytest.raises(ValueError, match="stored typed content"):
        project_observation(state, intake["observation_id"])
