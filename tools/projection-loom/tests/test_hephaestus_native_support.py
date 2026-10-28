"""Audited geometric support: exact BRep contact, never load certification."""
from copy import deepcopy
import json
import pytest
from projection_loom.scene_usd import package_scene
from projection_loom.editor_proposals import seed_editor_ground
from projection_loom.native_support import (
    native_support, propose_support, verify_support_proposal)


def declaration(z=2, x=0):
    return {"schema":"projection-loom/scene-declaration",
            "location":"independent-contact-village","meters_per_unit":1.0,
            "assemblies":[
                {"entity_id":"lower","growth_program":{"nodes":[
                    {"key":"root","op":"foundation","size":[5,5,2]}]}},
                {"entity_id":"upper","translation":[x,0,z],"growth_program":{"nodes":[
                    {"key":"root","op":"foundation","size":[3,3,1]}]}}]}


def test_true_native_face_bearing_and_causal_relation(tmp_path):
    authored=declaration()
    folder=tmp_path/"native"
    package_scene(authored,folder)
    proof=native_support(folder,"lower","upper")
    assert proof["native_distance"] < 1e-5
    assert abs(proof["signed_vertical_gap"]) < 1e-5
    assert proof["xy_contact_bound"] > 8
    assert proof["contact_kind"]=="native-BRep-geometric-bearing-only"
    assert proof["load_certification"] is False
    prior=seed_editor_ground(authored)
    offered=propose_support(prior,folder,"lower","upper")
    assert offered["operator_promotion"] is False
    assert verify_support_proposal(offered,prior,folder)["valid"]
    assert prior.snapshot()["relations"]==[]  # source left immutable
    from projection_loom.relational_ground import RelationalGround
    new=RelationalGround.from_dict(offered["next_ground"])
    assert {"parent":"lower","child":"upper",
            "verb":"supports","required":True} in new.snapshot()["relations"]
    assert new.snapshot()["entities"]["upper"]["invalidated"]


def test_noncontact_gap_penetration_and_side_only_refused(tmp_path):
    for name, authored, reason in [
        ("floating",declaration(z=8),"gap or penetration"),
        ("penetrating",declaration(z=1.2),"gap or penetration"),
        ("edge",declaration(z=2,x=4),"footprint overlap")]:
        folder=tmp_path/name
        package_scene(authored,folder)
        with pytest.raises(ValueError,match=reason):
            native_support(folder,"lower","upper")


def test_support_replay_refuses_tampered_bundle_and_causal_receipt(tmp_path):
    document=declaration()
    folder=tmp_path/"native"
    package_scene(document,folder)
    original=seed_editor_ground(document)
    recorded=propose_support(original,folder,"lower","upper")
    changed=deepcopy(recorded)
    changed["native_contact"]["load_certification"]=True
    with pytest.raises(ValueError,match="digest changed"):
        verify_support_proposal(changed,original,folder)
    patch=folder/"generated.usda"
    patch.write_text(patch.read_text()+"\n# unapproved change\n")
    with pytest.raises(ValueError,match="digest mismatch"):
        verify_support_proposal(recorded,original,folder)
