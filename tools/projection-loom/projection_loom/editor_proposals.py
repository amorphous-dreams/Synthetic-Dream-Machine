"""Editor-neutral causal proposals with exact native regeneration for rigid relocation.

A user or editor may propose a translation of an independent authored assembly.
Arbitrary mesh rewrites, guessed camera registration, and support reparenting
are never quietly converted into growth genomes. The original bundle remains
immutable and all native claims are re-audited on the new branch.
"""
from __future__ import annotations

from copy import deepcopy
import json
import math
from pathlib import Path

from .provenance_encoding import canonical_json_sha256
from .relational_ground import RelationalGround, IDENTITY
from .scene_usd import package_scene, validate_scene, _validate_declaration
from .incremental_graph import graph_for_scene


def seed_editor_ground(declaration):
    """Bind explicitly authored assembly IDs, not transient CAD or prim names."""
    _validate_declaration(declaration)
    ground = RelationalGround(declaration["location"])
    for row in sorted(declaration["assemblies"], key=lambda x: x["entity_id"]):
        operation = {"kind": "create", "actor": "loom-authored-proposal",
                     "frontier": list(ground.frontier),
                     "target": row["entity_id"],
                     "payload": {"kind": "construct", "authority": "proposed",
                                 "attributes": {"program_sha256": canonical_json_sha256(
                                     row["growth_program"])}}}
        ground, _ = ground.apply(operation)
        translation = row.get("translation", (0, 0, 0))
        if any(float(x) != 0 for x in translation):
            matrix = list(IDENTITY)
            matrix[3], matrix[7], matrix[11] = [float(x) for x in translation]
            ground, _ = ground.apply({
                "kind": "transform", "actor": "loom-authored-proposal",
                "frontier": list(ground.frontier), "target": row["entity_id"],
                "payload": {"matrix": matrix, "frame": "local3d"}})
    return ground


def validate_proposal(proposal, original, ground, bundle):
    if set(proposal) != {"schema", "editor", "actor", "bundle_sha256",
                         "observed_frontier", "edits"}:
        raise ValueError("Editor proposal requires exact fields")
    if proposal["schema"] != "projection-loom/editor-proposal":
        raise ValueError("Unsupported editor proposal schema")
    if proposal["editor"] not in ("cli", "blender", "unreal"):
        raise ValueError("Unknown editor provenance")
    if not isinstance(proposal["actor"], str) or not proposal["actor"].strip():
        raise ValueError("Actor attribution required")
    if (not isinstance(proposal["observed_frontier"], list)
            or not all(isinstance(x, str) for x in proposal["observed_frontier"])):
        raise ValueError("A causal observed frontier is required")
    if not isinstance(proposal["edits"], list) or not proposal["edits"]:
        raise ValueError("At least one supported edit required")
    if len({x.get("entity_id") for x in proposal["edits"]}) != len(proposal["edits"]):
        raise ValueError("Repeated edit target requires its own causal turn")
    if proposal["bundle_sha256"] != bundle["sha256"]:
        raise ValueError("Editor proposal targets a different scene bundle")
    if canonical_json_sha256(original) != bundle["declaration_sha256"]:
        raise ValueError("Authored declaration differs from witnessed scene")
    if ground.location != original["location"]:
        raise ValueError("Editor and ground location differ")
    rows = {x["entity_id"]: x for x in original["assemblies"]}
    expected = set(rows)
    entities = ground.snapshot()["entities"]
    if expected != set(entities):
        raise ValueError("Editor base has mismatched semantic identity inventory")
    for entity_id, row in rows.items():
        observed = entities[entity_id]
        if (observed["kind"] != "construct"
                or observed["attributes"].get("program_sha256")
                != canonical_json_sha256(row["growth_program"])):
            raise ValueError("Editor ground source program identity differs from native declaration")
        matrix = list(IDENTITY)
        matrix[3], matrix[7], matrix[11] = [
            float(x) for x in row.get("translation", (0, 0, 0))]
        if observed["matrix"] != matrix:
            raise ValueError("Editor ground transform differs from the native declaration")
    for edit in proposal["edits"]:
        if set(edit) != {"entity_id", "kind", "delta"} or edit["kind"] != "translate":
            raise ValueError("Only rigid assembly translation is currently reversible")
        if edit["entity_id"] not in expected:
            raise ValueError("Edit targets unknown semantic entity")
        delta = edit["delta"]
        if (not isinstance(delta, (list, tuple)) or len(delta) != 3
                or any(type(x) not in (int, float) or not math.isfinite(x) for x in delta)):
            raise ValueError("Translation proposal must contain three finite deltas")


def apply_proposal(original, ground, source_bundle, proposal, destination):
    """Accept a supported causal proposal and independently rebuild accepted CAD."""
    source_bundle = Path(source_bundle)
    observed = json.loads((source_bundle / "manifest.json").read_text(encoding="utf8"))
    validate_scene(source_bundle)
    validate_proposal(proposal, original, ground, observed)
    revised = deepcopy(original)
    next_ground = ground
    records = []
    before_graph = graph_for_scene(original)
    for edit in proposal["edits"]:
        row = next(r for r in revised["assemblies"] if r["entity_id"] == edit["entity_id"])
        old = [float(x) for x in row.get("translation", (0, 0, 0))]
        new = [old[i] + float(edit["delta"][i]) for i in range(3)]
        row["translation"] = new
        matrix = list(IDENTITY)
        matrix[3], matrix[7], matrix[11] = new
        action = {"kind": "transform", "actor": proposal["actor"],
                  "target": edit["entity_id"],
                  "frontier": list(proposal["observed_frontier"]),
                  "expected_revision": next_ground.snapshot()["entities"][edit["entity_id"]]["revision"],
                  "payload": {"matrix": matrix, "frame": "local3d"}}
        next_ground, receipt = next_ground.apply(action)
        records.append(receipt)
    plan = graph_for_scene(revised).compare(before_graph)
    dest = Path(destination)
    if dest.exists():
        raise ValueError("Regenerated output must be new and immutable")
    dest.mkdir(parents=True)
    try:
        package = package_scene(revised, dest / "scene",
                                reuse_bundle=source_bundle, previous_document=original)
        next_ground.save(dest / "ground.json")
        (dest / "declaration.json").write_text(json.dumps(revised, indent=2,
                                                         sort_keys=True) + "\n",
                                               encoding="utf8")
        outcome = {"schema": "projection-loom/editor-reconciliation",
                   "origin_bundle_sha256": observed["sha256"],
                   "new_bundle_sha256": package["sha256"],
                   "editor": proposal["editor"],
                   "actor": proposal["actor"],
                   "operations": records,
                   "invalidation_plan": {
                       "rebuilt": plan["rebuilt"],
                       "cached_eligible": plan["cached"],
                       "actual_cache_reuse": package["cache"]["actual_native_cache_reuse"],
                       "native_reaudited": package["cache"]["native_reaudited"]},
                   "auto_promotion": False}
        (dest / "reconciliation.json").write_text(json.dumps(outcome, indent=2,
                                                               sort_keys=True) + "\n",
                                                     encoding="utf8")
    except Exception:
        # Failed construction cannot produce a completed reconciliation receipt.
        (dest / "FAILED").write_text("Editor reconciliation aborted; no success receipt\n",
                                     encoding="utf8")
        raise
    return outcome
