"""test_ephemeral — the EPHEMERAL skip gate, pinned against `ephemeral.ts`'s three grains."""
import json
import os

import ephemeral
from ephemeral import session_ephemeral


def _write(path, cwd=None):
    row = {"type": "user"}
    if cwd is not None:
        row["cwd"] = cwd
    path.write_text(json.dumps(row) + "\n", encoding="utf-8")


def test_live_when_cwd_is_a_real_project(tmp_path, monkeypatch):
    monkeypatch.delenv("LAR_ROOT", raising=False)
    t = tmp_path / "s.jsonl"
    _write(t, cwd="/home/joshu/Real-Project")
    assert session_ephemeral(str(t)) is None


def test_declared_sibling_marker_skips(tmp_path):
    t = tmp_path / "s.jsonl"
    _write(t, cwd="/home/joshu/Real-Project")
    (tmp_path / "s.ephemeral").write_text("", encoding="utf-8")
    reason = session_ephemeral(str(t))
    assert reason and "declared" in reason


def _outside_scratch(name):
    """A fixture dir outside every scratch root: tmp reads scratch, so it homes in the package's ignored cache."""
    import tempfile
    cache = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "node_modules", ".cache")
    os.makedirs(cache, exist_ok=True)
    return tempfile.mkdtemp(prefix=f"eph-{name}-", dir=cache)


def test_cwd_under_a_tmp_scratch_root_skips(tmp_path, monkeypatch):
    # A recorded cwd under the OS tmpdir reads ephemeral (grain a — derived).
    monkeypatch.delenv("LAR_ROOT", raising=False)
    t = tmp_path / "s.jsonl"
    _write(t, cwd=str(tmp_path / "wrk"))
    reason = session_ephemeral(str(t))
    assert reason and "derived" in reason


def test_cwd_under_a_marked_scratch_root_skips(tmp_path, monkeypatch):
    import shutil
    root = _outside_scratch("marked")
    try:
        with open(os.path.join(root, ".lar-test-scratch"), "w", encoding="utf-8") as fh:
            fh.write("staged by a test harness\n")
        os.makedirs(os.path.join(root, "hearth", "work"))
        t = tmp_path / "s.jsonl"
        _write(t, cwd=os.path.join(root, "hearth", "work"))
        reason = session_ephemeral(str(t))
        assert reason and "marked scratch root" in reason
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_cwd_under_an_unmarked_house_root_reads_live_even_when_lar_root_names_it(tmp_path, monkeypatch):
    import shutil
    house = _outside_scratch("house")
    try:
        os.makedirs(os.path.join(house, "projections", "wikis"))
        monkeypatch.setenv("LAR_ROOT", house)
        t = tmp_path / "s.jsonl"
        _write(t, cwd=os.path.join(house, "projections", "wikis"))
        assert session_ephemeral(str(t)) is None
        assert os.path.abspath(house) not in ephemeral.scratch_roots()
    finally:
        shutil.rmtree(house, ignore_errors=True)


def test_lar_ephemeral_marker_in_cwd_skips(tmp_path, monkeypatch):
    monkeypatch.delenv("LAR_ROOT", raising=False)
    proj = tmp_path / "proj"
    proj.mkdir()
    (proj / ".lar-ephemeral").write_text("", encoding="utf-8")
    t = tmp_path / "s.jsonl"
    _write(t, cwd=str(proj))
    reason = session_ephemeral(str(t))
    assert reason and ".lar-ephemeral" in reason


def test_non_jsonl_target_reads_live(tmp_path):
    # A copilot sqlite store carries no per-session cwd — it reads live.
    db = tmp_path / "state.vscdb"
    db.write_text("", encoding="utf-8")
    assert session_ephemeral(str(db)) is None
