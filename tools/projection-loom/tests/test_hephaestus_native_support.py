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
    assert proof["native_contact_area"] == pytest.approx(9.0, abs=1e-7)
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


def test_native_planar_bearing_refuses_corner_tangency_despite_aabb_overlap():
    """A rotated sole touches a square roof at one vertex: no bearing area."""
    import cadquery as cq
    from projection_loom.native_support import _bearing_face_area, _bounds
    from OCP.BRepExtrema import BRepExtrema_DistShapeShape
    lower = cq.Workplane("XY").box(5, 5, 2).val()
    corner = 2.5 + (1.5 * (2**0.5)) / 2
    # The 45-degree sole has positive AABB overlap at a tangent point.
    upper = (cq.Workplane("XY").box(3, 3, 1).val()
             .rotate((0, 0, 0), (0, 0, 1), 45)
             .translate((corner, corner, 1.5)))
    a, b = _bounds(lower), _bounds(upper)
    aabb_area = (min(a[3], b[3]) - max(a[0], b[0])) * (
        min(a[4], b[4]) - max(a[1], b[1]))
    distance = BRepExtrema_DistShapeShape(lower.wrapped, upper.wrapped)
    distance.Perform()
    assert distance.IsDone() and distance.Value() < 1e-6
    assert aabb_area > 1
    actual = _bearing_face_area(lower, upper, a, b, b[2] - a[5], 0.001)
    assert actual < 0.05
    # A small genuine diagonal overlap still needs the required face area.
    overlap = upper.translate((-0.0606601718, -0.0606601718, 0))
    c = _bounds(overlap)
    actual_overlap = _bearing_face_area(lower, overlap, a, c, c[2] - a[5], 0.001)
    assert 0 < actual_overlap < 0.05


def test_native_planar_bearing_accepts_bounded_vertical_tolerance():
    import cadquery as cq
    from projection_loom.native_support import _bearing_face_area, _bounds
    lower = cq.Workplane("XY").box(5, 5, 2).val()
    upper = cq.Workplane("XY").box(3, 3, 1).val().translate((0, 0, 1.5005))
    a, b = _bounds(lower), _bounds(upper)
    area = _bearing_face_area(lower, upper, a, b, b[2] - a[5], 0.001)
    assert area == pytest.approx(9.0, abs=1e-7)
