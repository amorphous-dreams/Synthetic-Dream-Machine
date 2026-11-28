"""N6-B: a real changed STEP bearing and causal support transfer publish together."""
import copy
import json
import pytest
from projection_loom.location_stack import Frame, LocationStack
from projection_loom.location_workspace import create_workspace, edit_workspace, support_workspace, verify_workspace
from projection_loom.relational_ground import RelationalGround
from projection_loom.native_support import propose_support


def fixture(tmp_path):
    inventory = LocationStack("n6-moving-bearing")
    inventory.add_frame(Frame("original", "local3d", "m"))
    def part(name, size, position):
        return {"entity_id": name, "translation": position, "growth_program": {
            "nodes": [{"key":"root", "op":"foundation", "size":size}]}}
    scene = {"schema":"projection-loom/scene-declaration",
             "location":inventory.location_id, "meters_per_unit":1.,
             "assemblies":[part("old", [4,4,2], [0,0,0]),
                           part("new", [4,4,2], [9,0,0]),
                           part("child", [2,2,1], [0,0,2]),
                           part("untouched", [2,2,2], [23,0,0])]}
    root=tmp_path/"root"
    create_workspace(inventory,scene,root)
    ground=RelationalGround.load(root/"ground.json")
    old=propose_support(ground,root/"scene","old","child")
    supported=tmp_path/"supported"
    manifest=support_workspace(root,old,supported)
    current=RelationalGround.load(supported/"ground.json")
    request={"schema":"projection-loom/editor-proposal", "editor":"cli",
             "actor":"operator", "bundle_sha256":manifest["scene_sha256"],
             "observed_frontier":list(current.frontier),
             "transaction":"support-transfer",
             "edits":[{"kind":"translate","entity_id":"child","delta":[9,0,0]}],
             "support_transfers":[{"child":"child","old_parent":"old","new_parent":"new"}]}
    return supported, request


def test_atomic_movement_and_reparent_have_distinct_old_new_native_proofs(tmp_path):
    supported, request=fixture(tmp_path)
    dest=tmp_path/"changed"
    result=edit_workspace(supported,request,dest)
    assert verify_workspace(dest)["valid"]
    assert (dest/"editor-source-scene"/"manifest.json").is_file()
    rec=json.loads((dest/"revision"/"reconciliation.json").read_text())
    assert rec["transaction_mode"]=="support-transfer"
    assert len(rec["causal_batch"]["operations"])==2
    assert rec["invalidation_plan"]["actual_cache_reuse"]==3
    assert rec["invalidation_plan"]["native_reaudited"]==1
    proof=rec["support_transfers"][0]
    assert proof["before"]["scene_sha256"]==request["bundle_sha256"]
    assert proof["after"]["scene_sha256"]==result["scene_sha256"]
    after=RelationalGround.load(dest/"revision"/"ground.json").snapshot()
    assert {"parent":"new","child":"child","verb":"supports","required":True} in after["relations"]
    assert not any(r["parent"]=="old" and r["child"]=="child" for r in after["relations"])
    assert verify_workspace(supported)["valid"]
    copy=dest/"editor-source-scene"/"manifest.json"
    copy.write_text(copy.read_text().replace('"location":', '"corrupt_location":', 1))
    with pytest.raises(ValueError):
        verify_workspace(dest)


def test_transfer_refuses_missing_new_contact_and_authored_intent(tmp_path):
    source, good=fixture(tmp_path)
    bad=copy.deepcopy(good)
    bad["edits"][0]["delta"]=[20,0,0]
    target=tmp_path/"invalid"
    with pytest.raises(ValueError):
        edit_workspace(source,bad,target)
    assert not (target/"manifest.json").exists()
    assert (target/"FAILED").is_file()
    assert verify_workspace(source)["valid"]
    bad=copy.deepcopy(good)
    bad["support_transfers"][0]["old_parent"]="untouched"
    with pytest.raises(ValueError,match="existing required bearing"):
        edit_workspace(source,bad,tmp_path/"bad-old")
