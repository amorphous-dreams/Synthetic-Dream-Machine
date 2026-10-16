"""Closed corpus induction keeps occurrence joins and an immutable ordered basis."""

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from test_trial_intake import HOST, frozen
from test_trial_owned_content import _duplicate_source
from trial_intake import DB_NAME, intake_frozen
from trial_owned_li import project_owned_li
from trial_project import project_observation


def test_li_basis_replay_and_drift(tmp_path):
    state = tmp_path / "state"
    ids = []
    sources = (_duplicate_source(tmp_path, "li-duplicate"),
               frozen(tmp_path, "li-book", "A different shore held the book."))
    for n, (receipt, _) in enumerate(sources):
        observed = intake_frozen(state, receipt, f"li-intent-{n}", source_host=HOST)
        project_observation(state, observed["observation_id"])
        ids.append(observed["observation_id"])
    first = project_owned_li(state, ids)
    assert first["occurrences"] == 3
    assert first["parser_tiers"]
    if first["warrant"] == "degraded-parser":
        with pytest.raises(ValueError, match="constituency model required"):
            project_owned_li(state, ids, require_constituency=True)
    assert project_owned_li(state, ids) == first
    assert project_owned_li(state, ids[:1])["basis_sha256"] != first["basis_sha256"]
    with sqlite3.connect(state / DB_NAME) as conn:
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 2
        rows = conn.execute("SELECT occurrence_id,shape_sha256,tree_json FROM li_shape "
                            "WHERE basis_sha256=?", (first["basis_sha256"],)).fetchall()
        assert len({row[0] for row in rows}) == 3
        # Equal text may share Shape; each native occurrence still keeps its join.
        assert rows[0][1] == rows[1][1]
        assert len({row[0] for row in conn.execute("SELECT occurrence_id FROM li_idiom "
                                                 "WHERE basis_sha256=?", (first["basis_sha256"],))}) == 3
        conn.execute("UPDATE li_idiom SET membership_json='[999]' WHERE basis_sha256=? "
                     "AND occurrence_id=?", (first["basis_sha256"], rows[0][0]))
    with pytest.raises(ValueError, match="stored Idiom disagrees"):
        project_owned_li(state, ids)


def test_li_precommit_crash_keeps_no_partial_basis(tmp_path):
    state = tmp_path / "state"
    receipt, _ = frozen(tmp_path, "li-crash", "The whale crossed the sea.")
    observed = intake_frozen(state, receipt, "li-crash", source_host=HOST)
    project_observation(state, observed["observation_id"])

    def cut(stage):
        if stage == "before_commit":
            raise RuntimeError("cut")

    with pytest.raises(RuntimeError, match="cut"):
        project_owned_li(state, [observed["observation_id"]], cut_hook=cut)
    with sqlite3.connect(state / DB_NAME) as conn:
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 0
    assert project_owned_li(state, [observed["observation_id"]])["occurrences"] == 1


def test_li_shape_checkpoint_resumes_without_landing_a_partial_basis(tmp_path):
    state = tmp_path / "state"
    receipt, _ = _duplicate_source(tmp_path, "li-resume")
    observed = intake_frozen(state, receipt, "li-resume", source_host=HOST)
    project_observation(state, observed["observation_id"])
    seen = 0

    def cut(stage):
        nonlocal seen
        if stage == "after_shape":
            seen += 1
            if seen == 1:
                raise RuntimeError("shape cut")

    with pytest.raises(RuntimeError, match="shape cut"):
        project_owned_li(state, [observed["observation_id"]], cut_hook=cut)
    with sqlite3.connect(state / DB_NAME) as conn:
        assert conn.execute("SELECT count(*) FROM li_parse").fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 0
    assert project_owned_li(state, [observed["observation_id"]])["occurrences"] == 2
    with sqlite3.connect(state / DB_NAME) as conn:
        assert conn.execute("SELECT count(*) FROM li_parse").fetchone()[0] == 2


def test_li_shape_checkpoint_survives_process_death_and_replays_one_basis(tmp_path):
    state = tmp_path / "state"
    receipt, _ = _duplicate_source(tmp_path, "li-process-restart")
    observed = intake_frozen(state, receipt, "li-process-restart", source_host=HOST)
    project_observation(state, observed["observation_id"])
    observation = observed["observation_id"]

    env = dict(os.environ, PYTHONPATH=str(Path(__file__).parent))
    die_after_shape = (
        "import os,sys; from trial_owned_li import project_owned_li; "
        "project_owned_li(sys.argv[1],[int(sys.argv[2])],"
        "cut_hook=lambda stage: os._exit(37) if stage=='after_shape' else None)"
    )
    dead = subprocess.run(
        [sys.executable, "-c", die_after_shape, str(state), str(observation)],
        env=env, capture_output=True, text=True, timeout=120,
    )
    assert dead.returncode == 37, dead.stderr
    with sqlite3.connect(state / DB_NAME) as conn:
        checkpoint = conn.execute(
            "SELECT occurrence_id,parser_identity_sha256,shape_sha256 FROM li_parse"
        ).fetchall()
        assert len(checkpoint) == 1
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 0

    command = [sys.executable, str(Path(__file__).with_name("trial_owned_li.py")),
               "--state-root", str(state), "--observation", str(observation)]
    finished = subprocess.run(command, env=env, capture_output=True, text=True, timeout=120)
    assert finished.returncode == 0, finished.stderr
    landed = json.loads(finished.stdout)
    assert landed["status"] == "landed"
    assert landed["occurrences"] == 2
    assert landed["parser_tiers"]
    assert landed["warrant"] in {"full-constituency", "degraded-parser"}

    replay = subprocess.run(command, env=env, capture_output=True, text=True, timeout=120)
    assert replay.returncode == 0, replay.stderr
    assert json.loads(replay.stdout) == landed
    with sqlite3.connect(state / DB_NAME) as conn:
        assert conn.execute(
            "SELECT occurrence_id,parser_identity_sha256,shape_sha256 FROM li_parse "
            "WHERE occurrence_id=?", (checkpoint[0][0],)
        ).fetchone() == checkpoint[0]
        assert conn.execute("SELECT count(*) FROM li_parse").fetchone()[0] == 2
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 1
        for table in ("li_shape", "li_idiom"):
            rows = conn.execute(
                f"SELECT occurrence_id FROM {table} WHERE basis_sha256=?",
                (landed["basis_sha256"],),
            ).fetchall()
            assert len({row[0] for row in rows}) == 2
