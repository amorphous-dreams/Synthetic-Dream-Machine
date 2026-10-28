"""Held-out cross-representation Hephaestus crucible, no automatic promotions.

Independently authored geometry crosses native BRep, STEP, USD, a causal
operator edit, and regenerated evidence. Deliberate tampering and stale
frontiers must fail. The original seven seed cohorts remain separately
exercised by the dedicated Experiment Zero matrix.
"""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import shutil

from .scene_usd import package_scene, validate_scene
from .editor_proposals import seed_editor_ground, apply_proposal
from .relational_ground import RelationalGround, IDENTITY
from .incremental_graph import graph_for_scene


def _subject():
    return {"schema": "projection-loom/scene-declaration",
            "location": "held-out-coastal-conservatory",
            "meters_per_unit": 1.0,
            "assemblies": [
                {"entity_id": "salt-terrace", "growth_program": {"nodes": [
                    {"key": "root", "op": "foundation", "size": [9, 4, 1.5]},
                    {"key": "canopy", "op": "spawn", "parent": "root",
                     "face": "up", "size": [2.5, 2, 1.2]}]}},
                {"entity_id": "water-gate", "growth_program": {"nodes": [
                    {"key": "root", "op": "foundation", "size": [5, 5, 2]},
                    {"key": "mast", "op": "spawn", "parent": "root",
                     "face": "up", "size": [1, 1, 2]}]}}]}


def run_crucible(output):
    out = Path(output)
    if out.exists():
        raise ValueError("Crucible output must be independently new")
    out.mkdir(parents=True)
    document = _subject()
    original = out / "original"
    native_before = package_scene(document, original)
    assert validate_scene(original)["valid"]
    ground = seed_editor_ground(document)
    ground.save(out / "original-ground.json")
    edit = {"schema": "projection-loom/editor-proposal", "editor": "cli",
            "actor": "operator-held-out-witness",
            "bundle_sha256": native_before["sha256"],
            "observed_frontier": list(ground.frontier),
            "edits": [{"kind": "translate", "entity_id": "water-gate",
                       "delta": [0, 7, 0]}]}
    result = apply_proposal(document, ground, original, edit, out / "regenerated")
    assert validate_scene(out / "regenerated" / "scene")["valid"]
    after = RelationalGround.load(out / "regenerated" / "ground.json")
    before_state = ground.snapshot()
    after_state = after.snapshot()
    if (set(before_state["entities"]) != set(after_state["entities"])
            or after_state["entities"]["water-gate"]["matrix"][7] != 7):
        raise RuntimeError("Semantic identity or relative movement failed")
    current = graph_for_scene(json.loads(
        (out / "regenerated" / "declaration.json").read_text()))
    plan = current.compare(graph_for_scene(document))
    if ("cad:water-gate" not in plan["rebuilt"]
            or "cad:salt-terrace" not in plan["cached"]):
        raise RuntimeError("Incremental dependency planning was not selective")
    # Source-bundle identity is preserved, while current evidence changes.
    stale_refused = False
    matrix = list(IDENTITY)
    matrix[7] = 99
    try:
        after.apply({"kind": "transform", "actor": "unmerged-editor",
                     "frontier": list(ground.frontier),
                     "target": "water-gate",
                     "payload": {"matrix": matrix, "frame": "local3d"}})
    except ValueError as exc:
        if "Conflicting concurrent" in str(exc):
            stale_refused = True
    if not stale_refused:
        raise RuntimeError("Stale concurrent geometry edit was silently accepted")
    tampered = out / "tampered-copy"
    shutil.copytree(original, tampered)
    native_asset = native_before["bodies"][0]["step_path"]
    with (tampered / native_asset).open("ab") as stream:
        stream.write(b"tamper")
    asset_tamper_refused = False
    try:
        validate_scene(tampered)
    except ValueError as exc:
        if "digest mismatch" in str(exc):
            asset_tamper_refused = True
    if not asset_tamper_refused:
        raise RuntimeError("Modified STEP input passed immutable asset validation")
    receipt = {"schema": "projection-loom/held-out-hephaestus-crucible",
               "subject": document["location"],
               "source_bundle_sha256": native_before["sha256"],
               "regenerated_bundle_sha256": result["new_bundle_sha256"],
               "stable_semantic_ids": True, "native_step_reimport": True,
               "usd_composition_reopened": True,
               "selective_invalidation_plan": True,
               "actual_cache_reuse": 0, "stale_edit_refused": stale_refused,
               "tampered_step_refused": asset_tamper_refused,
               "source_camera_authority": "none",
               "automatic_promotion": False, "editor_application_witness": "not in this crucible"}
    (out / "crucible.json").write_text(json.dumps(receipt, indent=2,
                                                sort_keys=True) + "\n",
                                      encoding="utf8")
    return receipt


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = run_crucible(args.out)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
