"""Three-hop native topology grows a third independently audited circulation segment."""
import copy
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,unique_walkway_chain
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_three_hop import propose_three_hop_route,verify_three_hop_route
from projection_loom.place_affordances import assess_place
from projection_loom.scene_usd import package_scene


def authored():
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    site=PlaceGenome((PlaceBody("east",p,(12,12,0)),
                      PlaceBody("refuge",p,(30,30,0)),
                      PlaceBody("west",p,(0,0,0))))
    goal=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),
                                SpatialGoal("shelter","refuge","roof")),"operator")
    return site,goal


@pytest.mark.parametrize("pattern",["x-y-x","y-x-y"])
def test_three_native_segments_keep_complete_authored_goal_scope(tmp_path,pattern):
    site,spatial=authored()
    proposal=propose_three_hop_route(site,spatial,goal_index=0,
                                     pattern=pattern,corner_prefix="lane")
    child=PlaceGenome.from_dict(proposal["proposed_genome"])
    assert len(unique_walkway_chain(child,"west","east"))==3
    assert len(child.walkways)==3
    assert set(x.entity_id for x in site.bodies)<=set(x.entity_id for x in child.bodies)
    assert proposal["source_preserving_growth"]["original_bodies_rewritten"] is False
    assert not proposal["automatic_operator_selection"]
    assert verify_three_hop_route(site,spatial,proposal)
    root=tmp_path/pattern
    package_scene(child.declaration("three-hop-place"),root)
    native=assess_place(root,child,spatial)
    assert native["all_declared_goals_witnessed"],native["goals"]
    proof=native["goals"][0]["proof"]
    assert proof["hops"]==3
    assert [s["principal_axis"] for s in proof["segments"]]==pattern.split("-")


def test_three_hop_refuses_unselected_patterns_and_forged_waypoints():
    site,spatial=authored()
    with pytest.raises(ValueError,match="explicitly selected"):
        propose_three_hop_route(site,spatial,goal_index=0,
                                pattern="auto",corner_prefix="lane")
    proposal=propose_three_hop_route(site,spatial,goal_index=0,
                                     pattern="x-y-x",corner_prefix="lane")
    modified=copy.deepcopy(proposal)
    modified["intermediate_center_positions"][0][0]+=1
    with pytest.raises(ValueError,match="diverged"):
        verify_three_hop_route(site,spatial,modified)

def test_generated_waypoint_cannot_displace_original_authored_foundation():
    site,aim=authored()
    p=site.bodies[0].program
    blocked=PlaceGenome(tuple(sorted((*site.bodies,PlaceBody("barrier",p,(6,0,0))),
                                   key=lambda x:x.entity_id)))
    with pytest.raises(ValueError,match="intrudes into original native source barrier"):
        propose_three_hop_route(blocked,aim,goal_index=0,
                                pattern="x-y-x",corner_prefix="lane")
    assert propose_three_hop_route(blocked,aim,goal_index=0,
                                   pattern="y-x-y",corner_prefix="lane")["proposed_genome_sha256"]
