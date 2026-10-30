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

def test_native_affordance_cannot_replay_from_tampered_witness(tmp_path):
    genome,goal=fixture()
    package_scene(genome.declaration("two-heights"),tmp_path/"scene")
    from projection_loom.place_affordances import verify_place_affordances
    report=assess_place(tmp_path/"scene",genome,goal)
    assert verify_place_affordances(tmp_path/"scene",genome,goal,report)
    report["goals"][0]["proof"]["native_clearance_obstructions"]=9
    with pytest.raises(ValueError,match="differ from native"):
        verify_place_affordances(tmp_path/"scene",genome,goal,report)

def test_north_south_native_bridge_uses_same_independent_contact_gate(tmp_path):
    from projection_loom.place_genome import propose_from_spatial_intent
    genome,goal=fixture()
    north=PlaceBody("north",genome.bodies[1].program,(0,10,0))
    south=PlaceBody("south",genome.bodies[2].program,(0,0,0))
    pair=PlaceGenome((north,south))
    intent=SpatialIntent(goal.intent_sha256,(SpatialGoal("connect","south","north"),),"operator")
    proposed=propose_from_spatial_intent(pair,intent)
    package_scene(proposed.declaration("two-heights"),tmp_path/"ns")
    evidence=assess_place(tmp_path/"ns",proposed,intent)
    assert evidence["all_declared_goals_witnessed"]
    assert evidence["goals"][0]["proof"]["principal_axis"]=="y"

def test_two_witnessed_walkway_segments_connect_three_independent_sites(tmp_path):
    from projection_loom.place_genome import unique_walkway_chain
    base,_=fixture()
    root=base.bodies[1].program
    west=PlaceBody("west",root,(0,0,0))
    middle=PlaceBody("middle",root,(10,0,0))
    east=PlaceBody("east",root,(20,0,0))
    deck=base.bodies[0].program
    bridge1=PlaceBody("deck1",deck,(5,0,2))
    bridge2=PlaceBody("deck2",deck,(15,0,2))
    genome=PlaceGenome(tuple(sorted((west,middle,east,bridge1,bridge2),
                                   key=lambda b:b.entity_id)),
                      (Walkway("middle","deck2","east"),
                       Walkway("west","deck1","middle")))
    # The test's author chooses a single two-hop route; no inferred shortcut.
    intent=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),),"operator")
    assert len(unique_walkway_chain(genome,"west","east"))==2
    package_scene(genome.declaration("three-sites"),tmp_path/"route")
    result=assess_place(tmp_path/"route",genome,intent)
    assert result["all_declared_goals_witnessed"]
    assert result["goals"][0]["proof"]["hops"]==2
    assert len(result["goals"][0]["proof"]["segments"])==2

def test_competing_paths_refuse_unsolicited_semantic_shortcut():
    from projection_loom.place_genome import unique_walkway_chain
    genome,_=fixture()
    extra=PlaceBody("deck2",genome.bodies[0].program,(5,.5,2))
    two=PlaceGenome(tuple(sorted((*genome.bodies,extra),key=lambda x:x.entity_id)),
                    (Walkway("west","deck","east"),Walkway("west","deck2","east")))
    with pytest.raises(ValueError,match="Competing"):
        unique_walkway_chain(two,"west","east")

def test_two_hop_witness_does_not_accept_a_forged_middle_bearing(tmp_path):
    from projection_loom.place_affordances import verify_place_affordances
    from projection_loom.place_genome import unique_walkway_chain
    base,_=fixture()
    root=base.bodies[1].program
    make=lambda name,program,x:PlaceBody(name,program,(x,0,0 if name in ("west","middle","east") else 2))
    bodies=(make("west",root,0),make("middle",root,10),make("east",root,20),
            PlaceBody("deck1",base.bodies[0].program,(5,0,2)),
            PlaceBody("deck2",base.bodies[0].program,(15,0,2)))
    genome=PlaceGenome(tuple(sorted(bodies,key=lambda x:x.entity_id)),
                       (Walkway("middle","deck2","east"),
                        Walkway("west","deck1","middle")))
    intent=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),),"operator")
    package_scene(genome.declaration("route-integrity"),tmp_path/"scene")
    actual=assess_place(tmp_path/"scene",genome,intent)
    assert actual["all_declared_goals_witnessed"]
    actual["goals"][0]["proof"]["segments"][1]["bearing_sha256"][0]="0"*64
    with pytest.raises(ValueError,match="differ"):
        verify_place_affordances(tmp_path/"scene",genome,intent,actual)
