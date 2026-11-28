"""Typed region inheritance preserves independent native parents without silent cuts."""
import json
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,propose_from_spatial_intent
from projection_loom.place_recombination import recombine_place_regions,verify_place_recombination
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place


def seed():
    program=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",program,(10,0,0)),
                          PlaceBody("refuge",program,(25,25,0)),
                          PlaceBody("west",program,(0,0,0))))
    connect=SpatialGoal("connect","west","east")
    cover=SpatialGoal("shelter","refuge","roof")
    spatial=SpatialIntent("a"*64,(connect,cover),"operator")
    left=propose_from_spatial_intent(original,SpatialIntent("a"*64,(connect,),"operator"))
    right=propose_from_spatial_intent(original,SpatialIntent("a"*64,(cover,),"operator"))
    return original,left,right,spatial


def test_whole_relations_combine_without_transfer_of_parental_native_proof(tmp_path):
    original,left,right,spatial=seed()
    row=recombine_place_regions(original,left,right,spatial,
              left_generated=["intent_deck_000"],right_generated=["roof"])
    child=PlaceGenome.from_dict(row["child_genome"])
    assert len(child.walkways)==1
    assert len(child.bodies)==len(original.bodies)+2
    assert row["native_reaudition_required"] and not row["automatic_promotion"]
    assert verify_place_recombination(original,left,right,spatial,row)
    package_scene(child.declaration("recombined-place"),tmp_path/"scene")
    audit=assess_place(tmp_path/"scene",child,spatial)
    assert audit["all_declared_goals_witnessed"],audit


def test_recombination_requires_exact_generated_regions_and_parent_binding():
    original,left,right,spatial=seed()
    with pytest.raises(ValueError,match="sorted distinct"):
        recombine_place_regions(original,left,right,spatial,
                     left_generated=["intent_deck_000","intent_deck_000"],
                     right_generated=["roof"])
    row=recombine_place_regions(original,left,right,spatial,
                    left_generated=["intent_deck_000"],right_generated=["roof"])
    row["left_parent_sha256"]="0"*64
    with pytest.raises(ValueError,match="no longer follows"):
        verify_place_recombination(original,left,right,spatial,row)

def test_partial_inheritance_of_two_hop_native_route_is_refused():
    from projection_loom.place_orthogonal_route import propose_orthogonal_route
    original,_,right,_=seed()
    bodies=list(original.bodies)
    bodies[0]=PlaceBody("east",bodies[0].program,(10,10,0))
    source=PlaceGenome(tuple(bodies))
    connect=SpatialGoal("connect","west","east")
    cover=SpatialGoal("shelter","refuge","roof")
    aims=SpatialIntent("a"*64,(connect,cover),"operator")
    left=propose_orthogonal_route(source,
              SpatialIntent("a"*64,(connect,),"operator"),
              turn="x-then-y",corner_id="bend")
    right=propose_from_spatial_intent(source,
              SpatialIntent("a"*64,(cover,),"operator"))
    with pytest.raises(ValueError,match="sever"):
        recombine_place_regions(source,left,right,aims,
              left_generated=["bend"],right_generated=["roof"])
