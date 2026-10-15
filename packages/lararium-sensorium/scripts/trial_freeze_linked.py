#!/usr/bin/env python3
"""Freeze one Claude main session and one native sub-agent into a private trial root.

The folder and child record IDs prove source association. A matching string in
the parent excerpt counts as a reference, not yet a typed delegation edge.
Each member receives its own exact-byte receipt from trial_freeze.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from ephemeral import session_ephemeral
from trial_freeze import freeze_one


def freeze_linked(inventory_path: Path, main_path: Path, child_path: Path, trial_root: Path) -> dict:
    with inventory_path.open(encoding="utf-8") as handle:
        inventory = json.load(handle)
    if inventory.get("schema") != "lararium.sensorium.trial-inventory.claude.v1":
        raise ValueError("unsupported trial inventory schema")
    native_root = Path(inventory["source_root"]).resolve()
    main_path, child_path, trial_root = main_path.resolve(), child_path.resolve(), trial_root.resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if trial_root.is_relative_to(native_root) or trial_root.is_relative_to(repo_root):
        raise ValueError("trial root must stay outside native history and repository")
    main_rel = main_path.relative_to(native_root)
    child_rel = child_path.relative_to(native_root)
    if len(main_rel.parts) != 2 or not main_path.name.endswith(".jsonl"):
        raise ValueError("main must name a native project session JSONL")
    if (len(child_rel.parts) != 4 or child_rel.parts[0] != main_rel.parts[0]
            or child_rel.parts[1] != main_path.stem or child_rel.parts[2] != "subagents"
            or not child_path.name.startswith("agent-") or not child_path.name.endswith(".jsonl")):
        raise ValueError("sub-agent must sit beneath the named main session")
    for path in (main_path, child_path):
        reason = session_ephemeral(str(path))
        if reason:
            raise ValueError(f"ephemeral source refused: {path.name}: {reason}")
    agent_id = child_path.stem.removeprefix("agent-")
    trial_root.mkdir(mode=0o700)
    main = freeze_one(inventory_path, main_path, trial_root / "main")
    child = freeze_one(inventory_path, child_path, trial_root / "subagent")

    child_rows = [json.loads(line) for line in Path(child["evidence"]).read_bytes().splitlines()]
    session_ids = {row.get("sessionId") for row in child_rows if row.get("sessionId")}
    agent_ids = {row.get("agentId") for row in child_rows if row.get("agentId")}
    if session_ids != {main_path.stem} or agent_ids != {agent_id}:
        raise ValueError("frozen sub-agent IDs do not match native parent path and filename")
    reference_rows = sum(agent_id.encode() in line for line in Path(main["evidence"]).read_bytes().splitlines())
    receipt = {
        "schema": "lararium.sensorium.trial-linked-freeze.claude.v1",
        "window": inventory["window"],
        "main_receipt": str(trial_root / "main" / "freeze-receipt.json"),
        "subagent_receipt": str(trial_root / "subagent" / "freeze-receipt.json"),
        "main_evidence_sha256": main["evidence_sha256"],
        "subagent_evidence_sha256": child["evidence_sha256"],
        "main_rows": sum(main["rows_by_type"].values()),
        "subagent_rows": sum(child["rows_by_type"].values()),
        "native_link": "child file nests under the main session; child sessionId and agentId match",
        "selected_parent_rows_referencing_agent_id": reference_rows,
        "causal_edge": "unproven; a string reference does not certify delegation",
        "status": "frozen evidence; transactional intake and projection unproven",
    }
    fd = os.open(trial_root / "linked-freeze-receipt.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as target:
        json.dump(receipt, target, indent=2)
        target.write("\n")
        target.flush()
        os.fsync(target.fileno())
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--main", type=Path, required=True)
    parser.add_argument("--subagent", type=Path, required=True)
    parser.add_argument("--trial-root", type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = freeze_linked(args.inventory, args.main, args.subagent, args.trial_root)
    except (OSError, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps({"trial_root": str(args.trial_root), "main_rows": receipt["main_rows"],
                      "subagent_rows": receipt["subagent_rows"],
                      "parent_reference_rows": receipt["selected_parent_rows_referencing_agent_id"]}))


if __name__ == "__main__":
    main()
