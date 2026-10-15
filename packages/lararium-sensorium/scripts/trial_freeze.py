#!/usr/bin/env python3
"""Freeze one inventoried Claude JSONL excerpt into a private disposable trial root.

The native file is opened read-only. Every selected row must still match its
inventory offset, length and SHA-256; a changed source refuses the freeze.
All timestamped row types stay in evidence. The current Claude content parser
projects user/assistant rows only, and the receipt names that narrower claim.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path


def freeze_one(inventory_path: Path, source_path: Path, trial_root: Path) -> dict:
    with inventory_path.open(encoding="utf-8") as source:
        inventory = json.load(source)
    if inventory.get("schema") != "lararium.sensorium.trial-inventory.claude.v1":
        raise ValueError("unsupported trial inventory schema")

    native_root = Path(inventory["source_root"]).resolve()
    source_path = source_path.resolve()
    trial_root = trial_root.resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if not source_path.is_relative_to(native_root):
        raise ValueError("source lies outside inventoried native root")
    if trial_root.is_relative_to(native_root) or trial_root.is_relative_to(repo_root):
        raise ValueError("trial root must stay outside native history and repository")
    matches = [row for row in inventory["files"] if Path(row["path"]).resolve() == source_path]
    if len(matches) != 1 or not matches[0]["selected"]:
        raise ValueError("source must occur once in inventory with selected rows")
    entry = matches[0]
    rows = entry["selected"]
    if any(not isinstance(r["offset"], int) or not isinstance(r["length"], int)
           or r["offset"] < 0 or r["length"] <= 0 for r in rows):
        raise ValueError("invalid row coordinates")
    if any(a["offset"] + a["length"] > b["offset"] for a, b in zip(rows, rows[1:])):
        raise ValueError("selected rows overlap or run out of order")

    # Verify before creating any trial output. An active producer may append or
    # rewrite after inventory; this gate refuses even an otherwise matching tail.
    with source_path.open("rb") as native:
        stat = os.fstat(native.fileno())
        if stat.st_size != entry["size"] or stat.st_mtime_ns != entry["mtime_ns"]:
            raise ValueError("native source changed after inventory")
        for row in rows:
            native.seek(row["offset"])
            raw = native.read(row["length"])
            if hashlib.sha256(raw).hexdigest() != row["sha256"]:
                raise ValueError(f"native row changed at offset {row['offset']}")
        after = os.fstat(native.fileno())
        if (after.st_size, after.st_mtime_ns) != (stat.st_size, stat.st_mtime_ns):
            raise ValueError("native source changed during verification")

        trial_root.mkdir(mode=0o700)  # exclusive: a prior trial never receives a silent append
        evidence_dir = trial_root / "sources" / "claude"
        if source_path.parent.name == "subagents" and source_path.name.startswith("agent-"):
            # Claude's source key derives a sub-agent's parent session from this
            # directory shape. Preserve it across the private copy.
            evidence_dir = evidence_dir / source_path.parent.parent.name / "subagents"
        evidence_dir.mkdir(parents=True, mode=0o700)
        evidence = evidence_dir / source_path.name
        digest = hashlib.sha256()
        written = 0
        fd = os.open(evidence, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as target:
                for row in rows:
                    native.seek(row["offset"])
                    raw = native.read(row["length"])
                    if hashlib.sha256(raw).hexdigest() != row["sha256"]:
                        raise ValueError(f"native row changed during copy at offset {row['offset']}")
                    target.write(raw)
                    digest.update(raw)
                    written += len(raw)
                target.flush()
                os.fsync(target.fileno())
            after_copy = os.fstat(native.fileno())
            if (after_copy.st_size, after_copy.st_mtime_ns) != (stat.st_size, stat.st_mtime_ns):
                raise ValueError("native source changed during copy")
        except Exception:
            # A partial private trial remains recognizable by the absent receipt.
            raise

    by_type: dict[str, int] = {}
    for row in rows:
        name = str(row.get("type"))
        by_type[name] = by_type.get(name, 0) + 1
    receipt = {
        "schema": "lararium.sensorium.trial-freeze.claude.v1",
        "inventory": str(inventory_path.resolve()),
        "window": inventory["window"],
        "native_source": str(source_path),
        "native_size": entry["size"], "native_mtime_ns": entry["mtime_ns"],
        "evidence": str(evidence), "evidence_bytes": written,
        "evidence_sha256": digest.hexdigest(), "rows_by_type": by_type,
        "rows_without_event_time": entry["rows_without_event_time"],
        "invalid_json": entry["invalid_json"],
        "scope": "partial session" if written != entry["size"] else "whole source",
        "projection_policy": "only user/assistant rows enter current Claude content parser",
        "status": "frozen evidence; projection and custody transaction unproven",
    }
    receipt_path = trial_root / "freeze-receipt.json"
    fd = os.open(receipt_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as target:
        json.dump(receipt, target, indent=2)
        target.write("\n")
        target.flush()
        os.fsync(target.fileno())
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--trial-root", type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = freeze_one(args.inventory, args.source, args.trial_root)
    except (OSError, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps({"trial_root": str(args.trial_root), "scope": receipt["scope"],
                      "evidence_bytes": receipt["evidence_bytes"],
                      "rows_by_type": receipt["rows_by_type"]}))


if __name__ == "__main__":
    main()
