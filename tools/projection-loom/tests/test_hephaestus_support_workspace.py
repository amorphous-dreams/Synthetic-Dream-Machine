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


def test_real_support_group_move_reaudits_two_native_bodies_and_reuses_third(tmp_path):
    from projection_loom.location_stack import Frame, LocationStack
    from projection_loom.location_workspace import create_workspace
    inventory = LocationStack("bounded-structural-relocation")
    inventory.add_frame(Frame("source-local3d", "local3d", "m"))
    original = {"schema": "projection-loom/scene-declaration",
                "location": inventory.location_id, "meters_per_unit": 1.0,
                "assemblies": [
                    {"entity_id": "lower", "growth_program": {"nodes": [
                        {"key": "root", "op": "foundation", "size": [5, 5, 2]}]}},
                    {"entity_id": "upper", "translation": [0, 0, 2],
                     "growth_program": {"nodes": [
                        {"key": "root", "op": "foundation", "size": [3, 3, 1]}]}},
                    {"entity_id": "independent", "translation": [12, 0, 0],
                     "growth_program": {"nodes": [
                        {"key": "root", "op": "foundation", "size": [2, 2, 3]}]}}]}
    first = tmp_path / "original"
    create_workspace(inventory, original, first)
    prior = RelationalGround.load(first / "ground.json")
    relation = propose_support(prior, first / "scene", "lower", "upper")
    supported = tmp_path / "supported"
    state = support_workspace(first, relation, supported)
    ground = RelationalGround.load(supported / "ground.json")
    request = {"schema": "projection-loom/editor-proposal", "editor": "cli",
               "actor": "operator-group", "bundle_sha256": state["scene_sha256"],
               "observed_frontier": list(ground.frontier),
               "transaction": "support-group",
               "edits": [{"kind": "translate", "entity_id": "lower",
                          "delta": [4, 0, 0]},
                         {"kind": "translate", "entity_id": "upper",
                          "delta": [4, 0, 0]}]}
    moved = tmp_path / "moved-group"
    result = edit_workspace(supported, request, moved)
    assert result["change_kind"] == "editor"
    assert verify_workspace(moved)["valid"]
    audit = json.loads((moved / "revision" / "reconciliation.json").read_text())
    assert audit["transaction_mode"] == "support-group"
    assert len(audit["causal_batch"]["operations"]) == 2
    assert audit["invalidation_plan"]["native_reaudited"] == 2
    assert audit["invalidation_plan"]["actual_cache_reuse"] == 1
    next_ground = RelationalGround.load(moved / "revision" / "ground.json")
    assert next_ground.snapshot()["entities"]["lower"]["matrix"][3] == 4
    assert next_ground.snapshot()["entities"]["upper"]["matrix"][3] == 4
    assert next_ground.snapshot()["entities"]["independent"]["matrix"][3] == 12
    assert verify_workspace(supported)["valid"]
    clone = json.loads(json.dumps(request))
    clone["edits"][1]["delta"] = [0, 0, 4]
    with pytest.raises(ValueError, match="share an exact rigid delta"):
        edit_workspace(supported, clone, tmp_path / "mismatch")
    partial = json.loads(json.dumps(request))
    partial["edits"] = partial["edits"][:1]
    with pytest.raises(ValueError, match="at least two members"):
        edit_workspace(supported, partial, tmp_path / "partial")
    p = moved / "editor-source-ground.json"
    raw = p.read_text()
    p.write_text(raw.replace('"construct"', '"observation"', 1))
    with pytest.raises(ValueError, match="digest"):
        verify_workspace(moved)


def test_support_group_refuses_unconnected_extra_body(tmp_path):
    parent, _, relation = _entered(tmp_path)
    supported = tmp_path / "supported"
    state = support_workspace(parent, relation, supported)
    ground = RelationalGround.load(supported / "ground.json")
    request = {"schema": "projection-loom/editor-proposal", "editor": "cli",
               "actor": "operator", "bundle_sha256": state["scene_sha256"],
               "observed_frontier": list(ground.frontier),
               "transaction": "support-group",
               "edits": [{"kind": "translate", "entity_id": "lower", "delta": [0, 0, 0]},
                         {"kind": "translate", "entity_id": "upper", "delta": [1, 0, 0]}]}
    with pytest.raises(ValueError, match="share an exact rigid delta"):
        edit_workspace(supported, request, tmp_path / "refused")



def test_two_real_bearings_reparent_through_complete_immutable_location(tmp_path):
    from projection_loom.native_support import propose_reparent
    inventory=LocationStack("held-out-parent-switch")
    inventory.add_frame(Frame("physical-local", "local3d", "m"))
    def part(name,width,translation):
        return {"entity_id":name,"translation":translation,"growth_program":{
            "nodes":[{"key":"root","op":"foundation","size":[width,3,2 if name!="bridge" else 1]}]}}
    document={"schema":"projection-loom/scene-declaration",
              "location":inventory.location_id,"meters_per_unit":1.,
              "assemblies":[part("old",3,[-2,0,0]),
                            part("new",3,[2,0,0]),
                            part("bridge",5,[0,0,2])]}
    root=tmp_path/"original"
    initial=create_workspace(inventory,document,root)
    ground=RelationalGround.load(root/"ground.json")
    attached=propose_support(ground,root/"scene","old","bridge")
    first=tmp_path/"old-bearer"
    supported=support_workspace(root,attached,first)
    current=RelationalGround.load(first/"ground.json")
    switch=propose_reparent(current,first/"scene","old","new","bridge")
    child=tmp_path/"replacement-bearing"
    final=support_workspace(first,switch,child)
    assert final["parent_workspace_sha256"]==supported["sha256"]
    assert final["scene_sha256"]==supported["scene_sha256"]==initial["scene_sha256"]
    assert verify_workspace(child)["valid"]
    new_ground=RelationalGround.load(child/"ground.json")
    assert {"parent":"new","child":"bridge",
            "verb":"supports","required":True} in new_ground.snapshot()["relations"]
    assert {"parent":"old","child":"bridge",
            "verb":"supports","required":True} not in new_ground.snapshot()["relations"]
    assert not switch["native_contact"]["load_certification"]
    with pytest.raises(ValueError,match="new causal island"):
        support_workspace(first,switch,child)
    receipt=child/"native-support-proposal.json"
    data=json.loads(receipt.read_text())
    data["prior_native_contact"]["native_contact_area"]+=1
    receipt.write_text(json.dumps(data))
    with pytest.raises(ValueError,match="receipt changed"):
        verify_workspace(child)
