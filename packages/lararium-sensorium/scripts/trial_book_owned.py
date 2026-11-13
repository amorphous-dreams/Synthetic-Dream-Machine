#!/usr/bin/env python3
"""Read a book's verified literary body into owned Content and Shape/Idiom.

The book ledger remains separate from the Claude ledger. Both derived planes
select the exact same `book-text` occurrences; carrier-envelope rows remain
in typed custody and outside this reading.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Callable

from content_io import ContentStore
from sensorium import sensorium_paths
from trial_book import DB_NAME, PARSER_VERSION, _canonical, _connect, _verified_stored, _verify_landed
from trial_model_check import DEFAULT_LOCK, verify_model
import trial_owned_content as content
import trial_owned_li as li


CONTENT_VIEW_VERSION = "book-owned-content-v1"
LI_VIEW_VERSION = "book-owned-li-v1"
SELECTION = "lar_book_region=book-text/v1"


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _ground(conn: sqlite3.Connection, observation_id: int) -> tuple[dict, list[tuple[str, str, dict]], dict]:
    held = conn.execute(
        "SELECT o.source_key,o.revision_sha256,o.frontier,p.status,p.parser_version,"
        "pr.receipt_json,ir.receipt_json FROM observation o "
        "JOIN projection_intent p USING(observation_id) "
        "JOIN projection_receipt pr USING(observation_id) "
        "JOIN intake_receipt ir USING(observation_id) WHERE o.observation_id=?",
        (observation_id,),
    ).fetchone()
    if held is None or held[3:5] != ("landed", PARSER_VERSION):
        raise ValueError("book observation needs a landed current typed projection")
    source, revision, frontier, _, _, typed_json, intake_json = held
    intake = json.loads(intake_json)
    if (intake.get("observation_id") != observation_id
            or intake.get("source_key") != source
            or intake.get("revision_sha256") != revision
            or intake.get("frontier") != frontier):
        raise ValueError("book intake receipt disagrees with observation")
    boundaries = {}
    for key in ("observed_native_path", "freeze_root"):
        value = intake.get(key)
        if (not isinstance(value, str) or not Path(value).is_absolute()
                or ".." in Path(value).parts):
            raise ValueError(f"book intake receipt lacks a safe {key}")
        boundaries[key] = Path(value).resolve()
    raw = _verified_stored(conn, source, revision)
    _verify_landed(conn, observation_id, json.loads(typed_json), raw)
    rows = conn.execute(
        "SELECT t.cid,t.text,t.metadata_json FROM projection_block b "
        "JOIN typed_content t ON t.cid=b.cid WHERE b.observation_id=? ORDER BY b.block_index",
        (observation_id,),
    ).fetchall()
    selected = [(cid, text, json.loads(meta)) for cid, text, meta in rows
                if json.loads(meta).get("lar_book_region") == "book-text"]
    if not selected:
        raise ValueError("book observation has no literary body occurrences")
    if any(meta.get("lar_surface") != "book" for _, _, meta in selected):
        raise ValueError("book body selection contains a non-book occurrence")
    evidence = {"observation_id": observation_id, "source_key": source,
                "revision_sha256": revision, "source_frontier": frontier,
                "intake_receipt_sha256": _sha(intake_json.encode()),
                "typed_receipt_sha256": _sha(typed_json.encode()),
                "selected_cids_sha256": _sha(_canonical([cid for cid, _, _ in selected]).encode()),
                "selected_occurrences": len(selected), "selection": SELECTION}
    return evidence, selected, boundaries


def _safe_content_root(sensorium: Path, state: Path, boundaries: dict) -> None:
    native_dir = boundaries["observed_native_path"].parent
    repo = Path(__file__).resolve().parents[3]
    for label, held in (("native", native_dir), ("freeze", boundaries["freeze_root"]),
                        ("state", state), ("repository", repo)):
        if sensorium.is_relative_to(held) or held.is_relative_to(sensorium):
            raise ValueError(f"book Content root overlaps {label} evidence")


def _content_metadata(cid: str, text: str, meta: dict, ground: dict, basis: str) -> dict:
    carried = dict(meta)
    carried.update({"lar_occurrence_id": cid,
                    "lar_text_sha256": _sha(text.encode()),
                    "lar_source_key": ground["source_key"],
                    "lar_revision_sha256": ground["revision_sha256"],
                    "lar_parser_version": PARSER_VERSION,
                    "lar_embedder_model": "minilm",
                    "lar_model_basis": basis,
                    "lar_book_selection": SELECTION})
    carried.pop("lar_verbatim_sha", None)
    return carried


def project_book_content(state_root: Path | str, sensorium_root: Path | str,
                         observation_id: int, *, model_state_root: Path | str | None = None,
                         device: str = "auto", lock_path: Path = DEFAULT_LOCK,
                         cut_hook: Callable[[str], None] | None = None) -> dict:
    """Infer selected book text with pinned MiniLM and receipt exact readback."""
    state = Path(state_root).resolve()
    sensorium = Path(sensorium_root).resolve()
    model_state = Path(model_state_root or Path.home()).resolve()
    if observation_id < 1 or not (state / DB_NAME).is_file():
        raise ValueError("project a positive, committed book observation")
    if Path.home().resolve() != model_state:
        raise ValueError("HOME must name the verified model state root")
    cut = cut_hook or (lambda _stage: None)
    conn = _connect(state)
    try:
        ground, selected, boundaries = _ground(conn, observation_id)
        _safe_content_root(sensorium, state, boundaries)
        verify_model(model_state, lock_path)
        embedder, effective, providers = content._embedder(device)
        _, model_basis = content._basis(model_state, lock_path, effective, providers)
        view_key = _sha(_canonical({"root": str(sensorium), "basis": model_basis,
                                    "version": CONTENT_VIEW_VERSION, "selection": SELECTION}).encode())
        rows = [(cid, text, _content_metadata(cid, text, meta, ground, model_basis))
                for cid, text, meta in selected]
        conn.execute("BEGIN IMMEDIATE")
        prior = conn.execute(
            "SELECT sensorium_root,model_basis_sha256,status,receipt_json "
            "FROM semantic_projection WHERE observation_id=? AND view_key=?",
            (observation_id, view_key),
        ).fetchone()
        if prior is None:
            conn.execute("INSERT INTO semantic_projection VALUES (?,?,?,?,?,NULL)",
                         (observation_id, view_key, str(sensorium), model_basis, "pending"))
        elif prior[:2] != (str(sensorium), model_basis):
            raise ValueError("book semantic intent disagrees with root or model basis")
        conn.execute("COMMIT")
        cut("after_intent")

        store = ContentStore(sensorium_paths(str(sensorium)).content,
                             expected_dim=384, expected_model="minilm", append_only=True)
        content._assert_one_basis(store, model_basis)
        if prior is not None and prior[2] == "landed":
            if not prior[3]:
                raise ValueError("landed book semantic projection has no receipt")
            receipt = json.loads(prior[3])
            if (any(receipt.get(key) != value for key, value in ground.items())
                    or receipt.get("view_key") != view_key
                    or receipt.get("sensorium_root") != str(sensorium)
                    or receipt.get("model_basis_sha256") != model_basis
                    or content._readback(store, rows) != receipt["semantic_sha256"]):
                raise ValueError("landed book Content disagrees with typed ground or receipt")
            return receipt

        inferred: dict[str, list[float]] = {}
        for start in range(0, len(rows), content._BATCH):
            batch = rows[start:start + content._BATCH]
            vectors = [[float(x) for x in vec] for vec in embedder(input=[r[1] for r in batch])]
            if len(vectors) != len(batch) or any(len(vec) != 384 for vec in vectors):
                raise ValueError("pinned MiniLM returned the wrong count or vector width")
            new = []
            for (cid, text, meta), vector in zip(batch, vectors):
                inferred[cid] = vector
                if store.get(cid) is None:
                    new.append((cid, text, vector, meta))
                else:
                    content._readback(store, [(cid, text, meta)], {cid: vector})
            if new:
                result = store.put_many(new)
                if result["failed"] or len(result["landed"]) != len(new):
                    raise ValueError(f"owned book Content batch refused rows: {result['failed']}")
            content._readback(store, batch, inferred)
            if start == 0:
                cut("after_first_batch")
        semantic_sha = content._readback(store, rows, inferred)
        cut("after_rows")
        conn.execute("BEGIN IMMEDIATE")
        held = conn.execute("SELECT status,receipt_json FROM semantic_projection "
                            "WHERE observation_id=? AND view_key=?",
                            (observation_id, view_key)).fetchone()
        if held != ("pending", None):
            raise ValueError("book semantic intent changed during projection")
        conn.execute("UPDATE semantic_projection SET status='landed' "
                     "WHERE observation_id=? AND view_key=?", (observation_id, view_key))
        frontier = content._advance(conn, ground["source_key"], view_key)
        receipt = {"schema": "lararium.sensorium.book-owned-content-receipt.v1",
                   **ground, "semantic_frontier": frontier,
                   "view_key": view_key, "sensorium_root": str(sensorium),
                   "model": "minilm", "dimension": 384,
                   "model_basis_sha256": model_basis, "device_request": device,
                   "device": effective, "providers": providers,
                   "semantic_sha256": semantic_sha, "status": "landed"}
        conn.execute("UPDATE semantic_projection SET receipt_json=? "
                     "WHERE observation_id=? AND view_key=?",
                     (_canonical(receipt), observation_id, view_key))
        cut("before_commit")
        conn.execute("COMMIT")
        cut("after_commit")
        return receipt
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def project_book_li(state_root: Path | str, observation_ids: list[int], *,
                    require_constituency: bool = False,
                    cut_hook: Callable[[str], None] | None = None) -> dict:
    """Mine a declared immutable corpus of verified book-text occurrences."""
    if not observation_ids or len(observation_ids) != len(set(observation_ids)):
        raise ValueError("declare one or more distinct book observations")
    state = Path(state_root).resolve()
    if not (state / DB_NAME).is_file():
        raise ValueError("book observations need a committed intake ledger")
    cut = cut_hook or (lambda _stage: None)
    conn = _connect(state)
    try:
        ground = []
        selected = []
        for observation_id in observation_ids:
            witness, rows, _boundaries = _ground(conn, observation_id)
            ground.append(witness)
            selected.extend(rows)
        if len({cid for cid, _, _ in selected}) != len(selected):
            raise ValueError("declared book corpus repeats an occurrence")
        if len(selected) > 20_000:
            raise ValueError("declared book corpus exceeds the 20,000-tree ceiling")
        corpus_rows = [(cid, _sha(text.encode()), meta.get("lar_kind", "memetic-wikitext"))
                       for cid, text, meta in selected]
        corpus_sha = _sha(_canonical({"observations": observation_ids, "selection": SELECTION,
                                      "ground": ground, "rows": corpus_rows}).encode())
        identity = li._runtime_identity()
        identity["book_bridge_sha256"] = li._file_sha(Path(__file__).resolve())
        parser_identity = _sha(_canonical({"view_version": LI_VIEW_VERSION,
                                           "runtime": identity}).encode())
        shapes = []
        for cid, text, meta in selected:
            text_sha = _sha(text.encode())
            held = conn.execute(
                "SELECT text_sha256,shape_sha256,tree_json,parser_tier FROM li_parse "
                "WHERE parser_identity_sha256=? AND occurrence_id=?",
                (parser_identity, cid),
            ).fetchone()
            if held is not None:
                if held[0] != text_sha or li.structural_hash(json.loads(held[2])) != held[1]:
                    raise ValueError(f"staged book Shape disagrees with {cid}")
                tree, shape_hash, tier = json.loads(held[2]), held[1], held[3]
            else:
                tree, tier = li._parse_with_warrant(meta.get("lar_kind") or "memetic-wikitext", text)
                if tree is None:
                    raise ValueError(f"book parser returned no Shape for {cid}")
                shape_hash = li.structural_hash(tree)
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("INSERT INTO li_parse VALUES (?,?,?,?,?,?)",
                             (parser_identity, cid, text_sha, shape_hash,
                              li.canonical_json(tree), tier))
                conn.execute("COMMIT")
            shapes.append((cid, tree, shape_hash, tier))
            cut("after_shape")
        check = li._runtime_identity()
        check["book_bridge_sha256"] = li._file_sha(Path(__file__).resolve())
        if check != identity:
            raise ValueError("book parser runtime changed during Shape projection")
        tiers = sorted({tier for _, _, _, tier in shapes})
        full = li._full_constituency_warrant(tiers, identity)
        if require_constituency and not full:
            raise ValueError(f"constituency model required; book parser tiers held {tiers}")
        cut("after_parse")
        mined = li.induce_forest([tree for _, tree, _, _ in shapes],
                                min_support=li.MIN_SUPPORT, max_forms=li.MAX_FORMS,
                                max_candidates=li.MAX_CANDIDATES)
        forms = mined["forms"]
        manifest = {"view_version": LI_VIEW_VERSION, "corpus_sha256": corpus_sha,
                    "observations": observation_ids, "ground": ground,
                    "selection": SELECTION, "runtime": identity,
                    "parser_identity_sha256": parser_identity,
                    "parser_tiers": tiers,
                    "induction": {"min_support": li.MIN_SUPPORT, "max_forms": li.MAX_FORMS,
                                  "max_candidates": li.MAX_CANDIDATES, "max_trees": 20000},
                    "ordered_forms": forms}
        basis = _sha(_canonical(manifest).encode())
        members = []
        for cid, tree, _, _ in shapes:
            stream: list[str] = []
            li._preorder_types(tree, stream)
            members.append((cid, [i for i, form in enumerate(forms)
                                  if li._seq_support([stream], tuple(form["seq"])) > 0]))
        receipt = {"schema": "lararium.sensorium.book-owned-li-receipt.v1",
                   "basis_sha256": basis, "corpus_sha256": corpus_sha,
                   "observations": observation_ids, "ground": ground,
                   "selection": SELECTION, "parser_identity_sha256": parser_identity,
                   "occurrences": len(shapes), "forms": len(forms),
                   "parser_tiers": tiers,
                   "warrant": "full-constituency" if full else "degraded-parser",
                   "status": "landed"}
        cut("before_commit")
        conn.execute("BEGIN IMMEDIATE")
        expected = (_canonical(manifest), _canonical(receipt))
        held = conn.execute("SELECT manifest_json,receipt_json FROM li_basis WHERE basis_sha256=?",
                            (basis,)).fetchone()
        if held is None:
            conn.execute("INSERT INTO li_basis VALUES (?,?,?,?)",
                         (basis, corpus_sha, *expected))
            conn.executemany("INSERT INTO li_shape VALUES (?,?,?,?,?)",
                             ((basis, cid, shape_hash, li.canonical_json(tree), tier)
                              for cid, tree, shape_hash, tier in shapes))
            conn.executemany("INSERT INTO li_idiom VALUES (?,?,?)",
                             ((basis, cid, _canonical(indices)) for cid, indices in members))
        elif held != expected:
            raise ValueError("book li basis address holds different evidence")
        for cid, tree, shape_hash, tier in shapes:
            if conn.execute("SELECT shape_sha256,tree_json,parser_tier FROM li_shape "
                            "WHERE basis_sha256=? AND occurrence_id=?", (basis, cid)).fetchone() != (
                                shape_hash, li.canonical_json(tree), tier):
                raise ValueError(f"stored book Shape disagrees for {cid}")
        for cid, indices in members:
            if conn.execute("SELECT membership_json FROM li_idiom WHERE basis_sha256=? "
                            "AND occurrence_id=?", (basis, cid)).fetchone() != (_canonical(indices),):
                raise ValueError(f"stored book Idiom disagrees for {cid}")
        conn.execute("COMMIT")
        cut("after_commit")
        return receipt
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    command = parser.add_subparsers(dest="command", required=True)
    semantic = command.add_parser("content")
    semantic.add_argument("--state-root", type=Path, required=True)
    semantic.add_argument("--sensorium-root", type=Path, required=True)
    semantic.add_argument("--observation", type=int, required=True)
    semantic.add_argument("--model-state-root", type=Path, default=Path.home())
    semantic.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    shape = command.add_parser("li")
    shape.add_argument("--state-root", type=Path, required=True)
    shape.add_argument("--observation", type=int, action="append", required=True)
    shape.add_argument("--require-constituency", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "content":
            result = project_book_content(args.state_root, args.sensorium_root,
                                          args.observation,
                                          model_state_root=args.model_state_root,
                                          device=args.device)
        else:
            result = project_book_li(args.state_root, args.observation,
                                     require_constituency=args.require_constituency)
    except (OSError, sqlite3.Error, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
