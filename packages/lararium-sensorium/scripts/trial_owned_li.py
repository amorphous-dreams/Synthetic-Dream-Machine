#!/usr/bin/env python3
"""Derive an immutable Shape -> Idiom basis from a declared typed corpus.

Every occurrence joins by its typed CID. The basis records the exact ordered
training corpus, parser/miner code, runtime tier and ordered induced templates.
No fallback tier receives a full-model warrant merely because induction ran.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import sqlite3
from pathlib import Path
from typing import Callable

import structure_router
from form_induction import _preorder_types, _seq_support, induce_forest
from structure_router import canonical_json, parse_to_tree, structural_hash
from trial_intake import PARSER_VERSION, _canonical, _connect
from trial_project import _verify_landed


VIEW_VERSION = "owned-li-v1"
MIN_SUPPORT = 2
MAX_FORMS = 64
MAX_CANDIDATES = 96
_HERE = Path(__file__).resolve().parent


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _runtime_identity() -> dict:
    packages = {}
    for name in ("stanza", "spacy", "nltk", "tree-sitter"):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = None
    code = {name: _file_sha(_HERE / name) for name in
            ("structure_router.py", "form_induction.py", "trial_owned_li.py")}
    try:
        from stanza.resources.common import DEFAULT_MODEL_DIR
        assets_root = Path(DEFAULT_MODEL_DIR).resolve()
    except ImportError:
        assets_root = (Path.home() / ".cache/stanza/resources").resolve()
    assets = {}
    if assets_root.is_dir():
        for path in sorted(assets_root.rglob("*")):
            if path.is_file():
                resolved = path.resolve()
                if not resolved.is_relative_to(assets_root):
                    raise ValueError("Stanza asset escapes its model root")
                assets[str(path.relative_to(assets_root))] = _file_sha(path)
    return {"packages": packages, "code_sha256": code,
            "compute_device": structure_router._device_cap(),
            "stanza_assets_sha256": assets}


def _corpus(conn: sqlite3.Connection, observation_ids: list[int]) -> list[tuple[str, str, dict]]:
    if not observation_ids or len(set(observation_ids)) != len(observation_ids):
        raise ValueError("declare one or more distinct observations")
    rows = []
    for observation_id in observation_ids:
        found = conn.execute(
            "SELECT p.status,p.parser_version,r.receipt_json FROM projection_intent p "
            "JOIN projection_receipt r USING(observation_id) WHERE p.observation_id=?",
            (observation_id,),
        ).fetchone()
        if found is None or found[0] != "landed" or found[1] != PARSER_VERSION:
            raise ValueError(f"observation {observation_id} lacks current typed ground")
        _verify_landed(conn, observation_id, json.loads(found[2]))
        blocks = conn.execute(
            "SELECT t.cid,t.text,t.metadata_json FROM projection_block b "
            "JOIN typed_content t ON t.cid=b.cid WHERE b.observation_id=? ORDER BY b.block_index",
            (observation_id,),
        ).fetchall()
        rows.extend((cid, text, json.loads(meta)) for cid, text, meta in blocks)
    return rows


def _parse_with_warrant(kind: str, text: str) -> tuple[dict | None, str]:
    """Name the tier used for this occurrence, including carrier prose grafts."""
    seen: list[str] = []

    def prose(span: str) -> dict:
        tree = structure_router._prose_stanza(span)
        if tree is not None:
            seen.append("stanza-constituency")
            return tree
        tree = structure_router._prose_spacy(span)
        if tree is not None:
            seen.append("spacy-dependency")
            return tree
        seen.append("segmented-prose")
        return structure_router._prose_segment(span)

    if kind in ("memetic-wikitext", "tiddlywiki"):
        tree = structure_router._parse_carrier(text.encode("utf-8"), prose=prose)
        if tree is not None:
            tiers = sorted(set(seen))
            return tree, "carrier+" + "+".join(tiers or ["no-prose"])
    if kind == "prose" or kind in ("memetic-wikitext", "tiddlywiki"):
        tree = prose(text)
        return tree, seen[-1]
    tree = parse_to_tree(kind, text)
    return tree, "router-ungraded"


def _full_constituency_warrant(tiers: list[str], identity: dict) -> bool:
    """Require Stanza for every prose graft; a carrier with no prose needs no graft."""
    stanza = {"stanza-constituency", "carrier+stanza-constituency"}
    allowed = stanza | {"carrier+no-prose"}
    return (bool(stanza.intersection(tiers)) and set(tiers) <= allowed
            and any(name.startswith("en/") for name in
                    identity["stanza_assets_sha256"]))


def project_owned_li(state_root: Path | str, observation_ids: list[int], *,
                     require_constituency: bool = False,
                     cut_hook: Callable[[str], None] | None = None) -> dict:
    """Mine one closed corpus; commit basis, shapes and memberships together."""
    conn = _connect(Path(state_root).resolve())
    cut = cut_hook or (lambda _stage: None)
    try:
        typed = _corpus(conn, observation_ids)
        if len({cid for cid, _, _ in typed}) != len(typed):
            raise ValueError("declared corpus repeats an occurrence across observations")
        if len(typed) > 20_000:
            raise ValueError("declared corpus exceeds the miner's 20,000-tree ceiling")
        corpus_rows = [(cid, _sha(text.encode()), meta.get("lar_kind", "memetic-wikitext"))
                       for cid, text, meta in typed]
        corpus_sha = _sha(_canonical({"observations": observation_ids,
                                     "rows": corpus_rows}).encode())
        identity = _runtime_identity()
        parser_identity = _sha(_canonical({"view_version": VIEW_VERSION,
                                           "runtime": identity}).encode())
        shapes = []
        for cid, text, meta in typed:
            text_sha = _sha(text.encode())
            held = conn.execute(
                "SELECT text_sha256,shape_sha256,tree_json,parser_tier FROM li_parse "
                "WHERE parser_identity_sha256=? AND occurrence_id=?",
                (parser_identity, cid),
            ).fetchone()
            if held is not None:
                if held[0] != text_sha or structural_hash(json.loads(held[2])) != held[1]:
                    raise ValueError(f"staged Shape disagrees with ground for occurrence {cid}")
                tree, shape_hash, tier = json.loads(held[2]), held[1], held[3]
            else:
                kind = meta.get("lar_kind") or "memetic-wikitext"
                tree, tier = _parse_with_warrant(kind, text)
                if tree is None:
                    raise ValueError(f"parser returned no Shape for occurrence {cid}")
                shape_hash = structural_hash(tree)
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("INSERT INTO li_parse VALUES (?,?,?,?,?,?)",
                             (parser_identity, cid, text_sha, shape_hash,
                              canonical_json(tree), tier))
                conn.execute("COMMIT")
            shapes.append((cid, tree, shape_hash, tier))
            cut("after_shape")
        if _runtime_identity() != identity:
            raise ValueError("parser assets changed during Shape projection; restart on the new basis")
        tiers = sorted({tier for _, _, _, tier in shapes})
        full = _full_constituency_warrant(tiers, identity)
        if require_constituency and not full:
            raise ValueError(f"constituency model required; parser tiers held {tiers}")
        cut("after_parse")
        forest = [tree for _, tree, _, _ in shapes]
        mined = induce_forest(forest, min_support=MIN_SUPPORT,
                              max_forms=MAX_FORMS, max_candidates=MAX_CANDIDATES)
        forms = mined["forms"]
        manifest = {"view_version": VIEW_VERSION, "corpus_sha256": corpus_sha,
                    "observations": observation_ids, "runtime": identity,
                    "parser_tiers": tiers,
                    "induction": {"min_support": MIN_SUPPORT, "max_forms": MAX_FORMS,
                                  "max_candidates": MAX_CANDIDATES, "max_trees": 20000},
                    "ordered_forms": forms}
        basis = _sha(_canonical(manifest).encode())
        members = []
        for cid, tree, _, _ in shapes:
            stream: list[str] = []
            _preorder_types(tree, stream)
            members.append((cid, [i for i, form in enumerate(forms)
                                  if _seq_support([stream], tuple(form["seq"])) > 0]))
        receipt = {"schema": "lararium.sensorium.owned-li-receipt.v1",
                   "basis_sha256": basis, "corpus_sha256": corpus_sha,
                   "observations": observation_ids, "occurrences": len(shapes),
                   "forms": len(forms), "parser_tiers": tiers,
                   "warrant": "full-constituency" if full
                   else "degraded-parser", "status": "landed"}
        cut("before_commit")
        conn.execute("BEGIN IMMEDIATE")
        held = conn.execute("SELECT manifest_json,receipt_json FROM li_basis WHERE basis_sha256=?",
                            (basis,)).fetchone()
        expected = (_canonical(manifest), _canonical(receipt))
        if held is None:
            conn.execute("INSERT INTO li_basis VALUES (?,?,?,?)",
                         (basis, corpus_sha, *expected))
            conn.executemany("INSERT INTO li_shape VALUES (?,?,?,?,?)",
                             ((basis, cid, hash_, canonical_json(tree), tier)
                              for cid, tree, hash_, tier in shapes))
            conn.executemany("INSERT INTO li_idiom VALUES (?,?,?)",
                             ((basis, cid, _canonical(indices)) for cid, indices in members))
        elif held != expected:
            raise ValueError("basis address holds a different manifest or receipt")
        for cid, tree, hash_, tier in shapes:
            if conn.execute("SELECT shape_sha256,tree_json,parser_tier FROM li_shape "
                            "WHERE basis_sha256=? AND occurrence_id=?", (basis, cid)).fetchone() != (
                                hash_, canonical_json(tree), tier):
                raise ValueError(f"stored Shape disagrees for occurrence {cid}")
        for cid, indices in members:
            if conn.execute("SELECT membership_json FROM li_idiom WHERE basis_sha256=? "
                            "AND occurrence_id=?", (basis, cid)).fetchone() != (_canonical(indices),):
                raise ValueError(f"stored Idiom disagrees for occurrence {cid}")
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
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--observation", type=int, action="append", required=True)
    parser.add_argument("--require-constituency", action="store_true")
    args = parser.parse_args()
    try:
        result = project_owned_li(args.state_root, args.observation,
                                  require_constituency=args.require_constituency)
    except (OSError, sqlite3.Error, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
