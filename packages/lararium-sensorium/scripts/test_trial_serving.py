"""The serving operation composes stage receipts and resumes by stable intent."""

import json
import os
import sqlite3
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

import trial_intake
import trial_owned_content
import trial_project
import trial_serving
from trial_serving import run_operation, status_operation


_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parents[2]
_ASSETS = ("onnx.tar.gz", "onnx/model.onnx", "onnx/config.json",
           "onnx/special_tokens_map.json", "onnx/tokenizer.json",
           "onnx/tokenizer_config.json", "onnx/vocab.txt")


@pytest.fixture(scope="module")
def model_home(tmp_path_factory):
    source = Path(os.environ.get("XDG_CACHE_HOME", str(Path.home() / ".cache"))) / (
        "chroma/onnx_models/all-MiniLM-L6-v2")
    if not all((source / rel).is_file() for rel in _ASSETS):
        pytest.skip("the pinned real MiniLM asset must be provisioned for this integration witness")
    home = tmp_path_factory.mktemp("serving-model-home")
    for rel in _ASSETS:
        dest = home / ".cache/chroma/onnx_models/all-MiniLM-L6-v2" / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / rel, dest)
    return home


def test_run_resumes_receipts_and_status_needs_no_model(tmp_path, monkeypatch):
    model_home = tmp_path / "state"
    root = model_home / "sensorium-serving-smoke"
    model_home.mkdir()
    stale_marker = model_home / ".sensorium-serving-smoke.operation.json.43210.deadbeef.tmp"
    stale_marker.write_text('{"schema":')
    from test_trial_intake import frozen
    freeze, _ = frozen(tmp_path, "source", "frozen test evidence")
    calls = {"intake": 0, "typed": 0, "semantic": 0}

    def intake(state, _receipt, _intent, *, source_host):
        calls["intake"] += 1
        assert state == root / "state" and source_host == "test-host"
        return {"observation_id": 1, "revision_sha256": "abc"}

    def typed(state, observation):
        calls["typed"] += 1
        assert state == root / "state" and observation == 1
        return {"observation_id": 1, "revision_sha256": "abc", "content_frontier": 1}

    def semantic(state, sensorium, observation, *, model_state_root, device):
        calls["semantic"] += 1
        assert state == root / "state" and sensorium == root / "sensorium"
        assert observation == 1 and model_state_root == Path.home() and device == "auto"
        return {"observation_id": 1, "revision_sha256": "abc", "semantic_frontier": 1}

    monkeypatch.setattr(trial_intake, "intake_frozen", intake)
    monkeypatch.setattr(trial_project, "project_observation", typed)
    monkeypatch.setattr(trial_owned_content, "project_owned_content", semantic)
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: model_home))
    result = run_operation(root, freeze, "intent-1", "test-host", model_home)
    assert stale_marker.exists()  # a parent-side crash orphan never blocks or gets erased
    assert result["operation_status"] == "complete"
    assert result["observation_id"] == 1 and result["revision_sha256"] == "abc"
    assert result["content_frontier"] == 1 and result["semantic_frontier"] == 1
    assert result["content_root"] == str(root / "sensorium" / "content")

    # Re-entering the named operation repeats only idempotent boundaries.
    run_operation(root, freeze, "intent-1", "test-host", model_home)
    assert calls == {"intake": 2, "typed": 2, "semantic": 2}
    status = status_operation(root)
    assert status["operation_status"] == "complete"
    assert status["receipts"]["semantic"]["semantic_frontier"] == 1
    assert "worldline" in status["unsupported_views"]


def test_named_root_refuses_different_inputs_or_unmarked_data(tmp_path):
    root = tmp_path / "sensorium-serving-owned"
    root.mkdir()
    (root / "foreign.txt").write_text("owned by someone else")
    freeze = tmp_path / "freeze.json"
    freeze.write_text("{}")
    with pytest.raises(ValueError, match="non-empty directory"):
        run_operation(root, freeze, "intent", "host", Path.home())
    assert (root / "foreign.txt").read_text() == "owned by someone else"


def test_atomic_json_removes_temp_after_ordinary_failure(tmp_path, monkeypatch):
    def fail_replace(_source, _destination):
        raise OSError("simulated replace failure")

    monkeypatch.setattr(trial_serving.os, "replace", fail_replace)
    with pytest.raises(OSError, match="simulated replace failure"):
        trial_serving._atomic_json(tmp_path / "operation.json", {"status": "ready"})
    assert not (tmp_path / "operation.json").exists()
    assert list(tmp_path.iterdir()) == []


def test_operation_lock_refuses_overlapping_same_root_writer(tmp_path):
    root = tmp_path / "sensorium-serving-concurrent"
    root.mkdir()
    first = trial_serving._acquire_operation_lock(root)
    try:
        with pytest.raises(ValueError, match="already running"):
            trial_serving._acquire_operation_lock(root)
    finally:
        trial_serving._release_operation_lock(first)
    second = trial_serving._acquire_operation_lock(root)
    trial_serving._release_operation_lock(second)


def test_operation_lock_refuses_symlink_target(tmp_path):
    root = tmp_path / "sensorium-serving-lock-symlink"
    root.mkdir()
    target = tmp_path / "unrelated.lock"
    target.write_text("leave untouched")
    (tmp_path / ".sensorium-serving-lock-symlink.operation.lock").symlink_to(target)
    with pytest.raises(ValueError, match="regular non-symlink"):
        trial_serving._acquire_operation_lock(root)
    assert target.read_text() == "leave untouched"


def test_status_refuses_unmarked_operation_root(tmp_path):
    root = tmp_path / "sensorium-serving-absent"
    with pytest.raises(ValueError, match="no operation marker"):
        status_operation(root)


def test_real_minilm_serving_operation_and_status_cli(tmp_path, model_home):
    from test_trial_intake import frozen

    receipt, _ = frozen(tmp_path, "source", "the whale surfaced at dawn")
    root = tmp_path / "sensorium-serving-real-model"
    env = dict(os.environ, HOME=str(model_home), ANONYMIZED_TELEMETRY="False",
               PYTHONPATH=f"{_HERE}:{_REPO / 'mempalace'}")
    command = [sys.executable, str(_HERE / "trial_serving.py"), "run",
               "--operation-root", str(root), "--state-root", str(root / "state"),
               "--sensorium-root", str(root / "sensorium"), "--freeze-receipt", str(receipt),
               "--intent", "serving-intent", "--source-host", "test-host",
               "--model-home", str(model_home), "--device", "cpu"]
    first = subprocess.run(command, env=env, cwd=_REPO, text=True, capture_output=True,
                           timeout=180)
    assert first.returncode == 0, first.stderr
    output = json.loads(first.stdout)
    assert output["operation_status"] == "complete"
    assert output["observation_id"] == 1 and output["revision_sha256"]
    assert output["content_frontier"] == output["semantic_frontier"] == 1
    assert output["receipts"]["semantic"]["model"] == "minilm"
    repeated = subprocess.run(command, env=env, cwd=_REPO, text=True, capture_output=True,
                              timeout=180)
    assert repeated.returncode == 0, repeated.stderr
    assert json.loads(repeated.stdout) == output
    status = subprocess.run([sys.executable, str(_HERE / "trial_serving.py"), "status",
                             "--operation-root", str(root)], env=env, cwd=_REPO, text=True,
                            capture_output=True, timeout=30)
    assert status.returncode == 0, status.stderr
    reported = json.loads(status.stdout)
    assert reported["operation_status"] == "complete"
    assert reported["semantic_frontiers"]
    assert reported["pending_typed_intents"] == []
    assert reported["pending_semantic_intents"] == []
    allowed = subprocess.run([sys.executable, str(_HERE / "trial_serving.py"), "allowed-cids",
                              "--operation-root", str(root)], env=env, cwd=_REPO, text=True,
                             capture_output=True, timeout=30)
    assert allowed.returncode == 0, allowed.stderr
    membership = json.loads(allowed.stdout)
    assert set(membership) == {"observation_id", "source_key", "revision_sha256", "view_key",
                               "model_basis_sha256", "content_frontier", "semantic_frontier", "cids"}
    assert membership["observation_id"] == reported["observation_id"]
    assert membership["view_key"] == reported["view_key"]
    assert membership["content_frontier"] == membership["semantic_frontier"] == 1
    with sqlite3.connect(root / "state" / "trial-intake-v2.sqlite3") as conn:
        expected = [row[0] for row in conn.execute(
            "SELECT cid FROM projection_block WHERE observation_id=? ORDER BY block_index",
            (membership["observation_id"],))]
    assert membership["cids"] == expected
