"""Operator-attributed review receipt for independently verified native workspaces.

Review records testimony without assigning artistic winners or promoting canon.
The operator decision is a distinct act and cannot rewrite native evidence.
"""
from __future__ import annotations
from pathlib import Path
import json
from .provenance_encoding import canonical_json_sha256
from .receipt_store import save_once
from .location_workspace import verify_workspace

DECISIONS = frozenset(("accept", "abstain", "dissent"))


def review_location(workspace, *, actor, decision, reason, destination):
    if decision not in DECISIONS or not isinstance(actor, str) or not actor.strip():
        raise ValueError("Attributed review must state a supported decision and actor")
    if not isinstance(reason, str) or (decision == "dissent" and not reason.strip()):
        raise ValueError("A dissent must preserve an explicit reason")
    source = Path(workspace)
    audit = verify_workspace(source)
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf8"))
    scene = json.loads((source / manifest["paths"]["scene"] / "manifest.json").read_text(encoding="utf8"))
    receipt = None
    if manifest["paths"]["reconciliation"] is not None:
        receipt = json.loads((source / manifest["paths"]["reconciliation"]).read_text(encoding="utf8"))
    core = {"schema":"projection-loom/location-review",
            "location":audit["location"], "workspace_sha256":manifest["sha256"],
            "source_inventory_sha256":manifest["inventory_sha256"],
            "ground_sha256":manifest["ground_sha256"],
            "native_scene_sha256":scene["sha256"],
            "editor_reconciliation_sha256":manifest["reconciliation_sha256"],
            "changed_native_entities":scene["cache"]["native_rebuilt_entities"],
            "reused_native_entities":scene["cache"]["reused_entities"],
            "transfers":receipt.get("support_transfers", []) if receipt else [],
            "actor":actor, "decision":decision, "reason":reason,
            "review_scope":"operator-testimony-only", "load_certification":False,
            "automatic_winner":False, "automatic_canon_promotion":False}
    doc = {**core,"sha256":canonical_json_sha256(core)}
    target = Path(destination)
    if target.exists():
        raise ValueError("Review must publish to a new immutable destination")
    save_once(target,doc)
    return doc


def verify_location_review(workspace, receipt):
    source=Path(workspace)
    audit=verify_workspace(source)
    body={k:v for k,v in receipt.items() if k!="sha256"}
    if receipt.get("sha256")!=canonical_json_sha256(body):
        raise ValueError("Operator review digest changed")
    if (receipt.get("workspace_sha256")!=audit["workspace_sha256"]
            or receipt.get("decision") not in DECISIONS):
        raise ValueError("Review references an unrelated or unsupported location")
    return True
