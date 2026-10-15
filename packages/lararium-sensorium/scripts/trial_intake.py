#!/usr/bin/env python3
"""Trial custody ledger: frozen evidence -> one SQLite transaction under state.

This host-side slice owns raw evidence, observations, intake receipts and pending
projection intents. It never opens the native producer file or claims that a
content projection, live collector, or mounted product image has passed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Callable
from urllib.parse import quote

from trial_inventory import event_time


DB_NAME = "trial-intake-v2.sqlite3"
MAX_EVIDENCE_BYTES = 32 * 1024 * 1024  # first bounded chat slice; widen only after measuring
PARSER_VERSION = "claude-blocks-trial-v1"


class IntentConflict(ValueError):
    """One caller intent was already committed for different evidence or scope."""


SCHEMA = """
CREATE TABLE IF NOT EXISTS source (
    source_key TEXT PRIMARY KEY,
    surface TEXT NOT NULL,
    native_session_id TEXT NOT NULL,
    native_agent_id TEXT
);
CREATE TABLE IF NOT EXISTS revision (
    source_key TEXT NOT NULL REFERENCES source(source_key),
    sha256 TEXT NOT NULL,
    length INTEGER NOT NULL,
    evidence BLOB NOT NULL,
    PRIMARY KEY (source_key, sha256)
);
CREATE TABLE IF NOT EXISTS observation (
    observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_id TEXT NOT NULL UNIQUE,
    source_key TEXT NOT NULL,
    revision_sha256 TEXT NOT NULL,
    manifest_sha256 TEXT NOT NULL,
    frontier INTEGER NOT NULL,
    observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_key, revision_sha256) REFERENCES revision(source_key, sha256),
    UNIQUE (source_key, frontier)
);
CREATE TABLE IF NOT EXISTS source_manifest (
    observation_id INTEGER PRIMARY KEY REFERENCES observation(observation_id),
    manifest_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_receipt (
    intent_id TEXT PRIMARY KEY,
    observation_id INTEGER NOT NULL UNIQUE REFERENCES observation(observation_id),
    receipt_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_cursor (
    source_key TEXT PRIMARY KEY REFERENCES source(source_key),
    frontier INTEGER NOT NULL,
    observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
    cursor_kind TEXT NOT NULL CHECK (cursor_kind = 'frozen-evidence-observation')
);
CREATE TABLE IF NOT EXISTS projection_intent (
    observation_id INTEGER PRIMARY KEY REFERENCES observation(observation_id),
    parser_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'landed', 'quarantined'))
);
CREATE TABLE IF NOT EXISTS content_frontier (
    source_key TEXT PRIMARY KEY REFERENCES source(source_key),
    observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
    parser_version TEXT NOT NULL
);
"""


def _fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _connect(state_root: Path) -> sqlite3.Connection:
    state_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    db = state_root / DB_NAME
    first = not db.exists()
    conn = sqlite3.connect(db, timeout=5, isolation_level=None)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    mode = conn.execute("PRAGMA journal_mode=DELETE").fetchone()[0]
    if mode.lower() != "delete":
        conn.close()
        raise RuntimeError(f"unexpected SQLite journal mode: {mode}")
    conn.execute("PRAGMA synchronous=EXTRA")
    conn.executescript(SCHEMA)
    if first:
        _fsync_dir(state_root)
    return conn


def _canonical(value: dict) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _load_frozen(receipt_path: Path, source_host: str) -> tuple[dict, bytes, str, str, str | None, str, str]:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", source_host):
        raise ValueError("source_host must be one explicit stable host namespace")
    receipt_path = receipt_path.resolve()
    with receipt_path.open(encoding="utf-8") as handle:
        freeze = json.load(handle)
    if freeze.get("schema") != "lararium.sensorium.trial-freeze.claude.v1":
        raise ValueError("unsupported freeze receipt")
    if freeze.get("handoff_schema") is not None:
        if (freeze["handoff_schema"] != "lararium.sensorium.trial-handoff.v1"
                or freeze.get("source_host") != source_host):
            raise ValueError("handoff host namespace disagrees with intake")
        with (receipt_path.parent / "handoff-ready.json").open(encoding="utf-8") as handle:
            ready = json.load(handle)
        if (ready.get("schema") != freeze["handoff_schema"]
                or ready.get("source_host") != source_host
                or ready.get("evidence_sha256") != freeze.get("evidence_sha256")):
            raise ValueError("handoff is not ready for this evidence and host")
    evidence_locator = Path(freeze["evidence"])
    evidence = (receipt_path.parent / evidence_locator if not evidence_locator.is_absolute()
                else evidence_locator).resolve()
    if not evidence.is_relative_to(receipt_path.parent):
        raise ValueError("evidence must live beneath its private freeze receipt")
    if evidence.stat().st_size > MAX_EVIDENCE_BYTES:
        raise ValueError("frozen evidence exceeds the first-trial 32 MiB cap")
    raw = evidence.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if len(raw) != freeze["evidence_bytes"] or digest != freeze["evidence_sha256"]:
        raise ValueError("frozen evidence hash or length changed")
    if len(raw) > MAX_EVIDENCE_BYTES:
        raise ValueError("frozen evidence exceeds the first-trial 32 MiB cap")
    window = freeze["window"]
    start, end = event_time(window["start_inclusive"]), event_time(window["end_exclusive"])
    if start is None or end is None or start >= end:
        raise ValueError("invalid frozen event-time window")
    sessions: set[str] = set()
    agents: set[str] = set()
    counts: dict[str, int] = {}
    for line in raw.splitlines():
        row = json.loads(line)
        if not isinstance(row, dict):
            raise ValueError("non-object frozen JSONL row")
        when = event_time(row.get("timestamp"))
        if when is None or not start <= when < end:
            raise ValueError("frozen row lies outside the declared event-time window")
        if row.get("sessionId"):
            sessions.add(str(row["sessionId"]))
        if row.get("agentId"):
            agents.add(str(row["agentId"]))
        kind = str(row.get("type"))
        counts[kind] = counts.get(kind, 0) + 1
    if counts != freeze["rows_by_type"] or len(sessions) != 1 or len(agents) > 1:
        raise ValueError("frozen row counts or producer IDs disagree with receipt")
    session = next(iter(sessions))
    agent = next(iter(agents), None)
    native = Path(freeze["native_source"])
    if agent:
        if native.stem != f"agent-{agent}" or native.parent.name != "subagents" or native.parent.parent.name != session:
            raise ValueError("sub-agent producer IDs disagree with native locator")
        native_root = native.parents[3]
    elif native.stem != session:
        raise ValueError("main producer ID disagrees with native locator")
    else:
        native_root = native.parents[1]
    source_key = f"claude:{source_host}:{session}" + (f".{agent}" if agent else "")
    # Stage paths never enter retry identity. Native location remains provenance;
    # producer IDs, bytes, event window and source generation decide intent reuse.
    identity_manifest = {
        "source_key": source_key, "source_host": source_host,
        "revision_sha256": digest, "evidence_bytes": len(raw),
        "window": window, "native_size": freeze["native_size"],
        "native_mtime_ns": freeze["native_mtime_ns"],
        "rows_by_type": counts, "rows_without_event_time": freeze["rows_without_event_time"],
        "invalid_json": freeze["invalid_json"], "scope": freeze["scope"],
    }
    manifest_sha = hashlib.sha256(_canonical(identity_manifest).encode()).hexdigest()
    source_manifest = {**identity_manifest, "native_locator": str(native),
                       "native_root": str(native_root),
                       "frozen_evidence": str(evidence), "freeze_receipt": str(receipt_path)}
    return source_manifest, raw, source_key, session, agent, digest, manifest_sha


def intake_frozen(state_root: Path | str, receipt_path: Path | str, intent_id: str,
                  *, source_host: str,
                  cut_hook: Callable[[str], None] | None = None) -> dict:
    """Commit a frozen source observation, or return its previous exact receipt."""
    if not intent_id or not intent_id.strip() or len(intent_id) > 256:
        raise ValueError("intent_id must contain 1..256 non-space characters")
    state_root = Path(state_root).resolve()
    receipt_path = Path(receipt_path).resolve()
    manifest, raw, source_key, session, agent, digest, manifest_sha = _load_frozen(receipt_path, source_host)
    native_root = Path(manifest["native_root"]).resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if state_root.is_relative_to(native_root) or state_root.is_relative_to(repo_root):
        raise ValueError("trial state must stay outside native history and repository")
    conn = _connect(state_root)
    cut = cut_hook or (lambda _stage: None)
    try:
        conn.execute("BEGIN IMMEDIATE")
        prior = conn.execute(
            "SELECT o.source_key,o.revision_sha256,o.manifest_sha256,r.receipt_json "
            "FROM observation o JOIN intake_receipt r USING(intent_id) WHERE o.intent_id=?",
            (intent_id,),
        ).fetchone()
        if prior:
            if prior[:3] != (source_key, digest, manifest_sha):
                raise IntentConflict("intent already committed for different source evidence or scope")
            _verified_stored(conn, source_key, digest, len(raw))
            conn.execute("COMMIT")
            return json.loads(prior[3])
        conn.execute("INSERT OR IGNORE INTO source VALUES (?,?,?,?)", (source_key, "claude", session, agent))
        conn.execute("INSERT OR IGNORE INTO revision VALUES (?,?,?,?)",
                     (source_key, digest, len(raw), sqlite3.Binary(raw)))
        _verified_stored(conn, source_key, digest, len(raw))
        cut("after_evidence")
        previous = conn.execute("SELECT frontier FROM intake_cursor WHERE source_key=?",
                                (source_key,)).fetchone()
        frontier = (previous[0] if previous else 0) + 1
        obs = conn.execute(
            "INSERT INTO observation(intent_id,source_key,revision_sha256,manifest_sha256,frontier) "
            "VALUES (?,?,?,?,?)", (intent_id, source_key, digest, manifest_sha, frontier),
        ).lastrowid
        conn.execute("INSERT INTO source_manifest VALUES (?,?)", (obs, _canonical(manifest)))
        cut("after_manifest")
        conn.execute("INSERT INTO intake_cursor VALUES (?,?,?,'frozen-evidence-observation') "
                     "ON CONFLICT(source_key) DO UPDATE SET frontier=excluded.frontier, "
                     "observation_id=excluded.observation_id", (source_key, frontier, obs))
        conn.execute("INSERT INTO projection_intent VALUES (?,?,'pending')", (obs, PARSER_VERSION))
        receipt = {"schema": "lararium.sensorium.trial-intake-receipt.v2",
                   "intent_id": intent_id, "source_key": source_key,
                   "revision_sha256": digest, "evidence_bytes": len(raw),
                   "manifest_sha256": manifest_sha, "observation_id": obs,
                   "frontier": frontier, "cursor_kind": "frozen-evidence-observation"}
        conn.execute("INSERT INTO intake_receipt VALUES (?,?,?)",
                     (intent_id, obs, _canonical(receipt)))
        cut("after_receipt")
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


def _read_connection(state_root: Path | str) -> sqlite3.Connection | None:
    db = Path(state_root) / DB_NAME
    if not db.is_file():
        return None
    return sqlite3.connect(f"file:{quote(str(db.resolve()))}?mode=ro", uri=True)


def _verified_stored(conn: sqlite3.Connection, source_key: str, digest: str,
                     expected_length: int | None = None) -> bytes:
    row = conn.execute("SELECT length,evidence FROM revision WHERE source_key=? AND sha256=?",
                       (source_key, digest)).fetchone()
    if row is None or row[0] != len(row[1]) or (expected_length is not None and row[0] != expected_length):
        raise ValueError("stored evidence length disagrees with revision")
    if hashlib.sha256(row[1]).hexdigest() != digest:
        raise ValueError("stored evidence hash disagrees with revision")
    return row[1]


def intake_status(state_root: Path | str) -> dict:
    empty = {"sources": 0, "revisions": 0, "observations": 0,
             "source_manifests": 0, "receipts": 0, "projection_pending": 0,
             "source_frontiers": {}, "content_frontiers": {}}
    conn = _read_connection(state_root)
    if conn is None:
        return empty
    try:
        for key, table in (("sources", "source"), ("revisions", "revision"),
                           ("observations", "observation"), ("source_manifests", "source_manifest"),
                           ("receipts", "intake_receipt")):
            empty[key] = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        empty["projection_pending"] = conn.execute(
            "SELECT count(*) FROM projection_intent WHERE status='pending'").fetchone()[0]
        empty["source_frontiers"] = dict(conn.execute("SELECT source_key,frontier FROM intake_cursor"))
        empty["content_frontiers"] = dict(conn.execute("SELECT source_key,observation_id FROM content_frontier"))
        return empty
    finally:
        conn.close()


def read_evidence(state_root: Path | str, source_key: str, revision_sha256: str) -> bytes | None:
    conn = _read_connection(state_root)
    if conn is None:
        return None
    try:
        exists = conn.execute("SELECT 1 FROM revision WHERE source_key=? AND sha256=?",
                              (source_key, revision_sha256)).fetchone()
        return _verified_stored(conn, source_key, revision_sha256) if exists else None
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--freeze-receipt", type=Path, required=True)
    parser.add_argument("--intent", required=True)
    parser.add_argument("--source-host", required=True, help="stable execution-host namespace")
    args = parser.parse_args()
    try:
        receipt = intake_frozen(args.state_root, args.freeze_receipt, args.intent,
                                source_host=args.source_host)
    except (OSError, sqlite3.Error, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
