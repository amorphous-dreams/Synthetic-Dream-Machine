"""Closed corpus induction keeps occurrence joins and an immutable ordered basis."""

import sqlite3

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
