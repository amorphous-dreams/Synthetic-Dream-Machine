#!/usr/bin/env python3
"""Freeze, take custody of, and type one complete book witness.

The book ledger deliberately stands apart from the Claude trial ledger: a book
has a work, edition, and digital witness, with no session, agent, or event-time
window. Its typed row columns and occurrence addresses form an explicit future
import seam; this trial does not claim an owned Content or li projection.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Callable
from urllib.parse import quote


DB_NAME = "book-trial-v1.sqlite3"
PARSER_VERSION = "book-lines-v1"
MAX_EVIDENCE_BYTES = 32 * 1024 * 1024
MAX_LINE_BYTES = 4096
_BOOK_OPEN = re.compile(rb"^\s*<<~\s*ahu\s+#source-text\b")
_AHU_OPEN = re.compile(rb"^\s*<<~\s*ahu\b")
_AHU_CLOSE = re.compile(rb"^\s*<<~/ahu\b")
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CATALOG_PATHS: dict[str, Path] = {
    "library:kumulipo": _REPO_ROOT / "bags/lares/ha.ka.ba/lares/library/kumulipo.mem",
}


class IntentConflict(ValueError):
    """A caller reused one intent for a different book, revision, or scope."""


SCHEMA = """
CREATE TABLE IF NOT EXISTS book_source (
    source_key TEXT PRIMARY KEY,
    stable_descriptor_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revision (
    source_key TEXT NOT NULL REFERENCES book_source(source_key),
    sha256 TEXT NOT NULL,
    length INTEGER NOT NULL,
    evidence BLOB NOT NULL,
    PRIMARY KEY (source_key,sha256)
);
CREATE TABLE IF NOT EXISTS observation (
    observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_id TEXT NOT NULL UNIQUE,
    source_key TEXT NOT NULL,
    revision_sha256 TEXT NOT NULL,
    manifest_sha256 TEXT NOT NULL,
    frontier INTEGER NOT NULL,
    observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_key,revision_sha256) REFERENCES revision(source_key,sha256),
    UNIQUE (source_key,frontier)
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
CREATE TABLE IF NOT EXISTS projection_intent (
    observation_id INTEGER PRIMARY KEY REFERENCES observation(observation_id),
    parser_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','landed','quarantined'))
);
CREATE TABLE IF NOT EXISTS typed_content (
    cid TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    revision_sha256 TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    block_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    FOREIGN KEY (source_key,revision_sha256) REFERENCES revision(source_key,sha256),
    UNIQUE (source_key,revision_sha256,parser_version,block_index)
);
CREATE TABLE IF NOT EXISTS projection_block (
    observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
    block_index INTEGER NOT NULL,
    cid TEXT NOT NULL REFERENCES typed_content(cid),
    PRIMARY KEY (observation_id,block_index)
);
CREATE TABLE IF NOT EXISTS projection_receipt (
    observation_id INTEGER PRIMARY KEY REFERENCES observation(observation_id),
    receipt_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content_frontier (
    source_key TEXT PRIMARY KEY REFERENCES book_source(source_key),
    observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
    parser_version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS semantic_projection (
    observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
    view_key TEXT NOT NULL,
    sensorium_root TEXT NOT NULL,
    model_basis_sha256 TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','landed')),
    receipt_json TEXT,
    PRIMARY KEY (observation_id,view_key)
);
CREATE TABLE IF NOT EXISTS semantic_frontier (
    source_key TEXT NOT NULL REFERENCES book_source(source_key),
    view_key TEXT NOT NULL,
    frontier INTEGER NOT NULL,
    observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
    PRIMARY KEY (source_key,view_key)
);
CREATE TABLE IF NOT EXISTS li_parse (
    parser_identity_sha256 TEXT NOT NULL,
    occurrence_id TEXT NOT NULL REFERENCES typed_content(cid),
    text_sha256 TEXT NOT NULL,
    shape_sha256 TEXT NOT NULL,
    tree_json TEXT NOT NULL,
    parser_tier TEXT NOT NULL,
    PRIMARY KEY (parser_identity_sha256,occurrence_id)
);
CREATE TABLE IF NOT EXISTS li_basis (
    basis_sha256 TEXT PRIMARY KEY,
    corpus_sha256 TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    receipt_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS li_shape (
    basis_sha256 TEXT NOT NULL REFERENCES li_basis(basis_sha256),
    occurrence_id TEXT NOT NULL REFERENCES typed_content(cid),
    shape_sha256 TEXT NOT NULL,
    tree_json TEXT NOT NULL,
    parser_tier TEXT NOT NULL,
    PRIMARY KEY (basis_sha256,occurrence_id)
);
CREATE TABLE IF NOT EXISTS li_idiom (
    basis_sha256 TEXT NOT NULL REFERENCES li_basis(basis_sha256),
    occurrence_id TEXT NOT NULL REFERENCES typed_content(cid),
    membership_json TEXT NOT NULL,
    PRIMARY KEY (basis_sha256,occurrence_id)
);
"""


def _canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _exclusive_bytes(path: Path, raw: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def _connect(state_root: Path) -> sqlite3.Connection:
    state_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    db = state_root / DB_NAME
    first = not db.exists()
    conn = sqlite3.connect(db, timeout=5, isolation_level=None)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    if conn.execute("PRAGMA journal_mode=DELETE").fetchone()[0].lower() != "delete":
        conn.close()
        raise RuntimeError("unexpected SQLite journal mode")
    conn.execute("PRAGMA synchronous=EXTRA")
    conn.executescript(SCHEMA)
    if first:
        _fsync_dir(state_root)
    return conn


def _descriptor(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    return _validate_descriptor(value)


def _validate_descriptor(value: object) -> dict:
    if not isinstance(value, dict) or value.get("schema") != "lararium.sensorium.book-source.v1":
        raise ValueError("unsupported book source descriptor")
    for key in ("source_key", "collection", "work"):
        if not isinstance(value.get(key), str) or not value[key].strip():
            raise ValueError(f"book descriptor needs {key}")
    if not re.fullmatch(r"book:[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}", value["source_key"]):
        raise ValueError("book source key must name a stable book witness")
    for key, fields in (("producer", ("attributed_chant", "translator", "digital_redactor")),
                        ("edition", ("title", "publisher", "place", "year")),
                        ("witness", ("locator", "kind", "digital_source", "retrieved",
                                     "expected_bytes", "sha256", "ni")),
                        ("rights", ("status", "evidence"))):
        part = value.get(key)
        if not isinstance(part, dict) or any(field not in part for field in fields):
            raise ValueError(f"book descriptor needs {key} fields")
    witness = value["witness"]
    if (not isinstance(witness["expected_bytes"], int) or witness["expected_bytes"] < 1
            or witness["expected_bytes"] > MAX_EVIDENCE_BYTES):
        raise ValueError("book witness length exceeds bounded trial")
    digest = witness["sha256"]
    if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("book witness needs exact SHA-256")
    expected_ni = base64.urlsafe_b64encode(bytes.fromhex(digest)).decode().rstrip("=")
    if witness["ni"] != f"ni:///sha-256;{expected_ni}":
        raise ValueError("book NI anchor disagrees with SHA-256")
    if not isinstance(witness["locator"], str) or not witness["locator"].startswith("library:"):
        raise ValueError("book locator must name the portable library witness")
    for part in (value["producer"], value["edition"], witness, value["rights"]):
        if any(not isinstance(v, str) or not v.strip() for v in part.values() if not isinstance(v, int)):
            raise ValueError("book descriptor fields must carry nonempty values")
    return value


def _stable_descriptor(descriptor: dict) -> dict:
    """Bind one edition/witness identity while leaving exact bytes as revisions."""
    stable = json.loads(_canonical(descriptor))
    for key in ("expected_bytes", "sha256", "ni"):
        stable["witness"].pop(key)
    return stable


def _verify_catalog_anchor(descriptor: dict) -> None:
    """Compare the declared witness to a tracked collection index, not itself."""
    collection = descriptor["collection"]
    catalog = _CATALOG_PATHS.get(collection)
    if catalog is None:
        raise ValueError("book collection has no trusted catalog anchor")
    locator = descriptor["witness"]["locator"]
    prefix = collection + "/"
    if not locator.startswith(prefix):
        raise ValueError("book witness locator disagrees with collection")
    filename = locator[len(prefix):]
    if not filename or "/" in filename or filename in (".", ".."):
        raise ValueError("book witness locator needs one catalog filename")
    matches = []
    for line in catalog.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip().strip("`") for cell in line.strip().strip("|").split("|")]
        if len(cells) >= 3 and cells[0] == filename:
            matches.append(cells)
    if len(matches) != 1:
        raise ValueError("book witness needs exactly one catalog anchor row")
    try:
        indexed_bytes = int(matches[0][1])
    except ValueError as exc:
        raise ValueError("book catalog has an invalid byte count") from exc
    witness = descriptor["witness"]
    if indexed_bytes != witness["expected_bytes"] or matches[0][2] != witness["ni"]:
        raise ValueError("book witness disagrees with independent catalog anchor")


def freeze_book(source_path: Path | str, descriptor_path: Path | str,
                trial_root: Path | str) -> dict:
    """Verify a read-only native witness, then copy exact bytes into a new private root."""
    source = Path(source_path).resolve()
    descriptor = _descriptor(Path(descriptor_path).resolve())
    _verify_catalog_anchor(descriptor)
    root = Path(trial_root).resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if (root.is_relative_to(repo_root) or root.is_relative_to(source.parent)
            or source.parent.is_relative_to(root)):
        raise ValueError("book trial root must stay outside repository and native source")
    if root.exists():
        raise FileExistsError("book trial root must be new")
    raw = source.read_bytes()
    digest = _sha(raw)
    witness = descriptor["witness"]
    if len(raw) != witness["expected_bytes"] or digest != witness["sha256"]:
        raise ValueError("native book bytes disagree with declared library witness")
    root.mkdir(mode=0o700)
    evidence_dir = root / "evidence"
    evidence_dir.mkdir(mode=0o700)
    _exclusive_bytes(evidence_dir / "book.mem", raw)
    _fsync_dir(evidence_dir)
    receipt = {"schema": "lararium.sensorium.trial-freeze.book.v1",
               "descriptor": descriptor, "evidence": "evidence/book.mem",
               "evidence_bytes": len(raw), "evidence_sha256": digest,
               "observed_native_path": str(source),
               "freeze_receipt": str(root / "freeze-receipt.json"),
               "scope": "complete stored carrier bytes; one named digital witness"}
    _exclusive_bytes(root / "freeze-receipt.json", (_canonical(receipt) + "\n").encode())
    _fsync_dir(root)
    return receipt


def _load_frozen(receipt_path: Path) -> tuple[dict, bytes, dict]:
    with receipt_path.open(encoding="utf-8") as handle:
        freeze = json.load(handle)
    if freeze.get("schema") != "lararium.sensorium.trial-freeze.book.v1":
        raise ValueError("unsupported frozen book receipt")
    descriptor = _validate_descriptor(freeze.get("descriptor"))
    _verify_catalog_anchor(descriptor)
    native_value = freeze.get("observed_native_path")
    if (not isinstance(native_value, str) or not native_value
            or not Path(native_value).is_absolute() or ".." in Path(native_value).parts):
        raise ValueError("frozen book needs an absolute observed native locator")
    locator = Path(freeze["evidence"])
    if locator.is_absolute() or ".." in locator.parts:
        raise ValueError("book evidence locator must stay relative")
    evidence = (receipt_path.parent / locator).resolve()
    if not evidence.is_relative_to(receipt_path.parent.resolve()):
        raise ValueError("book evidence escapes freeze root")
    raw = evidence.read_bytes()
    digest = _sha(raw)
    if (len(raw) > MAX_EVIDENCE_BYTES or len(raw) != freeze["evidence_bytes"]
            or digest != freeze["evidence_sha256"]
            or len(raw) != descriptor["witness"]["expected_bytes"]
            or digest != descriptor["witness"]["sha256"]):
        raise ValueError("frozen book hash or length changed")
    manifest = {"schema": "lararium.sensorium.book-observation-manifest.v1",
                "descriptor": descriptor, "revision_sha256": digest,
                "evidence_bytes": len(raw), "scope": freeze["scope"]}
    return manifest, raw, freeze


def _verified_stored(conn: sqlite3.Connection, source_key: str, digest: str) -> bytes:
    row = conn.execute("SELECT length,evidence FROM revision WHERE source_key=? AND sha256=?",
                       (source_key, digest)).fetchone()
    if row is None or row[0] != len(row[1]) or _sha(row[1]) != digest:
        raise ValueError("stored book evidence disagrees with revision")
    return row[1]


def intake_book(state_root: Path | str, freeze_receipt: Path | str, intent_id: str,
                cut_hook: Callable[[str], None] | None = None) -> dict:
    """Commit one frozen book observation; exact intent replay returns its receipt."""
    if not intent_id or not intent_id.strip() or len(intent_id) > 256:
        raise ValueError("intent_id must contain 1..256 non-space characters")
    state = Path(state_root).resolve()
    receipt_path = Path(freeze_receipt).resolve()
    manifest, raw, freeze = _load_frozen(receipt_path)
    source_key = manifest["descriptor"]["source_key"]
    digest = manifest["revision_sha256"]
    manifest_sha = _sha(_canonical(manifest).encode())
    repo_root = Path(__file__).resolve().parents[3]
    native_dir = Path(freeze["observed_native_path"]).resolve().parent
    if (state.is_relative_to(repo_root) or state.is_relative_to(receipt_path.parent)
            or state.is_relative_to(native_dir) or native_dir.is_relative_to(state)):
        raise ValueError("book trial state must stay outside repository, freeze and native roots")
    conn = _connect(state)
    cut = cut_hook or (lambda _stage: None)
    try:
        conn.execute("BEGIN IMMEDIATE")
        previous = conn.execute(
            "SELECT o.source_key,o.revision_sha256,o.manifest_sha256,r.receipt_json "
            "FROM observation o JOIN intake_receipt r USING(intent_id) WHERE o.intent_id=?",
            (intent_id,),
        ).fetchone()
        if previous:
            if previous[:3] != (source_key, digest, manifest_sha):
                raise IntentConflict("intent already committed for different book evidence or scope")
            _verified_stored(conn, source_key, digest)
            conn.execute("COMMIT")
            return json.loads(previous[3])
        stable = _canonical(_stable_descriptor(manifest["descriptor"]))
        conn.execute("INSERT OR IGNORE INTO book_source VALUES (?,?)", (source_key, stable))
        held_source = conn.execute("SELECT stable_descriptor_json FROM book_source WHERE source_key=?",
                                   (source_key,)).fetchone()
        if held_source != (stable,):
            raise ValueError("book source key already names a different edition or witness")
        conn.execute("INSERT OR IGNORE INTO revision VALUES (?,?,?,?)",
                     (source_key, digest, len(raw), sqlite3.Binary(raw)))
        _verified_stored(conn, source_key, digest)
        cut("after_evidence")
        frontier = conn.execute("SELECT coalesce(max(frontier),0)+1 FROM observation WHERE source_key=?",
                                (source_key,)).fetchone()[0]
        obs = conn.execute(
            "INSERT INTO observation(intent_id,source_key,revision_sha256,manifest_sha256,frontier) "
            "VALUES (?,?,?,?,?)", (intent_id, source_key, digest, manifest_sha, frontier),
        ).lastrowid
        conn.execute("INSERT INTO source_manifest VALUES (?,?)", (obs, _canonical(manifest)))
        cut("after_manifest")
        conn.execute("INSERT INTO projection_intent VALUES (?,?,'pending')", (obs, PARSER_VERSION))
        receipt = {"schema": "lararium.sensorium.book-intake-receipt.v1",
                   "intent_id": intent_id, "source_key": source_key,
                   "revision_sha256": digest, "evidence_bytes": len(raw),
                   "manifest_sha256": manifest_sha, "observation_id": obs,
                   "frontier": frontier, "cursor_kind": "frozen-book-observation",
                   "observed_native_path": freeze["observed_native_path"],
                   "freeze_root": str(receipt_path.parent),
                   "edition": manifest["descriptor"]["edition"],
                   "witness_locator": manifest["descriptor"]["witness"]["locator"]}
        conn.execute("INSERT INTO intake_receipt VALUES (?,?,?)",
                     (intent_id, obs, _canonical(receipt)))
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


def _book_text_lines(lines: list[bytes]) -> set[int]:
    """Find literary lines inside the single source-text ahu, after its TOML fence."""
    openings = [i for i, line in enumerate(lines) if _BOOK_OPEN.match(line)]
    if len(openings) != 1:
        raise ValueError("book carrier needs exactly one #source-text opening")
    opening = openings[0]
    depth = 1
    closing = None
    for i in range(opening + 1, len(lines)):
        if _AHU_OPEN.match(lines[i]):
            depth += 1
        elif _AHU_CLOSE.match(lines[i]):
            depth -= 1
            if depth == 0:
                closing = i
                break
    if closing is None:
        raise ValueError("book carrier has no balanced #source-text close")
    begin = opening + 1
    while begin < closing and not lines[begin].strip():
        begin += 1
    if begin < closing and lines[begin].startswith(b"```toml"):
        for i in range(begin + 1, closing):
            if lines[i].startswith(b"```"):
                begin = i + 1
                break
        else:
            raise ValueError("book source-text metadata fence is unclosed")
    while begin < closing and not lines[begin].strip():
        begin += 1
    if begin >= closing:
        raise ValueError("book source-text has no literary body")
    return set(range(begin, closing))


def _typed_blocks(raw: bytes, source_key: str, revision: str) -> list[tuple[str, str, str, int, int, str]]:
    lines = raw.splitlines(keepends=True)
    if not lines or b"".join(lines) != raw:
        raise ValueError("book line split did not cover exact bytes")
    if any(len(line) > MAX_LINE_BYTES for line in lines):
        raise ValueError("book physical line exceeds 4096-byte parser ceiling")
    # Decode the complete witness strictly before any typed row can land.
    raw.decode("utf-8")
    body_lines = _book_text_lines(lines)
    starts = []
    offset = 0
    for line in lines:
        starts.append(offset)
        offset += len(line)
    out: list[tuple[str, str, str, int, int, str]] = []
    chunk: list[bytes] = []
    chunk_start = 0
    chunk_region = "carrier-envelope"
    chunk_section = "before-first-heading"
    current_section = "before-first-heading"

    def flush() -> None:
        nonlocal chunk, chunk_start
        if not chunk:
            return
        part = b"".join(chunk)
        index = len(out)
        cid = _sha(_canonical({"source": source_key, "revision": revision,
                               "parser": PARSER_VERSION, "locator": index,
                               "byte_start": chunk_start, "byte_length": len(part)}).encode())
        meta = {"lar_surface": "book", "lar_kind": "memetic-wikitext",
                "lar_book_region": chunk_region, "lar_book_section": chunk_section,
                "lar_source_byte_start": chunk_start,
                "lar_source_byte_length": len(part),
                "lar_source_span_sha256": _sha(part)}
        out.append((cid, part.decode("utf-8"), _canonical(meta), chunk_start,
                    len(part), chunk_region))
        chunk = []

    for i, line in enumerate(lines):
        region = "book-text" if i in body_lines else "carrier-envelope"
        heading = line.decode("utf-8").strip() if region == "book-text" and line.startswith(b"## ") else None
        if heading:
            current_section = heading
        if chunk and (region != chunk_region or heading is not None
                      or sum(map(len, chunk)) + len(line) > MAX_LINE_BYTES):
            flush()
        if not chunk:
            chunk_start = starts[i]
            chunk_region = region
            chunk_section = current_section if region == "book-text" else "carrier-envelope"
        chunk.append(line)
    flush()
    if sum(length for _, _, _, _, length, _ in out) != len(raw):
        raise ValueError("typed book spans do not cover complete evidence")
    return out


def _content_digest(rows: list[tuple[str, str, str]]) -> str:
    return _sha(_canonical({"blocks": rows}).encode())


def _verify_landed(conn: sqlite3.Connection, observation_id: int, receipt: dict,
                   raw: bytes) -> None:
    rows = conn.execute(
        "SELECT t.cid,t.text,t.metadata_json FROM projection_block b "
        "JOIN typed_content t ON t.cid=b.cid WHERE b.observation_id=? ORDER BY b.block_index",
        (observation_id,),
    ).fetchall()
    cursor = 0
    for _cid, text, meta_json in rows:
        meta = json.loads(meta_json)
        start, length = meta["lar_source_byte_start"], meta["lar_source_byte_length"]
        if (start != cursor or length < 1 or start + length > len(raw)
                or raw[start:start + length].decode("utf-8") != text
                or _sha(raw[start:start + length]) != meta["lar_source_span_sha256"]):
            raise ValueError("stored typed book span disagrees with raw evidence")
        cursor += length
    if (len(rows) != receipt["typed_blocks"] or _content_digest(rows) != receipt["content_sha256"]
            or cursor != receipt["covered_bytes"] or cursor != len(raw)):
        raise ValueError("stored typed book rows disagree with projection receipt")


def _advance_frontier(conn: sqlite3.Connection, source_key: str) -> int:
    rows = conn.execute(
        "SELECT o.frontier,o.observation_id,p.status,p.parser_version FROM observation o "
        "JOIN projection_intent p USING(observation_id) WHERE o.source_key=? ORDER BY o.frontier",
        (source_key,),
    ).fetchall()
    reached = 0
    last = None
    for frontier, obs, status, parser in rows:
        if frontier != reached + 1 or status != "landed" or parser != PARSER_VERSION:
            break
        reached, last = frontier, obs
    if last is not None:
        conn.execute("INSERT INTO content_frontier VALUES (?,?,?) "
                     "ON CONFLICT(source_key) DO UPDATE SET observation_id=excluded.observation_id, "
                     "parser_version=excluded.parser_version",
                     (source_key, last, PARSER_VERSION))
    return reached


def project_book(state_root: Path | str, observation_id: int,
                 cut_hook: Callable[[str], None] | None = None) -> dict:
    """Type exact BLOB byte spans and one projection receipt in a single transaction."""
    if observation_id < 1:
        raise ValueError("observation_id must be positive")
    state = Path(state_root).resolve()
    if not (state / DB_NAME).is_file():
        raise ValueError("book observation has no intake ledger")
    conn = _connect(state)
    cut = cut_hook or (lambda _stage: None)
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT o.source_key,o.revision_sha256,o.frontier,p.parser_version,p.status "
            "FROM observation o JOIN projection_intent p USING(observation_id) "
            "WHERE o.observation_id=?", (observation_id,),
        ).fetchone()
        if row is None:
            raise ValueError("book observation has no projection intent")
        source_key, revision, source_frontier, parser, status = row
        if parser != PARSER_VERSION:
            raise ValueError("book projection uses a different parser version")
        raw = _verified_stored(conn, source_key, revision)
        if status in ("landed", "quarantined"):
            saved = conn.execute("SELECT receipt_json FROM projection_receipt WHERE observation_id=?",
                                 (observation_id,)).fetchone()
            if saved is None:
                raise ValueError("book projection disposition has no receipt")
            receipt = json.loads(saved[0])
            if status == "landed":
                _verify_landed(conn, observation_id, receipt, raw)
            conn.execute("COMMIT")
            return receipt
        try:
            blocks = _typed_blocks(raw, source_key, revision)
        except (UnicodeError, ValueError) as exc:
            receipt = {"schema": "lararium.sensorium.book-projection-receipt.v1",
                       "observation_id": observation_id, "source_key": source_key,
                       "revision_sha256": revision, "parser_version": PARSER_VERSION,
                       "status": "quarantined", "typed_blocks": 0,
                       "covered_bytes": 0, "region_blocks": {},
                       "reason": f"{type(exc).__name__}: {exc}"}
            conn.execute("UPDATE projection_intent SET status='quarantined' WHERE observation_id=?",
                         (observation_id,))
            conn.execute("INSERT INTO projection_receipt VALUES (?,?)",
                         (observation_id, _canonical(receipt)))
            conn.execute("COMMIT")
            return receipt
        kept: list[tuple[str, str, str]] = []
        regions: dict[str, int] = {}
        for index, (cid, text, meta, _start, _length, region) in enumerate(blocks):
            expected = (cid, text, meta)
            conn.execute("INSERT OR IGNORE INTO typed_content VALUES (?,?,?,?,?,?,?)",
                         (cid, source_key, revision, PARSER_VERSION, index, text, meta))
            held = conn.execute("SELECT cid,text,metadata_json FROM typed_content WHERE cid=?",
                                (cid,)).fetchone()
            if held != expected:
                raise ValueError("typed book address already holds different content")
            conn.execute("INSERT INTO projection_block VALUES (?,?,?)", (observation_id, index, cid))
            kept.append(expected)
            regions[region] = regions.get(region, 0) + 1
        cut("after_blocks")
        conn.execute("UPDATE projection_intent SET status='landed' WHERE observation_id=?",
                     (observation_id,))
        reached = _advance_frontier(conn, source_key)
        receipt = {"schema": "lararium.sensorium.book-projection-receipt.v1",
                   "observation_id": observation_id, "source_key": source_key,
                   "revision_sha256": revision, "parser_version": PARSER_VERSION,
                   "source_frontier": source_frontier, "content_frontier": reached,
                   "typed_blocks": len(kept), "covered_bytes": len(raw),
                   "content_sha256": _content_digest(kept), "region_blocks": regions,
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


def read_book_occurrences(state_root: Path | str, observation_id: int) -> list[dict]:
    """Return verified typed rows in the shared occurrence-row shape for future import."""
    db = Path(state_root).resolve() / DB_NAME
    conn = sqlite3.connect(f"file:{quote(str(db.resolve()))}?mode=ro", uri=True)
    try:
        saved = conn.execute("SELECT receipt_json FROM projection_receipt WHERE observation_id=?",
                             (observation_id,)).fetchone()
        if saved is None or json.loads(saved[0]).get("status") != "landed":
            raise ValueError("book observation has no landed typed projection")
        source_revision = conn.execute(
            "SELECT source_key,revision_sha256 FROM observation WHERE observation_id=?",
            (observation_id,),
        ).fetchone()
        if source_revision is None:
            raise ValueError("book observation disappeared")
        _verify_landed(conn, observation_id, json.loads(saved[0]),
                       _verified_stored(conn, *source_revision))
        rows = conn.execute(
            "SELECT t.cid,t.source_key,t.revision_sha256,t.parser_version,t.block_index,"
            "t.text,t.metadata_json FROM projection_block b JOIN typed_content t ON t.cid=b.cid "
            "WHERE b.observation_id=? ORDER BY b.block_index", (observation_id,),
        ).fetchall()
        return [{"cid": cid, "source_key": source, "revision_sha256": revision,
                 "parser_version": parser, "block_index": index, "text": text,
                 "metadata": json.loads(meta)}
                for cid, source, revision, parser, index, text, meta in rows]
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    f = commands.add_parser("freeze")
    f.add_argument("--source", type=Path, required=True)
    f.add_argument("--descriptor", type=Path, required=True)
    f.add_argument("--trial-root", type=Path, required=True)
    i = commands.add_parser("intake")
    i.add_argument("--state-root", type=Path, required=True)
    i.add_argument("--freeze-receipt", type=Path, required=True)
    i.add_argument("--intent", required=True)
    p = commands.add_parser("project")
    p.add_argument("--state-root", type=Path, required=True)
    p.add_argument("--observation", type=int, required=True)
    args = parser.parse_args()
    try:
        if args.command == "freeze":
            result = freeze_book(args.source, args.descriptor, args.trial_root)
        elif args.command == "intake":
            result = intake_book(args.state_root, args.freeze_receipt, args.intent)
        else:
            result = project_book(args.state_root, args.observation)
    except (OSError, sqlite3.Error, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
