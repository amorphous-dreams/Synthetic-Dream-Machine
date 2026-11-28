"""Original obligations survive YIN composition, ordering and replay."""
import copy
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,propose_from_spatial_intent
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
from projection_loom.place_obligations import plan_spatial_obligations,verify_spatial_obligations


def root(name,position):
    return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=(3,3,1)),)),position)


def test_shelter_materializes_before_later_bearing_even_when_author_order_differs():
    genome=PlaceGenome((root("floor",(0,0,0)),root("side",(9,0,0))))
    goal=SpatialIntent("a"*64,(
        SpatialGoal("bear","floor","canopy"),
        SpatialGoal("connect","floor","side"),
        SpatialGoal("shelter","floor","canopy")),"operator")
    plan=plan_spatial_obligations(genome,goal)
    assert [r["goal_index"] for r in plan["ordered_goals"]]==[1,2,0]
    assert plan["ordered_goals"][-1]["requires_goal_indices"]==[2]
    assert verify_spatial_obligations(genome,goal,plan)
    assert plan["composition_restriction_coheres"]
    assert plan["native_audition_completed"] is False
    changed=copy.deepcopy(plan)
    changed["ordered_goals"][0]["goal_sha256"]="0"*64
    with pytest.raises(ValueError,match="diverged"):
        verify_spatial_obligations(genome,goal,changed)


def test_dependency_cycle_and_competing_native_producers_refuse():
    genome=PlaceGenome((root("floor",(0,0,0)),root("side",(9,0,0))))
    conflict=SpatialIntent("a"*64,(
        SpatialGoal("shelter","floor","roof"),
        SpatialGoal("shelter","side","roof")),"operator")
    with pytest.raises(ValueError,match="Competing shelter"):
        plan_spatial_obligations(genome,conflict)
    cycle=SpatialIntent("a"*64,(
        SpatialGoal("shelter","a","b"),SpatialGoal("shelter","b","a")),"operator")
    with pytest.raises(ValueError,match="cycle"):
        plan_spatial_obligations(genome,cycle)


def test_existing_source_holds_no_fabricated_dependency():
    genome=PlaceGenome((root("east",(10,0,0)),root("west",(0,0,0))))
    intent=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),),"operator")
    before=genome.to_dict()
    plan=plan_spatial_obligations(genome,intent)
    after=propose_from_spatial_intent(genome,intent)
    assert plan["ordered_goals"][0]["requires_goal_indices"]==[]
    assert after.identity!=genome.identity and genome.to_dict()==before
