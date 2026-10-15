#!/usr/bin/env python3
"""Replay a checked-in Claude fixture into one fresh, disposable intake trial."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from trial_intake import intake_frozen, intake_status
from trial_project import project_observation


def _fixture_sources(manifest_path: Path) -> tuple[str, dict, list[tuple[dict, bytes]]]:
    manifest_path = manifest_path.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "lararium.sensorium.fixture.claude-week.v1":
        raise ValueError("unsupported repository fixture manifest")
    fixture_id = manifest_path.parent.name
    if not fixture_id or not manifest.get("sources"):
        raise ValueError("fixture has no identity or sources")
    sources = []
    roles = set()
    for entry in manifest["sources"]:
        role = entry["role"]
        relative = Path(entry["path"])
        if (role not in ("main", "subagent") or role in roles or relative.is_absolute()
                or ".." in relative.parts):
            raise ValueError("invalid or duplicate fixture source locator")
        source = (manifest_path.parent / relative).resolve()
        if not source.is_relative_to(manifest_path.parent) or not source.is_file():
            raise ValueError("fixture source leaves its manifest root")
        raw = source.read_bytes()
        if (len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]
                or len(raw.splitlines()) != entry["rows"]):
            raise ValueError("fixture source hash, length or row count changed")
        roles.add(role)
        sources.append((entry, raw))
    if roles != {"main", "subagent"}:
        raise ValueError("fixture must carry its declared parent and child")
    return fixture_id, manifest, sources


def replay_fixture(manifest_path: Path, trial_root: Path, *, source_host: str) -> dict:
    """Verify first; then copy and project the pair without opening native history."""
    fixture_id, manifest, sources = _fixture_sources(manifest_path)
    if not source_host.startswith("fixture-"):
        raise ValueError("fixture replay requires a fixture- source host namespace")
    trial_root = trial_root.resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if trial_root.is_relative_to(repo_root) or trial_root.exists():
        raise ValueError("trial root must be fresh and outside repository")
    trial_root.mkdir(mode=0o700, parents=True)
    state_root = trial_root / "state"
    receipts = []
    for entry, raw in sources:
        evidence = trial_root / "handoff" / entry["role"] / entry["path"]
        evidence.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with evidence.open("xb") as target:
            target.write(raw)
            target.flush()
            os.fsync(target.fileno())
        freeze = {"schema": "lararium.sensorium.trial-freeze.claude-fixture.v1",
                  "fixture_id": fixture_id, "fixture_source": entry["path"],
                  "window": manifest["window"], "scope": entry["scope"],
                  "rows_by_type": entry["rows_by_type"],
                  "rows_without_event_time": 0, "invalid_json": 0,
                  "evidence": entry["path"], "evidence_bytes": entry["bytes"],
                  "evidence_sha256": entry["sha256"]}
        receipt_path = trial_root / "handoff" / entry["role"] / "freeze-receipt.json"
        receipt_path.write_text(json.dumps(freeze, sort_keys=True, indent=2) + "\n")
        intent = f"{fixture_id}:{entry['role']}:{entry['sha256']}"
        intake = intake_frozen(state_root, receipt_path, intent, source_host=source_host)
        projection = project_observation(state_root, intake["observation_id"])
        if projection["status"] != "landed":
            raise ValueError(f"fixture projection did not land: {entry['role']}")
        receipts.append({"role": entry["role"], "source_key": intake["source_key"],
                         "revision_sha256": intake["revision_sha256"],
                         "observation_id": intake["observation_id"],
                         "source_frontier": intake["frontier"],
                         "content_frontier": projection["content_frontier"],
                         "typed_blocks": projection["typed_blocks"],
                         "content_sha256": projection["content_sha256"]})
    status = intake_status(state_root)
    result = {"schema": "lararium.sensorium.fixture-replay.v1",
              "fixture_id": fixture_id, "source_host": source_host,
              "sources": receipts, "observations": status["observations"],
              "typed_blocks": sum(item["typed_blocks"] for item in receipts)}
    (trial_root / "trial-receipt.json").write_text(json.dumps(result, sort_keys=True, indent=2) + "\n")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).resolve().parents[1]
                        / "fixtures/claude-week-2026-10-07/manifest.json")
    parser.add_argument("--trial-root", type=Path, required=True)
    parser.add_argument("--source-host", required=True)
    args = parser.parse_args()
    try:
        result = replay_fixture(args.manifest, args.trial_root, source_host=args.source_host)
    except (OSError, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
