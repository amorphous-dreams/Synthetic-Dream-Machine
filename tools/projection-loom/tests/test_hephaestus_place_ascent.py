"""Rising stair claims require exact STEP face adjacency, not a preview mesh."""
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody,AscentRun
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place,verify_place_affordances


def stair(*,gap=False,huge_step=False):
    def block(name,x,height):
        growth=GrowthProgram((GrowthNode("root","foundation",size=(3,3,height)),))
        return PlaceBody(name,growth,(x,0,0))
    bodies=(block("begin",0.,1.),block("tread1",3.,1.4),
            block("tread2",7. if gap else 6.,2.8 if huge_step else 1.8),
            block("summit",9.,2.2))
    genome=PlaceGenome(tuple(sorted(bodies,key=lambda b:b.entity_id)),(),
                        (AscentRun("begin",("tread1","tread2"),"summit"),))
    intent=SpatialIntent("a"*64,(SpatialGoal("ascend","begin","summit",.9,.6),),"operator")
    return genome,intent


def test_native_stair_has_side_faces_and_bounded_step_rises(tmp_path):
    genome,intent=stair()
    package_scene(genome.declaration("stairsite"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,intent)
    assert result["all_declared_goals_witnessed"],result
    proof=result["goals"][0]["proof"]
    assert len(proof["edge_contacts"])==3
    assert proof["total_native_rise"]>1
    assert not proof["accessibility_certification"] and not proof["load_certification"]
    assert verify_place_affordances(tmp_path/"scene",genome,intent,result)


@pytest.mark.parametrize("params",[{"gap":True},{"huge_step":True}])
def test_broken_or_excessive_native_steps_refuse_ascent(tmp_path,params):
    genome,intent=stair(**params)
    package_scene(genome.declaration("stairsite"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,intent)
    assert not result["all_declared_goals_witnessed"]

def test_ascent_campaign_records_native_treads_not_implicit_walkway(tmp_path):
    from projection_loom.place_campaign import run_place_campaign,observed_place_descriptor
    from projection_loom.intent_seed import IntentContract
    from projection_loom.location_stack import LocationStack,Frame
    genome,old=stair()
    intent=IntentContract("stairsite","Rise between authored native elevations",("ascent",))
    goal=SpatialIntent(intent.identity,old.goals,"operator")
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("author-local","local3d","model_unit"))
    summary=run_place_campaign(inventory,intent,goal,genome,tmp_path/"study",
                               epochs=1,offspring=1,exact_budget=1)
    assert summary["admitted"]==1
    native=summary["candidates"][0]
    assert native["descriptor"]["ascent_witness_count"]==1
    assert native["descriptor"]["max_native_route_hops"]==0
    assert native["descriptor"]["native_ascent_risers"][0]["risers"]==3
