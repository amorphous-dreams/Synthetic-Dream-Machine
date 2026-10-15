#!/usr/bin/env python3
"""Copy one verified frozen source to a private, relocatable container handoff."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from trial_intake import _load_frozen


def stage_frozen(receipt_path: Path, handoff_root: Path, *, source_host: str) -> dict:
    receipt_path = receipt_path.resolve()
    handoff_root = handoff_root.resolve()
    source_manifest, raw, source_key, _, _, digest, _ = _load_frozen(receipt_path, source_host)
    native_root = Path(source_manifest["native_root"]).resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if (handoff_root.is_relative_to(native_root) or handoff_root.is_relative_to(repo_root)
            or handoff_root.is_relative_to(receipt_path.parent)
            or receipt_path.parent.is_relative_to(handoff_root)):
        raise ValueError("handoff must stay outside native history, repository and freeze root")
    if handoff_root.exists():
        raise FileExistsError("handoff root already exists; name a fresh private handoff")

    with receipt_path.open(encoding="utf-8") as handle:
        freeze = json.load(handle)
    handoff_root.mkdir(mode=0o700, parents=True)
    evidence = handoff_root / "evidence.jsonl"
    fd = os.open(evidence, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(raw)
        target.flush()
        os.fsync(target.fileno())
    freeze["evidence"] = "evidence.jsonl"
    freeze["handoff_schema"] = "lararium.sensorium.trial-handoff.v1"
    freeze["source_host"] = source_host
    frozen_receipt = handoff_root / "freeze-receipt.json"
    fd = os.open(frozen_receipt, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as target:
        json.dump(freeze, target, sort_keys=True, indent=2)
        target.write("\n")
        target.flush()
        os.fsync(target.fileno())
    if hashlib.sha256(evidence.read_bytes()).hexdigest() != digest:
        raise ValueError("handoff evidence changed during staging")
    ready = handoff_root / "handoff-ready.json"
    fd = os.open(ready, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as target:
        json.dump({"schema": "lararium.sensorium.trial-handoff.v1",
                   "source_host": source_host, "evidence_sha256": digest}, target,
                  sort_keys=True)
        target.write("\n")
        target.flush()
        os.fsync(target.fileno())
    directory = os.open(handoff_root, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    return {"schema": "lararium.sensorium.trial-handoff.v1", "source_key": source_key,
            "source_host": source_host, "evidence_sha256": digest,
            "evidence_bytes": len(raw), "handoff_root": str(handoff_root)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze-receipt", type=Path, required=True)
    parser.add_argument("--handoff-root", type=Path, required=True)
    parser.add_argument("--source-host", required=True)
    args = parser.parse_args()
    try:
        result = stage_frozen(args.freeze_receipt, args.handoff_root,
                              source_host=args.source_host)
    except (OSError, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
