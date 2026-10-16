"""The book-owned planes select the same verified book-text occurrences."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import pytest

import trial_book_owned as owned
from content_io import ContentStore
from sensorium import sensorium_paths
from test_trial_book import _book
from trial_book import intake_book, project_book, read_book_occurrences


def _land_book(tmp_path: Path):
    _source, _raw, _descriptor_path, _descriptor, frozen, _trial_root = _book(tmp_path)
    state = tmp_path / "state"
    intake = intake_book(state, Path(frozen["freeze_receipt"]), "book-owned-observation")
    typed = project_book(state, intake["observation_id"])
    return state, intake, typed


def _stub_content(monkeypatch, tmp_path):
    model_home = tmp_path / "model-home"
    model_home.mkdir(exist_ok=True)
    monkeypatch.setenv("HOME", str(model_home))
    monkeypatch.setattr(Path, "home", classmethod(lambda _cls: model_home))
    monkeypatch.setattr(owned, "verify_model", lambda *_args, **_kwargs: {"verified": True})
    monkeypatch.setattr(owned.content, "_basis", lambda *_args, **_kwargs: ({}, "test-mini-basis"))

    def embedder(*, input):
        vectors = []
        for text in input:
            vector = [0.0] * 384
            vector[0] = float(len(text))
            vector[1] = float(sum(text.encode("utf-8")) % 997)
            vectors.append(vector)
        return vectors

    monkeypatch.setattr(owned.content, "_embedder",
                        lambda _device: (embedder, "cpu", ["CPUExecutionProvider"]))


def _read_selected(state: Path, observation: int):
    return [row for row in read_book_occurrences(state, observation)
            if row["metadata"]["lar_book_region"] == "book-text"]


def test_book_content_reuses_chroma_rows_after_unreceipted_crash(tmp_path, monkeypatch):
    _stub_content(monkeypatch, tmp_path)
    state, intake, typed = _land_book(tmp_path)
    selected = _read_selected(state, intake["observation_id"])
    all_rows = read_book_occurrences(state, intake["observation_id"])
    assert len(selected) == typed["region_blocks"]["book-text"]
    assert len(all_rows) > len(selected)
    root = tmp_path / "owned-content"

    def crash_after_rows(stage):
        if stage == "after_rows":
            raise RuntimeError("simulated process cut after Chroma rows")

    with pytest.raises(RuntimeError, match="process cut"):
        owned.project_book_content(state, root, intake["observation_id"],
                                   model_state_root=Path.home(), device="cpu",
                                   cut_hook=crash_after_rows)
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        status, receipt = conn.execute(
            "SELECT status,receipt_json FROM semantic_projection").fetchone()
        assert status == "pending" and receipt is None

    landed = owned.project_book_content(state, root, intake["observation_id"],
                                         model_state_root=Path.home(), device="cpu")
    assert landed["status"] == "landed"
    assert landed["model"] == "minilm" and landed["dimension"] == 384
    assert landed["device"] == "cpu" and landed["providers"] == ["CPUExecutionProvider"]
    assert landed["selection"] == "lar_book_region=book-text/v1"
    assert landed["selected_occurrences"] == len(selected)
    assert landed["selected_cids_sha256"]
    assert landed["intake_receipt_sha256"] and landed["typed_receipt_sha256"]
    assert owned.project_book_content(state, root, intake["observation_id"],
                                      model_state_root=Path.home(), device="cpu") == landed

    store = ContentStore(sensorium_paths(str(root)).content,
                         expected_dim=384, expected_model="minilm", append_only=True)
    chroma = store._col.get(include=["metadatas"])
    chroma_ids = set(chroma["ids"])
    selected_ids = {row["cid"] for row in selected}
    envelope_ids = {row["cid"] for row in all_rows} - selected_ids
    assert chroma_ids == selected_ids
    assert not chroma_ids.intersection(envelope_ids)
    assert all(row["parser_version"] == "book-lines-v1" for row in selected)
    assert all(meta["lar_parser_version"] == "book-lines-v1" for meta in chroma["metadatas"])
    assert all(meta["lar_embedder_model"] == "minilm" for meta in chroma["metadatas"])

    tampered = dict(chroma["metadatas"][0])
    tampered["lar_parser_version"] = "wrong-parser"
    store._col.update(ids=[chroma["ids"][0]], metadatas=[tampered])
    with pytest.raises(ValueError, match="readback|disagrees|receipt"):
        owned.project_book_content(state, root, intake["observation_id"],
                                   model_state_root=Path.home(), device="cpu")


def test_book_li_basis_replays_and_joins_the_content_cid_set(tmp_path, monkeypatch):
    _stub_content(monkeypatch, tmp_path)
    state, intake, _typed = _land_book(tmp_path)
    selected = _read_selected(state, intake["observation_id"])
    selected_ids = {row["cid"] for row in selected}
    root = tmp_path / "owned-content"
    content_receipt = owned.project_book_content(
        state, root, intake["observation_id"], model_state_root=Path.home(), device="cpu")

    identity = {"packages": {"stanza": "test"}, "code_sha256": {},
                "compute_device": "cpu",
                "stanza_assets_sha256": {"en/constituency/model.pt": "test-asset"}}
    monkeypatch.setattr(owned.li, "_runtime_identity", lambda: dict(identity))
    tree = {"type": "document", "children": [
        {"type": "sentence", "children": [{"type": "word"}]}
    ]}
    parsed = []

    def fake_parse(kind, text):
        parsed.append((kind, text))
        return tree, "carrier+stanza-constituency"

    monkeypatch.setattr(owned.li, "_parse_with_warrant", fake_parse)
    cuts = []

    def cut_after_one_shape(stage):
        cuts.append(stage)
        if stage == "after_shape":
            raise RuntimeError("simulated Shape cut")

    with pytest.raises(RuntimeError, match="Shape cut"):
        owned.project_book_li(state, [intake["observation_id"]],
                              cut_hook=cut_after_one_shape)
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM li_parse").fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 0

    receipt = owned.project_book_li(state, [intake["observation_id"]],
                                    require_constituency=True)
    assert receipt["status"] == "landed"
    assert receipt["warrant"] == "full-constituency"
    assert receipt["selection"] == content_receipt["selection"]
    assert receipt["ground"][0]["selected_cids_sha256"] == content_receipt["selected_cids_sha256"]
    assert receipt["ground"][0]["typed_receipt_sha256"] == content_receipt["typed_receipt_sha256"]
    assert receipt["occurrences"] == content_receipt["selected_occurrences"] == len(selected_ids)
    assert owned.project_book_li(state, [intake["observation_id"]],
                                 require_constituency=True) == receipt

    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        shape_ids = {row[0] for row in conn.execute(
            "SELECT occurrence_id FROM li_shape WHERE basis_sha256=?", (receipt["basis_sha256"],))}
        membership_ids = {row[0] for row in conn.execute(
            "SELECT occurrence_id FROM li_idiom WHERE basis_sha256=?", (receipt["basis_sha256"],))}
    assert shape_ids == membership_ids == selected_ids
    assert len(parsed) == len(selected_ids)  # carrier-envelope CIDs never reached the parser


def test_book_li_require_constituency_refuses_degraded_tier_without_basis(tmp_path, monkeypatch):
    state, intake, _typed = _land_book(tmp_path)
    identity = {"packages": {"stanza": "test"}, "code_sha256": {},
                "compute_device": "cpu", "stanza_assets_sha256": {}}
    monkeypatch.setattr(owned.li, "_runtime_identity", lambda: dict(identity))
    tree = {"type": "document", "children": [{"type": "sentence"}]}
    monkeypatch.setattr(owned.li, "_parse_with_warrant",
                        lambda _kind, _text: (tree, "carrier+segmented-prose"))
    with pytest.raises(ValueError, match="constituency model required"):
        owned.project_book_li(state, [intake["observation_id"]], require_constituency=True)
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM li_basis").fetchone()[0] == 0


def test_book_content_root_inside_native_source_is_refused_before_model_or_chroma(tmp_path, monkeypatch):
    state, intake, _typed = _land_book(tmp_path)
    native_root = tmp_path / "native"
    owned_root = native_root / "sensorium"
    model_home = tmp_path / "model-home"
    model_home.mkdir()
    monkeypatch.setenv("HOME", str(model_home))
    monkeypatch.setattr(Path, "home", classmethod(lambda _cls: model_home))
    monkeypatch.setattr(owned, "verify_model",
                        lambda *_args, **_kwargs: pytest.fail("model verification ran before native-root refusal"))
    with pytest.raises(ValueError, match="native|unsafe"):
        owned.project_book_content(state, owned_root, intake["observation_id"],
                                   model_state_root=tmp_path / "model-home", device="cpu")
    assert not owned_root.exists()
    with sqlite3.connect(state / "book-trial-v1.sqlite3") as conn:
        assert conn.execute("SELECT count(*) FROM semantic_projection").fetchone()[0] == 0
