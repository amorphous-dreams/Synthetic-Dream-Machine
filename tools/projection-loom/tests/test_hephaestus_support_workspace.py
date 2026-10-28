"""One native geometric bearing joins the source-bound OODA-HA location."""
import json
import pytest
from projection_loom.location_stack import Frame, LocationStack
from projection_loom.location_workspace import (
    create_workspace, edit_workspace, support_workspace, verify_workspace)
from projection_loom.native_support import propose_support
from projection_loom.relational_ground import RelationalGround


def _site():
    inventory = LocationStack("held-out-support-location")
    inventory.add_frame(Frame("authored-metric", "local3d", "m"))
    declaration = {"schema": "projection-loom/scene-declaration",
                   "location": inventory.location_id, "meters_per_unit": 1.0,
                   "assemblies": [
                       {"entity_id": "lower", "growth_program": {"nodes": [
                           {"key": "root", "op": "foundation",
                            "size": [5, 5, 2]}]}},
                       {"entity_id": "upper", "translation": [0, 0, 2],
                        "growth_program": {"nodes": [
                           {"key": "root", "op": "foundation",
                            "size": [3, 3, 1]}]}}]}
    return inventory, declaration


def _entered(tmp_path):
    inventory, declaration = _site()
    parent = tmp_path / "source-location"
    first = create_workspace(inventory, declaration, parent)
    source = RelationalGround.load(parent / "ground.json")
    proposal = propose_support(source, parent / "scene", "lower", "upper")
    return parent, first, proposal


def test_native_geometric_bearing_is_a_full_source_bound_location_fork(tmp_path):
    parent, first, proposal = _entered(tmp_path)
    second = tmp_path / "supported"
    entered = support_workspace(parent, proposal, second)
    assert entered["change_kind"] == "native-support"
    assert entered["parent_workspace_sha256"] == first["sha256"]
    assert entered["inventory_sha256"] == first["inventory_sha256"]
    assert entered["scene_sha256"] == first["scene_sha256"]
    assert entered["automatic_promotion"] is False
    assert verify_workspace(second)["valid"]
    assert json.loads((second / "session.json").read_text())["status"] == "completed"
    ground = RelationalGround.load(second / "ground.json")
    assert {"parent": "lower", "child": "upper", "verb": "supports",
            "required": True} in ground.snapshot()["relations"]
    assert len(ground.events) > len(RelationalGround.load(parent / "ground.json").events)
    assert not proposal["native_contact"]["load_certification"]
    with pytest.raises(ValueError, match="new causal island"):
        support_workspace(parent, proposal, second)


def test_supported_native_location_refuses_contact_breaking_editor_move(tmp_path):
    parent, first, proof = _entered(tmp_path)
    child = tmp_path / "supported"
    manifest = support_workspace(parent, proof, child)
    ground = RelationalGround.load(child / "ground.json")
    editor = {"schema": "projection-loom/editor-proposal", "editor": "cli",
              "actor": "operator", "bundle_sha256": manifest["scene_sha256"],
              "observed_frontier": list(ground.frontier),
              "edits": [{"kind": "translate", "entity_id": "upper",
                         "delta": [0, 0, 3]}]}
    failing = tmp_path / "support-broken"
    with pytest.raises(ValueError, match="gap or penetration"):
        edit_workspace(child, editor, failing)
    assert (failing / "FAILED").is_file()
    assert not (failing / "manifest.json").exists()
    assert verify_workspace(child)["valid"]


def test_support_source_replay_rejects_stale_or_mutated_claims(tmp_path):
    parent, first, proof = _entered(tmp_path)
    altered = json.loads(json.dumps(proof))
    altered["native_contact"]["load_certification"] = True
    with pytest.raises(ValueError, match="digest changed"):
        support_workspace(parent, altered, tmp_path / "forged")
    supported = tmp_path / "supported"
    support_workspace(parent, proof, supported)
    receipt = supported / "native-support-proposal.json"
    raw = receipt.read_text()
    receipt.write_text(raw.replace('"upper"', '"alien"', 1))
    with pytest.raises(ValueError, match="receipt changed"):
        verify_workspace(supported)
