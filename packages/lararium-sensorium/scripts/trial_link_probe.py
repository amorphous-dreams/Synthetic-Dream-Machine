#!/usr/bin/env python3
"""Find a source-declared Claude Agent delegation across frozen trial sources.

A typed edge requires Agent tool_use -> matching tool_result -> agentId label,
with the result's parentUuid pointing to the tool-use row and the child's own
agentId/sessionId agreeing. A free-text mention does not qualify.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path


def _verified_rows(receipt_path: Path) -> tuple[dict, list[dict]]:
    with receipt_path.open(encoding="utf-8") as handle:
        receipt = json.load(handle)
    evidence = Path(receipt["evidence"])
    raw = evidence.read_bytes()
    if hashlib.sha256(raw).hexdigest() != receipt["evidence_sha256"]:
        raise ValueError(f"frozen evidence hash changed: {evidence}")
    return receipt, [json.loads(line) for line in raw.splitlines()]


def _blocks(row: dict) -> list[dict]:
    message = row.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    return [block for block in content if isinstance(block, dict)] if isinstance(content, list) else []


def _result_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(block.get("text", "") for block in content
                         if isinstance(block, dict) and isinstance(block.get("text"), str))
    return ""


def probe_linked(trial_root: Path) -> dict:
    trial_root = trial_root.resolve()
    with (trial_root / "linked-freeze-receipt.json").open(encoding="utf-8") as handle:
        link = json.load(handle)
    if link.get("schema") != "lararium.sensorium.trial-linked-freeze.claude.v1":
        raise ValueError("unsupported linked freeze receipt")
    main, main_rows = _verified_rows(Path(link["main_receipt"]))
    child, child_rows = _verified_rows(Path(link["subagent_receipt"]))
    parent_id = Path(main["native_source"]).stem
    child_id = Path(child["native_source"]).stem.removeprefix("agent-")
    if not child_id or not child_rows:
        raise ValueError("empty frozen sub-agent evidence")
    if {row.get("sessionId") for row in child_rows if row.get("sessionId")} != {parent_id}:
        raise ValueError("child session IDs do not match parent")
    if {row.get("agentId") for row in child_rows if row.get("agentId")} != {child_id}:
        raise ValueError("child agent IDs do not match filename")

    calls: dict[str, str] = {}
    for row in main_rows:
        if row.get("type") != "assistant" or not row.get("uuid"):
            continue
        for block in _blocks(row):
            if block.get("type") == "tool_use" and block.get("name") == "Agent" and block.get("id"):
                calls[str(block["id"])] = str(row["uuid"])
    label = re.compile(r"(?:^|\n)agentId:\s*" + re.escape(child_id) + r"(?:\s|$)")
    edges = []
    for row in main_rows:
        if row.get("type") != "user" or not row.get("uuid"):
            continue
        for block in _blocks(row):
            tool_id = block.get("tool_use_id")
            if (block.get("type") != "tool_result" or not isinstance(tool_id, str)
                    or calls.get(tool_id) != row.get("parentUuid")):
                continue
            if label.search(_result_text(block.get("content"))):
                edges.append({"tool_use_id": tool_id, "agent_call_uuid": calls[tool_id],
                              "tool_result_uuid": row["uuid"], "child_agent_id": child_id})
    return {"schema": "lararium.sensorium.trial-delegation-probe.claude.v1",
            "main_evidence_sha256": main["evidence_sha256"],
            "subagent_evidence_sha256": child["evidence_sha256"],
            "typed_source_declared_edges": edges,
            "scope": "frozen excerpt only; no claim about excluded rows or other sub-agents"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trial-root", type=Path, required=True)
    args = parser.parse_args()
    root = args.trial_root.resolve()
    try:
        result = probe_linked(root)
        fd = os.open(root / "delegation-probe.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as target:
            json.dump(result, target, indent=2)
            target.write("\n")
            target.flush()
            os.fsync(target.fileno())
    except (OSError, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps({"typed_source_declared_edges": len(result["typed_source_declared_edges"]),
                      "scope": result["scope"]}))


if __name__ == "__main__":
    main()
