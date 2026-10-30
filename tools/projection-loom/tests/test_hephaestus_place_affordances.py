"""N8-C: two native bearings are necessary; an open corridor is distinct."""
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,Walkway
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
from projection_loom.intent_seed import IntentContract
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place

def fixture(*,obstruction=False, deck_height=2):
    def body(name,size,shift):
        return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=size),)),shift)
    rows=[body("deck",(12,2,.5),(5,0,deck_height)),
          body("east",(4,4,2),(10,0,0)),
          body("west",(4,4,2),(0,0,0))]
    if obstruction:
        rows.append(body("obstacle",(1,1,2),(5,0,3)))
    genome=PlaceGenome(tuple(sorted(rows,key=lambda x:x.entity_id)),(Walkway("west","deck","east"),))
    intent=IntentContract("two-heights","Link two native sites",("crossing",))
    goal=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east",.8,1.1),),"operator")
    return genome,goal

def test_valid_deck_proves_two_bearings_and_bounded_empty_agent_corridor(tmp_path):
    genome,goal=fixture()
    package_scene(genome.declaration("two-heights"),tmp_path/"scene")
    evidence=assess_place(tmp_path/"scene",genome,goal)
    assert evidence["all_declared_goals_witnessed"]
    proof=evidence["goals"][0]["proof"]
    assert len(proof["bearing_sha256"])==2
    assert not proof["load_certification"] and not proof["accessibility_certification"]

def test_blocker_and_missing_bearing_do_not_create_false_connectivity(tmp_path):
    for name,genome in [("blocked",fixture(obstruction=True)[0]),
                        ("floating",fixture(deck_height=3)[0])]:
        package_scene(genome.declaration("two-heights"),tmp_path/name)
        report=assess_place(tmp_path/name,genome,fixture()[1])
        assert not report["all_declared_goals_witnessed"]
        assert report["goals"][0]["status"]=="unverified"

def test_unknown_kind_remains_unverified_even_if_scene_has_a_bridge(tmp_path):
    genome,goal=fixture()
    package_scene(genome.declaration("two-heights"),tmp_path/"scene")
    other=SpatialIntent(goal.intent_sha256,(SpatialGoal("shelter","west","east"),),"fire")
    report=assess_place(tmp_path/"scene",genome,other)
    assert not report["all_declared_goals_witnessed"]
    assert report["goals"][0]["status"]=="unverified"
