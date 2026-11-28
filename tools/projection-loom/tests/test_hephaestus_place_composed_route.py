"""A single operator bend composes with independently authored shelter."""
import copy
import json
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody,unique_walkway_chain
from projection_loom.place_composed_route import compose_operator_route,verify_composed_operator_route
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal


def original():
    root=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    return PlaceGenome((PlaceBody("east",root,(10,10,0)),
                        PlaceBody("west",root,(0,0,0))))


def authored():
    return SpatialIntent("a"*64,(
        SpatialGoal("connect","west","east"),
        SpatialGoal("shelter","west","roof")),"operator")


def test_operator_bend_and_shelter_grow_one_proposal_without_automatic_winner():
    site=original()
    spatial=authored()
    before=site.to_dict()
    row=compose_operator_route(site,spatial,goal_index=0,
                               turn="x-then-y",corner_id="landing")
    child=PlaceGenome.from_dict(row["proposed_genome"])
    assert child.identity==row["proposed_genome_sha256"]
    assert len(unique_walkway_chain(child,"west","east"))==2
    assert any(b.entity_id=="roof" for b in child.bodies)
    assert site.to_dict()==before
    assert row["source_preserving_growth"]["preserved_original_bodies"]==["east","west"]
    assert row["native_audition_completed"] is False
    assert verify_composed_operator_route(site,spatial,row)
    tampered=copy.deepcopy(row)
    tampered["operator_selected_turn"]="y-then-x"
    with pytest.raises(ValueError,match="differs"):
        verify_composed_operator_route(site,spatial,tampered)


def test_unrequested_diagonal_route_does_not_silently_infer_an_operator_turn():
    site=original()
    with pytest.raises(ValueError,match="connect goal"):
        compose_operator_route(site,authored(),goal_index=1,
                               turn="x-then-y",corner_id="landing")
    with pytest.raises(ValueError,match="choose"):
        compose_operator_route(site,authored(),goal_index=0,
                               turn="auto",corner_id="landing")
