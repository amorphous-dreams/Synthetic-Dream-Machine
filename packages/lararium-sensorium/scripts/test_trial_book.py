"""Book custody and typed projection preserve the edition witness and original byte spans."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

import trial_book as book
from trial_book import freeze_book, intake_book, project_book, read_book_occurrences


def _ni(raw: bytes) -> str:
    return "ni:///sha-256;" + base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).decode().rstrip("=")


def _book(tmp_path: Path, *, body: bytes | None = None, label: str = "edition-1897"):
    tmp_path.mkdir(parents=True, exist_ok=True)
    native_root = tmp_path / "native"
    native_root.mkdir(exist_ok=True)
    source = native_root / "source.mem"
    raw = body if body is not None else (
        "<<!DOCTYPE memetic-wikitext+tiddlywiki lar:///ha.ka.ba/lares/library/example>>\n"
        "```toml iam\nrole = \"source witness\"\n```\n"
        "\n<<~ ahu #provenance>>\nRights status stated in this witness.\n<<~/ahu>>\n"
        "\n<<~ ahu #source-text>>\n"
        "# First era\nʻŌlelo Hawaiʻi, one line.\nRepeated refrain.\n"
        + "x" * 4080 + "\nRepeated refrain.\n"
        "## Second era\nKeaulumoku's chant.\n<<~/ahu>>\n"
    ).encode("utf-8")
    source.write_bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()
    descriptor = {
        "schema": "lararium.sensorium.book-source.v1",
        "source_key": "book:test:edition-1897/witness-1",
        "collection": "library:test",
        "work": "Test Kumulipo",
        "producer": {
            "attributed_chant": "Keaulumoku",
            "translator": "Liliʻuokalani",
            "digital_redactor": "test fixture",
        },
        "edition": {
            "title": label,
            "publisher": "Test Publisher",
            "place": "Honolulu",
            "year": 1897,
        },
        "witness": {
            "locator": "library:test/example.mem",
            "kind": "combined-digital-edition",
            "digital_source": "local test bytes",
            "retrieved": "2026-10-16",
            "expected_bytes": len(raw),
            "sha256": digest,
            "ni": _ni(raw),
        },
        "rights": {"status": "declared-public-domain-us", "evidence": "fixture declaration"},
    }
    descriptor_path = tmp_path / "descriptor.json"
    descriptor_path.write_text(json.dumps(descriptor), encoding="utf-8")
    catalog = tmp_path / "catalog.mem"
    catalog.write_text(
        f"| example.mem | {len(raw)} | `{_ni(raw)}` | synthetic fixture |\n",
        encoding="utf-8",
    )
    book._CATALOG_PATHS["library:test"] = catalog
    trial_root = tmp_path / "frozen"
    freeze = freeze_book(source, descriptor_path, trial_root)
    return source, raw, descriptor_path, descriptor, freeze, trial_root


def test_freeze_intake_and_project_preserve_exact_utf8_byte_spans(tmp_path):
    source, raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path)
    state = tmp_path / "state"
    intake = intake_book(state, Path(frozen["freeze_receipt"]), "book-observation-1")
    landed = project_book(state, intake["observation_id"])
    assert landed["status"] == "landed"
    assert landed["covered_bytes"] == len(raw)
    assert landed["region_blocks"]["book-text"] > 0
    assert landed["region_blocks"]["carrier-envelope"] > 0

    occurrences = read_book_occurrences(state, intake["observation_id"])
    assert occurrences
    spans = []
    for occurrence in occurrences:
        metadata = occurrence["metadata"]
        start = metadata["lar_source_byte_start"]
        length = metadata["lar_source_byte_length"]
        span = raw[start:start + length]
        assert len(span) == length
        assert hashlib.sha256(span).hexdigest() == metadata["lar_source_span_sha256"]
        spans.append((start, start + length))
        assert occurrence["source_key"] == intake["source_key"]
        assert occurrence["revision_sha256"] == intake["revision_sha256"]
    spans.sort()
    assert spans[0][0] == 0 and spans[-1][1] == len(raw)
    assert all(left[1] == right[0] for left, right in zip(spans, spans[1:]))

    decoded = [(o["metadata"]["lar_book_region"], o["text"]) for o in occurrences]
    body_texts = [text for region, text in decoded if region == "book-text"]
    assert any("ʻŌlelo Hawaiʻi, one line." in text for text in body_texts)
    duplicate_rows = [o for o in occurrences
                      if o["metadata"]["lar_book_region"] == "book-text"
                      and "Repeated refrain." in o["text"]]
    assert len(duplicate_rows) >= 2
    assert duplicate_rows[0]["cid"] != duplicate_rows[-1]["cid"]
    assert duplicate_rows[0]["metadata"]["lar_source_byte_start"] != duplicate_rows[-1]["metadata"]["lar_source_byte_start"]

    assert landed == project_book(state, intake["observation_id"])
    assert occurrences == read_book_occurrences(state, intake["observation_id"])


def test_changed_descriptor_under_same_intent_conflicts_but_path_rename_does_not(tmp_path):
    source, raw, descriptor_path, descriptor, frozen, trial_root = _book(tmp_path)
    state = tmp_path / "state"
    first = intake_book(state, Path(frozen["freeze_receipt"]), "same-intent")
    assert first["source_key"].startswith("book:")
    assert "session_id" not in first and "native_session_id" not in first and "window" not in first

    changed = dict(descriptor)
    changed["edition"] = {**descriptor["edition"], "publisher": "Different Publisher"}
    changed_path = tmp_path / "changed-descriptor.json"
    changed_path.write_text(json.dumps(changed), encoding="utf-8")
    changed_freeze = freeze_book(source, changed_path, tmp_path / "frozen-changed")
    with pytest.raises(ValueError, match="intent|different|conflict"):
        intake_book(state, Path(changed_freeze["freeze_receipt"]), "same-intent")
    with pytest.raises(ValueError, match="different edition|different book|source key"):
        intake_book(state, Path(changed_freeze["freeze_receipt"]), "new-edition-intent")

    moved_root = tmp_path / "moved-native"
    moved_root.mkdir()
    moved = moved_root / "renamed-source.mem"
    moved.write_bytes(raw)
    moved_descriptor = tmp_path / "moved-descriptor.json"
    moved_descriptor.write_text(descriptor_path.read_text(encoding="utf-8"), encoding="utf-8")
    moved_freeze = freeze_book(moved, moved_descriptor, tmp_path / "frozen-moved")
    replay = intake_book(state, Path(moved_freeze["freeze_receipt"]), "same-intent")
    assert replay == first


def test_source_hash_anchor_and_frozen_blob_tampering_refuse(tmp_path):
    source, _raw, descriptor_path, descriptor, frozen, _trial_root = _book(tmp_path)
    changed = source.read_bytes().replace(b"First era", b"Other era")
    source.write_bytes(changed)
    with pytest.raises(ValueError, match="hash|bytes|anchor|length"):
        freeze_book(source, descriptor_path, tmp_path / "bad-freeze")

    # The first successful freeze already owns a private copy; mutate that archived BLOB.
    frozen_dir = Path(frozen["freeze_receipt"]).parent
    receipt = json.loads(Path(frozen["freeze_receipt"]).read_text(encoding="utf-8"))
    evidence_path = frozen_dir / receipt["evidence"]
    evidence_path.write_bytes(b"altered")
    with pytest.raises(ValueError, match="hash|bytes|evidence"):
        intake_book(tmp_path / "state", Path(frozen["freeze_receipt"]), "tampered")


@pytest.mark.parametrize("body,reason", [
    (b"prefix\n<<~ ahu #source-text>>\n\xff\xfe\n<<~/ahu>>\n", "UTF-8"),
    (b"prefix\n<<~ ahu #source-text>>\n" + b"x" * 4097 + b"\n<<~/ahu>>\n", "4096"),
    (b"prefix\nNo source text marker here.\n", "source-text"),
])
def test_invalid_or_unbounded_physical_lines_quarantine_without_partial_rows(tmp_path, body, reason):
    _source, _raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path, body=body)
    state = tmp_path / "state"
    intake = intake_book(state, Path(frozen["freeze_receipt"]), "bad-book")
    receipt = project_book(state, intake["observation_id"])
    assert receipt["status"] == "quarantined"
    assert reason.lower() in receipt["reason"].lower()
    assert receipt["typed_blocks"] == 0
    assert project_book(state, intake["observation_id"]) == receipt
    with pytest.raises(ValueError, match="landed|quarantined|no typed"):
        read_book_occurrences(state, intake["observation_id"])
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM typed_content").fetchone()[0] == 0


def test_a_b_a_observations_retain_two_immutable_revisions(tmp_path):
    state = tmp_path / "state"
    observations = []
    for index, marker in enumerate((b"A", b"B", b"A"), 1):
        raw = (b"<<~ ahu #source-text>>\n" + marker + b"\n<<~/ahu>>\n")
        _source, _raw, _descriptor_path, _descriptor, frozen, _root = _book(
            tmp_path / f"rev-{index}", body=raw)
        intake = intake_book(state, Path(frozen["freeze_receipt"]), f"intent-{index}")
        projection = project_book(state, intake["observation_id"])
        assert projection["status"] == "landed"
        observations.append((intake, read_book_occurrences(state, intake["observation_id"])))
    assert observations[0][0]["source_key"] == observations[1][0]["source_key"] == observations[2][0]["source_key"]
    assert observations[0][0]["revision_sha256"] != observations[1][0]["revision_sha256"]
    assert observations[0][0]["revision_sha256"] == observations[2][0]["revision_sha256"]
    assert observations[0][1][0]["cid"] == observations[2][1][0]["cid"]
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM revision").fetchone()[0] == 2
        assert conn.execute("SELECT count(*) FROM observation").fetchone()[0] == 3


@pytest.mark.parametrize("stage,landed", [
    ("after_blocks", False), ("before_commit", False), ("after_commit", True),
])
def test_projection_crash_recovery_is_atomic_and_replayable(tmp_path, stage, landed):
    _source, _raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path)
    state = tmp_path / "state"
    intake = intake_book(state, Path(frozen["freeze_receipt"]), "crash-intent")
    script = (
        "import os,sys; from trial_book import project_book; "
        "project_book(sys.argv[1],int(sys.argv[2]),cut_hook="
        "lambda stage: os._exit(37) if stage==sys.argv[3] else None)"
    )
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).parent))
    proc = subprocess.run([sys.executable, "-c", script, str(state),
                           str(intake["observation_id"]), stage], env=env)
    assert proc.returncode == 37
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        typed_count = conn.execute("SELECT count(*) FROM typed_content").fetchone()[0]
        assert (typed_count > 0) is landed
    replay = project_book(state, intake["observation_id"])
    assert replay["status"] == "landed"
    assert replay == project_book(state, intake["observation_id"])
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM projection_receipt").fetchone()[0] == 1


@pytest.mark.parametrize("stage,committed", [
    ("after_evidence", False), ("after_manifest", False),
    ("before_commit", False), ("after_commit", True),
])
def test_intake_crash_recovery_is_one_exact_observation(tmp_path, stage, committed):
    _source, _raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path)
    state = tmp_path / "state"
    script = (
        "import os,sys; from pathlib import Path; import trial_book; "
        "trial_book._CATALOG_PATHS['library:test']=Path(sys.argv[4]); "
        "trial_book.intake_book(sys.argv[1],sys.argv[2],'crash-intent',cut_hook="
        "lambda stage: os._exit(37) if stage==sys.argv[3] else None)"
    )
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).parent))
    proc = subprocess.run([sys.executable, "-c", script, str(state),
                           frozen["freeze_receipt"], stage, str(tmp_path / "catalog.mem")], env=env)
    assert proc.returncode == 37
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM observation").fetchone()[0] == int(committed)
    recovered = intake_book(state, Path(frozen["freeze_receipt"]), "crash-intent")
    assert recovered["frontier"] == 1
    assert intake_book(state, Path(frozen["freeze_receipt"]), "crash-intent") == recovered
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM observation").fetchone()[0] == 1


def test_self_consistent_forgery_disagrees_with_tracked_catalog_anchor(tmp_path, monkeypatch):
    catalog = Path(__file__).resolve().parents[3] / "bags/lares/ha.ka.ba/lares/library/kumulipo.mem"
    monkeypatch.setitem(book._CATALOG_PATHS, "library:kumulipo", catalog)
    raw = b"forged bytes that carry a self-consistent hash and NI anchor"
    source_root = tmp_path / "native"
    source_root.mkdir()
    source = source_root / "forged.mem"
    source.write_bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()
    descriptor = {
        "schema": "lararium.sensorium.book-source.v1",
        "source_key": "book:library:kumulipo/liliuokalani-1897/sacred-texts-2005-combined",
        "collection": "library:kumulipo",
        "work": "Kumulipo",
        "producer": {"attributed_chant": "Keaulumoku", "translator": "Liliʻuokalani", "digital_redactor": "test forgery"},
        "edition": {"title": "claimed edition", "publisher": "claimed publisher", "place": "Boston", "year": "1897"},
        "witness": {
            "locator": "library:kumulipo/kumulipo-liliuokalani.mem",
            "kind": "forged witness", "digital_source": "forged", "retrieved": "2026-10-16",
            "expected_bytes": len(raw), "sha256": digest, "ni": _ni(raw),
        },
        "rights": {"status": "unknown", "evidence": "none"},
    }
    descriptor_path = tmp_path / "forged.json"
    descriptor_path.write_text(json.dumps(descriptor), encoding="utf-8")
    with pytest.raises(ValueError, match="catalog|anchor|witness|bytes"):
        freeze_book(source, descriptor_path, tmp_path / "forged-freeze")
    assert not (tmp_path / "forged-freeze").exists()


def test_intake_state_under_observed_native_source_is_refused_before_db_creation(tmp_path):
    _source, _raw, _descriptor, _value, frozen, _trial_root = _book(tmp_path)
    native_state = tmp_path / "native" / "state"
    with pytest.raises(ValueError, match="native|source|outside"):
        intake_book(native_state, Path(frozen["freeze_receipt"]), "forbidden-state")
    assert not native_state.exists()


def test_project_replay_refuses_corrupted_typed_rows(tmp_path):
    _source, _raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path)
    state = tmp_path / "state"
    intake = intake_book(state, Path(frozen["freeze_receipt"]), "corrupt-replay")
    project_book(state, intake["observation_id"])
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        conn.execute("UPDATE typed_content SET text=text || ' altered' WHERE block_index=0")
    with pytest.raises(ValueError, match="typed book span|typed book rows|evidence"):
        project_book(state, intake["observation_id"])
    with pytest.raises(ValueError, match="typed book span|typed book rows|evidence"):
        read_book_occurrences(state, intake["observation_id"])


def test_read_occurrences_handles_state_path_with_uri_delimiters(tmp_path):
    _source, _raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path)
    state = tmp_path / "state?edition=1#book"
    intake = intake_book(state, Path(frozen["freeze_receipt"]), "uri-path-intent")
    project_book(state, intake["observation_id"])
    rows = read_book_occurrences(state, intake["observation_id"])
    assert rows and rows[0]["source_key"] == intake["source_key"]


def test_project_missing_observation_does_not_create_trial_state(tmp_path):
    state = tmp_path / "not-yet-created-state"
    with pytest.raises(ValueError, match="observation|projection intent|intake ledger"):
        project_book(state, 1)
    assert not state.exists()


def test_intake_state_ancestor_of_observed_native_source_is_refused(tmp_path):
    _source, _raw, _descriptor, _value, frozen, _trial_root = _book(tmp_path)
    with pytest.raises(ValueError, match="native|source|outside"):
        intake_book(tmp_path, Path(frozen["freeze_receipt"]), "ancestor-state")
    assert not (tmp_path / "book-trial-v1.sqlite3").exists()
