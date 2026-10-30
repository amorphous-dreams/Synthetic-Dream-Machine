"""Two distinct authored corner choices, each independently proven by STEP."""
import copy
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_orthogonal_route import (propose_orthogonal_route,
  orthogonal_route_receipt,verify_orthogonal_route_receipt)
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place,verify_place_affordances


def site():
    prog=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    source=PlaceGenome((PlaceBody("east",prog,(10,10,0)),
                        PlaceBody("west",prog,(0,0,0))))
    goal=SpatialIntent("a"*64,(SpatialGoal("connect","west","east",.8,1.1),),"operator")
    return source,goal


def test_each_explicit_right_angle_has_two_independent_native_legs(tmp_path):
    original,goal=site()
    identities=[]
    for kind in ("x-then-y","y-then-x"):
        created=propose_orthogonal_route(original,goal,turn=kind,corner_id="landing")
        assert len(created.bodies)==5 and len(created.walkways)==2
        package_scene(created.declaration("right-angle"),tmp_path/kind)
        evidence=assess_place(tmp_path/kind,created,goal)
        assert evidence["all_declared_goals_witnessed"],evidence
        assert evidence["goals"][0]["proof"]["hops"]==2
        assert verify_place_affordances(tmp_path/kind,created,goal,evidence)
        receipt=orthogonal_route_receipt(original,goal,turn=kind,corner_id="landing")
        assert verify_orthogonal_route_receipt(original,goal,receipt)
        identities.append(receipt["result_genome_sha256"])
    assert identities[0]!=identities[1]
    assert len(original.bodies)==2 and not original.walkways


def test_explicit_route_never_invents_operator_corner_or_a_false_native_witness():
    original,goal=site()
    with pytest.raises(ValueError,match="must choose"):
        propose_orthogonal_route(original,goal,turn="auto",corner_id="landing")
    with pytest.raises(ValueError,match="corner name"):
        propose_orthogonal_route(original,goal,turn="x-then-y",corner_id="west")
    report=orthogonal_route_receipt(original,goal,turn="x-then-y",corner_id="landing")
    doctored=copy.deepcopy(report)
    doctored["operator_bend_direction"]="y-then-x"
    with pytest.raises(ValueError,match="no longer matches"):
        verify_orthogonal_route_receipt(original,goal,doctored)
    assert report["native_audition_completed"] is False
