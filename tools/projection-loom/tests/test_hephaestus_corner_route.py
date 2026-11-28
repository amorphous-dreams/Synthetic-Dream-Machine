"""An explicitly authored corner requires two separate exact native bridges."""
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody,propose_from_spatial_intent
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack,Frame
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place,verify_place_affordances
from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
import pytest


def authored_corner():
    root=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",root,(10,0,0)),
                          PlaceBody("north",root,(10,10,0)),
                          PlaceBody("west",root,(0,0,0))))
    intent=IntentContract("corner-site","A bent route connects two separated sites",
                          ("a-route","two-native-bearings"))
    spatial=SpatialIntent(intent.identity,(
        SpatialGoal("connect","east","north",.9,1.1),
        SpatialGoal("connect","west","east",.9,1.1),
        SpatialGoal("connect","west","north",.9,1.1)),"operator")
    return original,intent,spatial


def test_orthogonal_authorial_segments_resolve_unique_diagonal_connection(tmp_path):
    original,intent,spatial=authored_corner()
    constructed=propose_from_spatial_intent(original,spatial)
    assert len(constructed.walkways)==2
    assert len(constructed.bodies)==5
    assert constructed==propose_from_spatial_intent(constructed,spatial)
    package_scene(constructed.declaration(intent.location),tmp_path/"native")
    report=assess_place(tmp_path/"native",constructed,spatial)
    assert report["all_declared_goals_witnessed"],report
    assert report["goals"][-1]["proof"]["hops"]==2
    assert verify_place_affordances(tmp_path/"native",constructed,spatial,report)
    source=LocationStack(intent.location)
    source.add_frame(Frame("authored-local","local3d","model_unit"))
    trial=run_place_campaign(source,intent,spatial,original,tmp_path/"campaign",
                             epochs=1,offspring=1,exact_budget=1)
    assert trial["admitted"]==1
    assert verify_place_campaign(tmp_path/"campaign")==trial


def test_diagonal_without_authored_waypoint_still_refuses(tmp_path):
    original,intent,_=authored_corner()
    lone=SpatialIntent(intent.identity,
        (SpatialGoal("connect","west","north"),),"operator")
    with pytest.raises(ValueError,match="axis-aligned"):
        propose_from_spatial_intent(original,lone)
