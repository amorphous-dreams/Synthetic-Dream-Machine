#!/usr/bin/env python3
"""Project typed trial blocks into one owned Content view with real pinned MiniLM.

SQLite holds custody, typed ground, semantic intent and receipt. Chroma owns the
derived vector view. A pending SQLite intent precedes every Chroma write; stable
occurrence IDs and full readback close the non-atomic crossing after a crash.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import onnxruntime
import sqlite3
import struct
from pathlib import Path
from typing import Callable

from content_io import ContentStore, _vectors_differ
from mempalace.embedding import _resolve_providers, get_embedding_function
from sensorium import sensorium_paths
from trial_intake import DB_NAME, PARSER_VERSION, _canonical, _connect
from trial_model_check import DEFAULT_LOCK, verify_model
from trial_project import _verify_landed


VIEW_VERSION = "owned-content-v2"
_BATCH = 32


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _vector_sha(vector: list[float]) -> str:
    return _sha(b"".join(struct.pack("<f", float(value)) for value in vector))


def _embedder(requested: str):
    if requested not in ("auto", "cpu", "cuda"):
        raise ValueError("device must name auto, cpu or cuda")
    _, effective = _resolve_providers(requested, "minilm")
    if requested == "cuda" and effective != "cuda":
        raise ValueError("CUDA requested but ONNX Runtime has no CUDA provider")

    def open_on(device: str):
        embedder = get_embedding_function(device=device, model="minilm")
        probe = embedder(input=["Sensorium execution-provider witness"])
        if len(probe) != 1 or len(probe[0]) != 384:
            raise ValueError("embedding provider failed its 384-dimensional witness")
        active = list(embedder.model.get_providers())
        if device == "cuda" and "CUDAExecutionProvider" not in active:
            raise ValueError("CUDA provider did not activate for the pinned MiniLM model")
        return embedder, active

    try:
        embedder, active = open_on(effective)
    except Exception:
        if requested != "auto" or effective == "cpu":
            raise
        effective = "cpu"
        embedder, active = open_on("cpu")
    return embedder, effective, active


def _basis(model_state_root: Path, lock_path: Path, device: str,
           providers: list[str]) -> tuple[dict, str]:
    if Path.home().resolve() != model_state_root.resolve():
        raise ValueError("HOME must name the verified model state root before Python imports Chroma")
    verified = verify_model(model_state_root, lock_path)
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    if lock["model"] != "minilm" or lock["dimensions"] != 384:
        raise ValueError("owned Content trial requires pinned minilm/384")
    package, version = lock["package"].split("==", 1)
    if importlib.metadata.version(package) != version:
        raise ValueError("installed Chroma version disagrees with model basis")
    basis = _sha(_canonical({"assets": lock, "view_version": VIEW_VERSION,
                             "embedder": "mempalace.embedding:minilm",
                             "device": device, "providers": providers,
                             "onnxruntime": onnxruntime.__version__}).encode())
    return verified, basis


def _typed_rows(conn: sqlite3.Connection, observation_id: int) -> tuple[dict, list[tuple]]:
    row = conn.execute(
        "SELECT o.source_key,o.revision_sha256,o.frontier,p.status,p.parser_version,r.receipt_json "
        "FROM observation o JOIN projection_intent p USING(observation_id) "
        "JOIN projection_receipt r USING(observation_id) WHERE o.observation_id=?",
        (observation_id,),
    ).fetchone()
    if row is None or row[3] != "landed" or row[4] != PARSER_VERSION:
        raise ValueError("observation needs a landed typed projection under the current parser")
    receipt = json.loads(row[5])
    _verify_landed(conn, observation_id, receipt)
    blocks = conn.execute(
        "SELECT b.block_index,t.cid,t.text,t.metadata_json "
        "FROM projection_block b JOIN typed_content t ON t.cid=b.cid "
        "WHERE b.observation_id=? ORDER BY b.block_index", (observation_id,),
    ).fetchall()
    return {"source_key": row[0], "revision": row[1], "frontier": row[2],
            "typed_receipt_sha256": _sha(row[5].encode())}, blocks


def _metadata(cid: str, text: str, raw: str, source: dict, basis: str) -> dict:
    meta = json.loads(raw)
    if not isinstance(meta, dict):
        raise ValueError("typed metadata must hold one flat object")
    meta.update({"lar_occurrence_id": cid,
                 "lar_text_sha256": _sha(text.encode("utf-8")),
                 "lar_source_key": source["source_key"],
                 "lar_revision_sha256": source["revision"],
                 "lar_parser_version": PARSER_VERSION,
                 "lar_embedder_model": "minilm",
                 "lar_model_basis": basis})
    # The legacy recall join treats lar_verbatim_sha as an occurrence key. A
    # genuine text digest under that name would merge repeated occurrences.
    meta.pop("lar_verbatim_sha", None)
    return meta


def _assert_one_basis(store: ContentStore, basis: str) -> None:
    offset = 0
    while True:
        page = store._col.get(limit=512, offset=offset, include=["metadatas"])
        metas = page.get("metadatas") or []
        for meta in metas:
            if (meta or {}).get("lar_model_basis") != basis:
                raise ValueError("owned Content root holds an absent or different model basis")
        if len(metas) < 512:
            return
        offset += len(metas)


def _readback(store: ContentStore, rows: list[tuple[str, str, dict]],
              vectors: dict[str, list[float]] | None = None) -> str:
    witnessed = []
    for cid, text, meta in rows:
        held = store.get_with_vector(cid)
        if held is None or held["document"] != text or held["metadata"] != meta:
            raise ValueError(f"owned Content readback disagrees with typed block {cid}")
        vector = held["embedding"]
        if vector is None or len(vector) != 384:
            raise ValueError(f"owned Content vector missing or wrong width for {cid}")
        if vectors is not None and _vectors_differ(vector, vectors[cid]):
            raise ValueError(f"owned Content vector disagrees with pinned inference for {cid}")
        witnessed.append((cid, text, _canonical(meta), _vector_sha(vector)))
    return _sha(_canonical({"rows": witnessed}).encode())


def _advance(conn: sqlite3.Connection, source_key: str, view_key: str) -> int:
    observations = conn.execute(
        "SELECT o.frontier,o.observation_id,s.status FROM observation o "
        "LEFT JOIN semantic_projection s ON s.observation_id=o.observation_id AND s.view_key=? "
        "WHERE o.source_key=? ORDER BY o.frontier", (view_key, source_key),
    ).fetchall()
    reached = 0
    reached_id = None
    for frontier, observation_id, status in observations:
        if frontier != reached + 1 or status != "landed":
            break
        reached, reached_id = frontier, observation_id
    if reached_id is not None:
        conn.execute(
            "INSERT INTO semantic_frontier VALUES (?,?,?,?) "
            "ON CONFLICT(source_key,view_key) DO UPDATE SET frontier=excluded.frontier, "
            "observation_id=excluded.observation_id",
            (source_key, view_key, reached, reached_id),
        )
    return reached


def current_revision(state_root: Path | str, source_key: str) -> str:
    """Resolve the selected revision separately from immutable historical Content rows."""
    conn = _connect(Path(state_root).resolve())
    try:
        row = conn.execute("SELECT revision_sha256 FROM observation WHERE source_key=? "
                           "ORDER BY frontier DESC LIMIT 1", (source_key,)).fetchone()
        if row is None:
            raise ValueError("source has no observation")
        return row[0]
    finally:
        conn.close()


def project_owned_content(state_root: Path | str, sensorium_root: Path | str,
                          observation_id: int, *, model_state_root: Path | str | None = None,
                          device: str = "auto",
                          lock_path: Path = DEFAULT_LOCK,
                          cut_hook: Callable[[str], None] | None = None) -> dict:
    """Land one typed observation through real inference, then receipt the verified view."""
    state_root = Path(state_root).resolve()
    sensorium_root = Path(sensorium_root).resolve()
    model_state = Path(model_state_root or Path.home()).resolve()
    if observation_id < 1 or not (state_root / DB_NAME).is_file():
        raise ValueError("project a positive, committed trial observation")
    if Path.home().resolve() != model_state:
        raise ValueError("HOME must name the verified model state root before Python imports Chroma")
    # Verify offline bytes before a model or its provider can request assets.
    verify_model(model_state, lock_path)
    embedder, effective, providers = _embedder(device)
    _, basis = _basis(model_state, lock_path, effective, providers)
    view_key = _sha(_canonical({"root": str(sensorium_root), "basis": basis,
                                "version": VIEW_VERSION}).encode())
    cut = cut_hook or (lambda _stage: None)
    conn = _connect(state_root)
    try:
        source, typed = _typed_rows(conn, observation_id)
        rows = [(cid, text, _metadata(cid, text, raw, source, basis))
                for _, cid, text, raw in typed]
        conn.execute("BEGIN IMMEDIATE")
        prior = conn.execute(
            "SELECT sensorium_root,model_basis_sha256,status,receipt_json "
            "FROM semantic_projection WHERE observation_id=? AND view_key=?",
            (observation_id, view_key),
        ).fetchone()
        if prior is None:
            conn.execute("INSERT INTO semantic_projection VALUES (?,?,?,?,?,NULL)",
                         (observation_id, view_key, str(sensorium_root), basis, "pending"))
        elif prior[:2] != (str(sensorium_root), basis):
            raise ValueError("semantic intent disagrees with owned root or model basis")
        conn.execute("COMMIT")
        cut("after_intent")

        content_path = sensorium_paths(str(sensorium_root)).content
        store = ContentStore(content_path, expected_dim=384, expected_model="minilm",
                             append_only=True)
        _assert_one_basis(store, basis)
        if prior is not None and prior[2] == "landed":
            if not prior[3]:
                raise ValueError("landed semantic projection has no receipt")
            receipt = json.loads(prior[3])
            if _readback(store, rows) != receipt["semantic_sha256"]:
                raise ValueError("landed owned Content disagrees with semantic receipt")
            return receipt

        inferred: dict[str, list[float]] = {}
        for start in range(0, len(rows), _BATCH):
            batch = rows[start:start + _BATCH]
            vectors = [[float(x) for x in vec] for vec in embedder(input=[r[1] for r in batch])]
            if len(vectors) != len(batch) or any(len(vec) != 384 for vec in vectors):
                raise ValueError("pinned model returned the wrong number or width of vectors")
            new = []
            for (cid, text, meta), vector in zip(batch, vectors):
                inferred[cid] = vector
                if store.get(cid) is None:
                    new.append((cid, text, vector, meta))
                else:
                    _readback(store, [(cid, text, meta)], {cid: vector})
            if new:
                result = store.put_many(new)
                if result["failed"] or len(result["landed"]) != len(new):
                    raise ValueError(f"owned Content batch refused rows: {result['failed']}")
            _readback(store, batch, inferred)
            if start == 0:
                cut("after_first_batch")
        semantic_sha = _readback(store, rows, inferred)
        cut("after_rows")
        conn.execute("BEGIN IMMEDIATE")
        held = conn.execute("SELECT status,receipt_json FROM semantic_projection "
                            "WHERE observation_id=? AND view_key=?",
                            (observation_id, view_key)).fetchone()
        if held != ("pending", None):
            raise ValueError("semantic intent changed during projection")
        conn.execute("UPDATE semantic_projection SET status='landed' "
                     "WHERE observation_id=? AND view_key=?", (observation_id, view_key))
        frontier = _advance(conn, source["source_key"], view_key)
        receipt = {"schema": "lararium.sensorium.owned-content-receipt.v1",
                   "observation_id": observation_id, "source_key": source["source_key"],
                   "revision_sha256": source["revision"],
                   "typed_receipt_sha256": source["typed_receipt_sha256"],
                   "source_frontier": source["frontier"], "semantic_frontier": frontier,
                   "view_key": view_key, "sensorium_root": str(sensorium_root),
                   "model": "minilm", "dimension": 384, "model_basis_sha256": basis,
                   "device_request": device, "device": effective, "providers": providers,
                   "blocks": len(rows), "semantic_sha256": semantic_sha,
                   "status": "landed"}
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--sensorium-root", type=Path, required=True)
    parser.add_argument("--observation", type=int, required=True)
    parser.add_argument("--model-state-root", type=Path, default=Path.home())
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    args = parser.parse_args()
    try:
        receipt = project_owned_content(args.state_root, args.sensorium_root,
                                        args.observation, model_state_root=args.model_state_root,
                                        device=args.device)
    except (OSError, sqlite3.Error, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
