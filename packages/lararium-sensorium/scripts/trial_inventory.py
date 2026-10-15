#!/usr/bin/env python3
"""Inventory a bounded Claude Code trial without copying or changing native history.

This records row locations and hashes, not transcript content. A later custody step
must re-read and verify each selected row before it can create frozen trial evidence.
File modification times never decide event-time eligibility.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path


def event_time(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.utcoffset() is not None else None


def inventory_claude(root: Path, start: datetime, end: datetime) -> dict:
    """Read JSONL bytes once; retain only bounded row coordinates and metadata."""
    if start.utcoffset() is None or end.utcoffset() is None or start >= end:
        raise ValueError("start and end must carry time zones and start must precede end")
    if not root.is_dir():
        raise ValueError(f"source root does not exist: {root}")

    files = []
    counts = {"files_seen": 0, "files_selected": 0, "rows_seen": 0,
              "rows_selected": 0, "rows_without_event_time": 0, "invalid_json": 0}
    for directory, subdirs, names in os.walk(root, followlinks=False):
        subdirs[:] = sorted(d for d in subdirs if not (Path(directory) / d).is_symlink())
        for name in sorted(names):
            path = Path(directory) / name
            if not name.endswith(".jsonl") or path.is_symlink() or not path.is_file():
                continue
            counts["files_seen"] += 1
            selected = []
            uncertain = 0
            invalid = 0
            with path.open("rb") as source:
                while True:
                    offset = source.tell()
                    raw = source.readline()
                    if not raw:
                        break
                    counts["rows_seen"] += 1
                    try:
                        row = json.loads(raw)
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        invalid += 1
                        counts["invalid_json"] += 1
                        continue
                    when = event_time(row.get("timestamp")) if isinstance(row, dict) else None
                    if when is None:
                        uncertain += 1
                        counts["rows_without_event_time"] += 1
                        continue
                    if start <= when < end:
                        selected.append({
                            "offset": offset, "length": len(raw),
                            "sha256": hashlib.sha256(raw).hexdigest(),
                            "event_time": when.isoformat(),
                            "type": row.get("type"), "uuid": row.get("uuid"),
                            "session_id": row.get("sessionId"), "producer_version": row.get("version"),
                        })
                        counts["rows_selected"] += 1
            if selected or uncertain or invalid:
                stat = path.stat()
                files.append({"path": str(path), "size": stat.st_size,
                              "mtime_ns": stat.st_mtime_ns, "selected": selected,
                              "rows_without_event_time": uncertain, "invalid_json": invalid})
                counts["files_selected"] += bool(selected)
    return {
        "schema": "lararium.sensorium.trial-inventory.claude.v1",
        "basis": "outer JSONL timestamp; file mtime only reports source revision",
        "window": {"start_inclusive": start.isoformat(), "end_exclusive": end.isoformat()},
        "source_root": str(root), "source_policy": "read-only; no native deletion or edit",
        "ephemeral_policy": "unassessed", "coverage": "candidate rows only; custody and parser proof pending",
        "counts": counts, "files": files,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--start", required=True, help="inclusive ISO 8601 event time with offset")
    parser.add_argument("--end", required=True, help="exclusive ISO 8601 event time with offset")
    parser.add_argument("--out", type=Path, required=True, help="new private manifest outside source root")
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    out = args.out.expanduser().resolve()
    if out.is_relative_to(root):
        parser.error("manifest must stay outside the native source root")
    repo_root = Path(__file__).resolve().parents[3]
    if out.is_relative_to(repo_root):
        parser.error("private manifest must stay outside the repository")
    start, end = event_time(args.start), event_time(args.end)
    if start is None or end is None:
        parser.error("start and end require ISO 8601 timestamps with offsets")
    result = inventory_claude(root, start, end)
    try:
        fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        parser.error("manifest already exists; choose a new trial path")
    with os.fdopen(fd, "w", encoding="utf-8") as target:
        json.dump(result, target, indent=2, ensure_ascii=False)
        target.write("\n")
    print(json.dumps({"out": str(out), "window": result["window"], "counts": result["counts"]}))


if __name__ == "__main__":
    main()
