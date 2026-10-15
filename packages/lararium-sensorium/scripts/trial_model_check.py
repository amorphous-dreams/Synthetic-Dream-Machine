#!/usr/bin/env python3
"""Verify the declared offline model bytes beneath a mounted trial state root."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


DEFAULT_LOCK = Path(__file__).resolve().parents[1] / "model-assets.json"


def verify_model(state_root: Path, lock_path: Path = DEFAULT_LOCK) -> dict:
    state_root = state_root.resolve()
    with lock_path.open(encoding="utf-8") as handle:
        lock = json.load(handle)
    if lock.get("schema") != "lararium.sensorium.trial-model-assets.v1":
        raise ValueError("unsupported model asset lock")
    cache = Path(lock["cache_path"])
    if cache.is_absolute() or ".." in cache.parts:
        raise ValueError("model cache path must stay beneath state")
    cache_root = (state_root / cache).resolve()
    if not cache_root.is_relative_to(state_root):
        raise ValueError("model cache leaves state")
    files = lock["files"]
    if not files or not isinstance(files, dict):
        raise ValueError("model lock names no assets")
    for relative, expected in files.items():
        name = Path(relative)
        if name.is_absolute() or ".." in name.parts or not re.fullmatch(r"[0-9a-f]{64}", expected):
            raise ValueError("invalid model asset locator or digest")
        asset = (cache_root / name).resolve()
        if not asset.is_relative_to(cache_root) or not asset.is_file():
            raise ValueError(f"model asset leaves cache or is absent: {relative}")
        digest = hashlib.sha256()
        with asset.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError(f"model asset hash changed: {relative}")
    return {"schema": lock["schema"], "model": lock["model"],
            "dimensions": lock["dimensions"], "verified_assets": len(files)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    args = parser.parse_args()
    try:
        result = verify_model(args.state_root, args.lock)
    except (OSError, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
