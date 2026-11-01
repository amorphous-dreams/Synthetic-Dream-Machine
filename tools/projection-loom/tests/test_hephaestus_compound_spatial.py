"""N9: multiple original goals cannot silently conflict or trade authority."""
import json
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody,propose_from_spatial_intent
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack,Frame
from projection_loom.place_affordances import assess_place,verify_place_affordances
from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
from projection_loom.scene_usd import package_scene

def combined():
    def body(name,size,position):
        return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",
                                        size=size),)),position)
    original=PlaceGenome((body("begin",(3.,3.,1.),(0.,0.,0.)),
                          body("summit",(3.,3.,2.2),(9.,0.,0.))))
    intent=IntentContract("combined-site","Cover the starting stair landing",
                          ("ascending","cover"))
    spatial=SpatialIntent(intent.identity,(
        SpatialGoal("ascend","begin","summit",.9,.6),
        SpatialGoal("shelter","begin","roof",.9,1.1)),"operator")
    return original,intent,spatial


def test_shared_ground_can_witness_both_real_step_rise_and_cover(tmp_path):
    original,intent,spatial=combined()
    generated=propose_from_spatial_intent(original,spatial)
    assert generated.ascents and any(b.entity_id=="roof" for b in generated.bodies)
    assert generated.identity!=original.identity
    package_scene(generated.declaration(intent.location),tmp_path/"scene")
    report=assess_place(tmp_path/"scene",generated,spatial)
    assert report["all_declared_goals_witnessed"],report
    assert {x["status"] for x in report["goals"]}=={
        "geometric-ascent-proposal","geometric-shelter-proposal"}
    assert verify_place_affordances(tmp_path/"scene",generated,spatial,report)
    source=LocationStack(intent.location)
    source.add_frame(Frame("authored-native","local3d","model_unit"))
    result=run_place_campaign(source,intent,spatial,original,tmp_path/"study",
                               epochs=1,offspring=1,exact_budget=1)
    assert result["admitted"]==1
    assert result["candidates"][0]["descriptor"]["ascent_witness_count"]==1
    assert result["candidates"][0]["descriptor"]["shelter_witness_count"]==1
    assert verify_place_campaign(tmp_path/"study")==result


def test_one_failed_goal_prevents_fake_joint_acceptance(tmp_path):
    original,intent,spatial=combined()
    generated=propose_from_spatial_intent(original,spatial)
    changed=[]
    for body in generated.bodies:
        if body.entity_id=="roof":
            changed.append(PlaceBody("roof",body.program,(30.,0.,body.translation[2])))
        else:
            changed.append(body)
    wrong=PlaceGenome(tuple(changed),generated.walkways,generated.ascents)
    package_scene(wrong.declaration(intent.location),tmp_path/"scene")
    evidence=assess_place(tmp_path/"scene",wrong,spatial)
    assert not evidence["all_declared_goals_witnessed"]
    assert evidence["goals"][0]["status"]=="geometric-ascent-proposal"
    assert evidence["goals"][1]["status"]=="unverified"

def test_compound_roof_keeps_authored_central_refuge_core_covered():
    original,_,spatial=combined()
    generated=propose_from_spatial_intent(original,spatial)
    floor=next(b for b in generated.bodies if b.entity_id=="begin")
    roof=next(b for b in generated.bodies if b.entity_id=="roof")
    width=next(g.min_width for g in spatial.goals if g.kind=="shelter")
    span=roof.program.nodes[0].size[0]
    left=roof.translation[0]-span/2
    right=roof.translation[0]+span/2
    assert left<=floor.translation[0]-width/2
    assert right>=floor.translation[0]+width/2
    assert roof.translation[0]<floor.translation[0]  # protects ascent side
