"""A real pinned MiniLM crosses typed custody into an owned, restartable Content view."""

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
import onnxruntime

from content_io import ContentStore
from sensorium import sensorium_paths
from test_trial_intake import HOST, frozen
from trial_intake import intake_frozen, intake_status
from trial_owned_content import current_revision
from trial_project import project_observation


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
    home = tmp_path_factory.mktemp("owned-model-home")
    target = home / ".cache/chroma/onnx_models/all-MiniLM-L6-v2"
    for rel in _ASSETS:
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / rel, dest)
    return home


def _env(model_home):
    return dict(os.environ, HOME=str(model_home), ANONYMIZED_TELEMETRY="False",
                PYTHONPATH=str(_REPO / "mempalace"))


def _run(state, owned, observation, model_home, *, cut=None):
    if cut:
        script = (f"import os,sys; sys.path.insert(0,{str(_HERE)!r}); "
                  "from trial_owned_content import project_owned_content; "
                  "project_owned_content(sys.argv[1],sys.argv[2],int(sys.argv[3]),"
                  "cut_hook=lambda stage: os._exit(37) if stage==sys.argv[4] else None)")
        cmd = [sys.executable, "-c", script, str(state), str(owned), str(observation), cut]
    else:
        cmd = [sys.executable, str(_HERE / "trial_owned_content.py"),
               "--state-root", str(state), "--sensorium-root", str(owned),
               "--observation", str(observation)]
    return subprocess.run(cmd, env=_env(model_home), text=True, capture_output=True,
                          timeout=180, cwd=_REPO)


def _duplicate_source(tmp_path, name):
    receipt, _ = frozen(tmp_path, name, "the whale breached at dawn")
    freeze = json.loads(receipt.read_text())
    evidence = Path(freeze["evidence"])
    row = json.loads(evidence.read_text().strip())
    row2 = {**row, "uuid": "turn-2"}
    raw = (json.dumps(row) + "\n" + json.dumps(row2) + "\n").encode()
    evidence.write_bytes(raw)
    freeze.update({"evidence_bytes": len(raw), "evidence_sha256": hashlib.sha256(raw).hexdigest(),
                   "native_size": len(raw), "rows_by_type": {"user": 2}})
    receipt.write_text(json.dumps(freeze))
    return receipt, raw


def test_real_model_duplicates_revisions_crash_and_cold_recall(tmp_path, model_home):
    a, a_bytes = _duplicate_source(tmp_path, "A")
    b, _ = frozen(tmp_path, "B", "the book carried another ending")
    again, _ = _duplicate_source(tmp_path, "A-again")
    state, owned = tmp_path / "state", tmp_path / "owned"
    one = intake_frozen(state, a, "one", source_host=HOST)
    two = intake_frozen(state, b, "two", source_host=HOST)
    three = intake_frozen(state, again, "three", source_host=HOST)
    for item in (one, two, three):
        project_observation(state, item["observation_id"])

    # A later observation may land first, but its semantic frontier cannot jump a gap.
    second = _run(state, owned, two["observation_id"], model_home)
    assert second.returncode == 0, second.stderr
    assert json.loads(second.stdout)["semantic_frontier"] == 0

    # Chroma accepts A's rows before SQLite receipts them. The next process must
    # verify and reuse both occurrence IDs, then close the contiguous frontier.
    dead = _run(state, owned, one["observation_id"], model_home, cut="after_rows")
    assert dead.returncode == 37, dead.stderr
    first = _run(state, owned, one["observation_id"], model_home)
    assert first.returncode == 0, first.stderr
    first_receipt = json.loads(first.stdout)
    assert first_receipt["semantic_frontier"] == 2
    assert first_receipt["model"] == "minilm" and first_receipt["dimension"] == 384
    assert first_receipt["device"] == "cpu"
    assert first_receipt["providers"] == ["CPUExecutionProvider"]
    assert first_receipt["blocks"] == 2 and first_receipt["model_basis_sha256"]

    third = _run(state, owned, three["observation_id"], model_home)
    assert third.returncode == 0, third.stderr
    assert json.loads(third.stdout)["semantic_frontier"] == 3
    status = intake_status(state)
    assert status["content_frontiers"] == {one["source_key"]: 3}
    assert status["semantic_frontiers"][first_receipt["view_key"]] == {one["source_key"]: 3}
    repeated = _run(state, owned, one["observation_id"], model_home)
    assert repeated.returncode == 0, repeated.stderr
    assert json.loads(repeated.stdout) == first_receipt
    assert current_revision(state, one["source_key"]) == hashlib.sha256(a_bytes).hexdigest()

    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM semantic_projection WHERE status='landed'").fetchone()[0] == 3
        assert conn.execute("SELECT frontier FROM semantic_frontier").fetchone()[0] == 3
        cids = [r[0] for r in conn.execute("SELECT cid FROM typed_content ORDER BY revision_sha256,block_index")]
        assert len(cids) == len(set(cids)) == 3

    store = ContentStore(sensorium_paths(str(owned)).content,
                         expected_dim=384, expected_model="minilm", append_only=True)
    assert store._col.count() == 3
    a_rows = store._col.get(where={"lar_revision_sha256": one["revision_sha256"]},
                            include=["documents", "metadatas", "embeddings"])
    assert len(a_rows["ids"]) == 2
    assert len(set(a_rows["ids"])) == 2
    assert {m["lar_text_sha256"] for m in a_rows["metadatas"]} == {
        hashlib.sha256(b"the whale breached at dawn").hexdigest()}
    assert {m["lar_source_row"] for m in a_rows["metadatas"]} == {0, 1}
    assert all(m["lar_source_byte_length"] > 0 for m in a_rows["metadatas"])
    assert all(len(vector) == 384 for vector in a_rows["embeddings"])
    assert "lar_verbatim_sha" not in a_rows["metadatas"][0]
    hit = store.search([float(x) for x in a_rows["embeddings"][0]], k=3,
                       where={"lar_revision_sha256": current_revision(state, one["source_key"])})
    assert len(hit["matches"]) == 2
    assert {m["cid"] for m in hit["matches"]} == set(a_rows["ids"])


def test_explicit_cuda_refuses_absent_provider(tmp_path, model_home):
    if "CUDAExecutionProvider" in onnxruntime.get_available_providers():
        pytest.skip("CUDA provider stands; this witness targets the CPU-only CI seat")
    receipt, _ = frozen(tmp_path, "cuda-refusal", "CUDA must never claim a CPU reading")
    state = tmp_path / "state"
    observed = intake_frozen(state, receipt, "cuda-refusal", source_host=HOST)
    project_observation(state, observed["observation_id"])
    command = [sys.executable, str(_HERE / "trial_owned_content.py"),
               "--state-root", str(state), "--sensorium-root", str(tmp_path / "owned"),
               "--observation", str(observed["observation_id"]), "--device", "cuda"]
    result = subprocess.run(command, env=_env(model_home), text=True, capture_output=True,
                            timeout=60, cwd=_REPO)
    assert result.returncode == 2
    assert "CUDA requested but ONNX Runtime has no CUDA provider" in result.stderr
    with sqlite3.connect(state / "trial-intake-v2.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM semantic_projection").fetchone()[0] == 0
