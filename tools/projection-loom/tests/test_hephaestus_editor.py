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
    assert result["invalidation_plan"]["actual_cache_reuse"] == 1
    assert result["invalidation_plan"]["native_reaudited"] == 1
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
    with pytest.raises(ValueError, match="Conflicting concurrent|Stale semantic revision|ground transform differs|current causal frontier"):
        apply_proposal(original, ground, source, first, tmp_path / "conflict")



def test_editor_ground_rejects_same_names_with_different_native_program(tmp_path):
    import json
    from projection_loom.relational_ground import RelationalGround
    original = declared()
    folder = tmp_path / "native"
    manifest = package_scene(original, folder)
    mismatched = json.loads(json.dumps(original))
    mismatched["assemblies"][0]["growth_program"]["nodes"][0]["size"][0] += 1
    wrong_ground = seed_editor_ground(mismatched)
    with pytest.raises(ValueError, match="source program identity"):
        apply_proposal(original, wrong_ground, folder,
                       proposal(manifest, wrong_ground), tmp_path / "bad")
    assert not (tmp_path / "bad").exists()


def test_nonzero_initial_placement_stays_bound_to_native_source(tmp_path):
    original = declared()
    original["assemblies"][0]["translation"] = [3, 4, 0]
    folder = tmp_path / "original"
    manifest = package_scene(original, folder)
    ground = seed_editor_ground(original)
    assert ground.snapshot()["entities"]["east"]["matrix"][3] == 3
    assert ground.snapshot()["entities"]["east"]["matrix"][7] == 4
    outcome = apply_proposal(original, ground, folder,
                             proposal(manifest, ground, delta=(2, 0, 0)),
                             tmp_path / "next")
    from projection_loom.relational_ground import RelationalGround
    replayed = RelationalGround.load(tmp_path / "next" / "ground.json")
    assert replayed.snapshot()["entities"]["east"]["matrix"][3] == 5
    assert outcome["invalidation_plan"]["native_reaudited"] == 1


def test_atomic_two_body_editor_batch_has_serial_frontier_and_independent_replay(tmp_path):
    original = declared()
    source = tmp_path / "source-two"
    manifest = package_scene(original, source)
    ground = seed_editor_ground(original)
    request = proposal(manifest, ground)
    request["edits"].append({"kind": "translate", "entity_id": "west",
                              "delta": [-3, 2, 0]})
    receipt = apply_proposal(original, ground, source, request, tmp_path / "both")
    from projection_loom.relational_ground import RelationalGround
    changed = RelationalGround.load(tmp_path / "both" / "ground.json")
    assert changed.snapshot()["entities"]["east"]["matrix"][3] == 4
    assert changed.snapshot()["entities"]["west"]["matrix"][7] == 2
    assert len(receipt["operations"]) == 2
    assert receipt["invalidation_plan"]["native_reaudited"] == 2
    batch = receipt["causal_batch"]
    assert batch["operations"][1]["frontier"] == [batch["receipts"][0]["event_id"]]
    assert ground.verify_batch(batch).to_dict() == changed.to_dict()


def test_editor_atomic_batch_does_not_publish_partial_invalid_operation(tmp_path):
    original = declared()
    source = tmp_path / "source-failed-two"
    manifest = package_scene(original, source)
    ground = seed_editor_ground(original)
    request = proposal(manifest, ground)
    request["edits"].append({"kind": "translate", "entity_id": "unknown",
                              "delta": [2, 0, 0]})
    destination = tmp_path / "refused-atomic"
    with pytest.raises(ValueError, match="unknown semantic entity"):
        apply_proposal(original, ground, source, request, destination)
    assert not destination.exists()
    assert ground.snapshot()["entities"]["east"]["matrix"][3] == 0

