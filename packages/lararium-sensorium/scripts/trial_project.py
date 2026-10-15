#!/usr/bin/env python3
"""Project committed Claude evidence into versioned verbatim blocks and a content frontier."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sqlite3
from pathlib import Path
from typing import Callable

from capture_sources import _blocks, _parse_claude_lines
from trial_intake import PARSER_VERSION, _canonical, _connect, _verified_stored


def _block_cid(source_key: str, revision: str, index: int) -> str:
    address = _canonical({"source": source_key, "revision": revision,
                          "parser": PARSER_VERSION, "locator": index})
    return hashlib.sha256(address.encode()).hexdigest()


def _content_digest(rows: list[tuple[str, str, str]]) -> str:
    return hashlib.sha256(_canonical({"blocks": rows}).encode()).hexdigest()


def _advance_frontier(conn: sqlite3.Connection, source_key: str) -> int:
    rows = conn.execute(
        "SELECT o.frontier,o.observation_id,p.status,p.parser_version "
        "FROM observation o JOIN projection_intent p USING(observation_id) "
        "WHERE o.source_key=? ORDER BY o.frontier", (source_key,)
    ).fetchall()
    reached = 0
    reached_observation = None
    for frontier, observation_id, status, parser_version in rows:
        if frontier != reached + 1 or status != "landed" or parser_version != PARSER_VERSION:
            break
        reached, reached_observation = frontier, observation_id
    if reached_observation is not None:
        conn.execute("INSERT INTO content_frontier VALUES (?,?,?) "
                     "ON CONFLICT(source_key) DO UPDATE SET observation_id=excluded.observation_id, "
                     "parser_version=excluded.parser_version",
                     (source_key, reached_observation, PARSER_VERSION))
    return reached


def _verify_landed(conn: sqlite3.Connection, observation_id: int, receipt: dict) -> None:
    rows = conn.execute(
        "SELECT t.cid,t.text,t.metadata_json FROM projection_block b "
        "JOIN typed_content t ON t.cid=b.cid WHERE b.observation_id=? ORDER BY b.block_index",
        (observation_id,),
    ).fetchall()
    if len(rows) != receipt["typed_blocks"] or _content_digest(rows) != receipt["content_sha256"]:
        raise ValueError("stored typed content disagrees with projection receipt")


def project_observation(state_root: Path | str, observation_id: int,
                        *, cut_hook: Callable[[str], None] | None = None) -> dict:
    """Commit all blocks and the eligible contiguous frontier in one local SQLite transaction."""
    if observation_id < 1:
        raise ValueError("observation_id must be positive")
    conn = _connect(Path(state_root).resolve())
    cut = cut_hook or (lambda _stage: None)
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT o.source_key,o.revision_sha256,o.frontier,p.parser_version,p.status,s.native_agent_id "
            "FROM observation o JOIN projection_intent p USING(observation_id) "
            "JOIN source s ON s.source_key=o.source_key WHERE o.observation_id=?",
            (observation_id,),
        ).fetchone()
        if row is None:
            raise ValueError("observation has no pending projection intent")
        source_key, revision, source_frontier, parser_version, status, agent_id = row
        if parser_version != PARSER_VERSION:
            raise ValueError("projection intent uses a different parser version")
        raw = _verified_stored(conn, source_key, revision)
        if status in ("landed", "quarantined"):
            saved = conn.execute("SELECT receipt_json FROM projection_receipt WHERE observation_id=?",
                                 (observation_id,)).fetchone()
            if saved is None:
                raise ValueError("projection disposition has no receipt")
            receipt = json.loads(saved[0])
            if status == "landed":
                _verify_landed(conn, observation_id, receipt)
            conn.execute("COMMIT")
            return receipt

        try:
            stats: dict = {}
            parsed = _parse_claude_lines(io.StringIO(raw.decode("utf-8", errors="replace")),
                                         stats=stats)
            if stats.get("invalid_json", 0) or stats.get("non_object_rows", 0):
                raise ValueError("committed evidence contains malformed or non-object rows")
            extra = {"lar_surface": "claude"}
            if agent_id:
                extra.update({"lar_sidechain": 1, "lar_agent": agent_id})
            blocks = list(_blocks(source_key, parsed, wing="trial", room="conversations", extra=extra))
        except (TypeError, ValueError, UnicodeError) as exc:
            receipt = {"schema": "lararium.sensorium.trial-projection-receipt.v1",
                       "observation_id": observation_id, "source_key": source_key,
                       "parser_version": PARSER_VERSION, "status": "quarantined",
                       "reason": f"{type(exc).__name__}: {exc}"}
            conn.execute("UPDATE projection_intent SET status='quarantined' WHERE observation_id=?",
                         (observation_id,))
            conn.execute("INSERT INTO projection_receipt VALUES (?,?)",
                         (observation_id, _canonical(receipt)))
            conn.execute("COMMIT")
            return receipt

        kept: list[tuple[str, str, str]] = []
        for index, (_old_cid, text, metadata) in enumerate(blocks):
            cid = _block_cid(source_key, revision, index)
            meta_json = _canonical(metadata)
            expected = (cid, text, meta_json)
            conn.execute("INSERT OR IGNORE INTO typed_content "
                         "(cid,source_key,revision_sha256,parser_version,block_index,text,metadata_json) "
                         "VALUES (?,?,?,?,?,?,?)",
                         (cid, source_key, revision, PARSER_VERSION, index, text, meta_json))
            held = conn.execute("SELECT cid,text,metadata_json FROM typed_content WHERE cid=?",
                                (cid,)).fetchone()
            if held != expected:
                raise ValueError("typed block address already holds different content")
            conn.execute("INSERT INTO projection_block VALUES (?,?,?)", (observation_id, index, cid))
            kept.append(expected)
        cut("after_blocks")
        conn.execute("UPDATE projection_intent SET status='landed' WHERE observation_id=?",
                     (observation_id,))
        reached = _advance_frontier(conn, source_key)
        receipt = {"schema": "lararium.sensorium.trial-projection-receipt.v1",
                   "observation_id": observation_id, "source_key": source_key,
                   "revision_sha256": revision, "parser_version": PARSER_VERSION,
                   "source_frontier": source_frontier, "content_frontier": reached,
                   "typed_blocks": len(kept), "source_rows": stats.get("source_rows", 0),
                   "eligible_rows": stats.get("eligible_rows", 0),
                   "unprojected_eligible_rows": stats.get("unprojected_eligible_rows", 0),
                   "unprojected_shapes": stats.get("unprojected_shapes", {}),
                   "content_sha256": _content_digest(kept),
                   "status": "landed"}
        conn.execute("INSERT INTO projection_receipt VALUES (?,?)",
                     (observation_id, _canonical(receipt)))
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
    parser.add_argument("--observation", type=int, required=True)
    args = parser.parse_args()
    try:
        receipt = project_observation(args.state_root, args.observation)
    except (OSError, sqlite3.Error, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
