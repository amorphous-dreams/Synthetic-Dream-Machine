"""Real edit -> causal reconcile -> native STEP/USD regeneration."""
import copy
import pytest

from projection_loom.scene_usd import package_scene, validate_scene
from projection_loom.editor_proposals import seed_editor_ground, apply_proposal


def declared():
    def body(name, width):
        return {"entity_id": name, "growth_program": {"nodes": [
            {"key": "root", "op": "foundation", "size": [width, width, 2]},
            {"key": "top", "op": "spawn", "parent": "root",
             "face": "up", "size": [2, 2, 1]}]}}
    return {"schema": "projection-loom/scene-declaration",
            "location": "independent-garden", "meters_per_unit": 1.0,
            "assemblies": [body("east", 5), body("west", 7)]}


def proposal(manifest, ground, entity="east", delta=(4, 0, 0)):
    return {"schema": "projection-loom/editor-proposal", "editor": "cli",
            "actor": "operator", "bundle_sha256": manifest["sha256"],
            "observed_frontier": list(ground.frontier),
            "edits": [{"kind": "translate", "entity_id": entity,
                       "delta": list(delta)}]}


def test_editor_translation_is_reaudited_and_identity_preserved(tmp_path):
    original = declared()
    source = tmp_path / "source"
    manifest = package_scene(original, source)
    ground = seed_editor_ground(original)
    result = apply_proposal(original, ground, source,
                            proposal(manifest, ground),
                            tmp_path / "branch")
    assert result["auto_promotion"] is False
    assert result["invalidation_plan"]["actual_cache_reuse"] == 0
    assert result["invalidation_plan"]["native_reaudited"] == 2
    assert "cad:east" in result["invalidation_plan"]["rebuilt"]
    assert "cad:west" in result["invalidation_plan"]["cached_eligible"]
    from projection_loom.relational_ground import RelationalGround
    new = RelationalGround.load(tmp_path / "branch" / "ground.json")
    assert new.snapshot()["entities"]["east"]["id"] == "east"
    assert new.snapshot()["entities"]["east"]["matrix"][3] == 4
    assert validate_scene(tmp_path / "branch" / "scene")["valid"]
    import json
    after = json.loads((tmp_path / "branch" / "scene" / "manifest.json").read_text())
    body = next(b for b in after["bodies"] if b["entity_id"] == "east")
    assert body["translation"] == [4., 0., 0.]
    assert next(b for b in after["bodies"] if b["entity_id"] == "west")[
        "step_reimport"]["native_bounds"][0] == next(
        b for b in manifest["bodies"] if b["entity_id"] == "west")[
        "step_reimport"]["native_bounds"][0]


def test_editor_refuses_arbitrary_topology_and_wrong_bundle(tmp_path):
    original = declared()
    source = tmp_path / "source"
    manifest = package_scene(original, source)
    ground = seed_editor_ground(original)
    bad = proposal(manifest, ground)
    bad["edits"][0] = {"kind": "mesh-topology", "entity_id": "east",
                       "delta": [1, 0, 0]}
    with pytest.raises(ValueError, match="Only rigid assembly translation"):
        apply_proposal(original, ground, source, bad, tmp_path / "unsupported")
    bad = proposal(manifest, ground)
    bad["bundle_sha256"] = "0" * 64
    with pytest.raises(ValueError, match="different scene bundle"):
        apply_proposal(original, ground, source, bad, tmp_path / "wrong")
    assert not (tmp_path / "wrong").exists()


def test_editor_rejects_stale_conflicting_frontier(tmp_path):
    original = declared()
    source = tmp_path / "source"
    manifest = package_scene(original, source)
    ground = seed_editor_ground(original)
    first = proposal(manifest, ground)
    from projection_loom.relational_ground import IDENTITY
    matrix = list(IDENTITY)
    matrix[3] = 3
    ground, _ = ground.apply({"kind": "transform", "actor": "other-editor",
                             "target": "east", "frontier": list(ground.frontier),
                             "payload": {"matrix": matrix, "frame": "local3d"}})
    with pytest.raises(ValueError, match="Conflicting concurrent|Stale semantic revision"):
        apply_proposal(original, ground, source, first, tmp_path / "conflict")
