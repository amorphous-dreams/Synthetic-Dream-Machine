"""N9-S: horizontally covered native space differs from safe occupancy."""
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place,verify_place_affordances


def fixture(*,roof_x=0.,roof_z=4.,interloper=False):
    program=lambda dims: GrowthProgram((GrowthNode("root","foundation",size=dims),))
    bodies=[PlaceBody("floor",program((4,4,1)),(0,0,0)),
            PlaceBody("roof",program((5,5,.4)),(roof_x,0,roof_z))]
    if interloper:
        bodies.append(PlaceBody("blocker",program((.6,.6,1)),(0,0,2)))
    return (PlaceGenome(tuple(sorted(bodies,key=lambda r:r.entity_id))),
            SpatialIntent("a"*64,(SpatialGoal("shelter","floor","roof",1.,1.),),
                          "operator"))


def test_native_cover_witness_reimports_actual_roof_and_floor_faces(tmp_path):
    genome,goal=fixture()
    package_scene(genome.declaration("covered-place"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,goal)
    assert result["all_declared_goals_witnessed"]
    proof=result["goals"][0]["proof"]
    assert proof["native_planar_cover_area"]>=4.
    assert proof["headroom_height"]>=1.8
    assert not proof["weather_certification"] and not proof["load_certification"]
    assert verify_place_affordances(tmp_path/"scene",genome,goal,result)


@pytest.mark.parametrize("settings",[
    {"roof_x":20.},{"roof_z":1.1},{"interloper":True}])
def test_offset_crushed_or_obstructed_roof_never_becomes_shelter(tmp_path,settings):
    genome,goal=fixture(**settings)
    package_scene(genome.declaration("covered-place"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,goal)
    assert not result["all_declared_goals_witnessed"]
    assert result["goals"][0]["proof"] is None

def test_shelter_campaign_inherits_native_cover_without_pretending_route(tmp_path):
    from projection_loom.place_campaign import run_place_campaign,observed_place_descriptor
    from projection_loom.intent_seed import IntentContract
    from projection_loom.location_stack import LocationStack,Frame
    genome,spatial=fixture()
    intent=IntentContract("covered-place","An overhead refuge",("overhead-cover",))
    spatial=SpatialIntent(intent.identity,spatial.goals,"operator")
    source=LocationStack(intent.location)
    source.add_frame(Frame("authored-local","local3d","model_unit"))
    result=run_place_campaign(source,intent,spatial,genome,tmp_path/"study",
                              epochs=2,offspring=1,exact_budget=1,seed=17)
    assert result["admitted"]>=1
    first=next(x for x in result["candidates"] if x["status"]=="admitted")
    described=observed_place_descriptor(genome,first["affordances"])
    assert described["shelter_witness_count"]==1
    assert described["max_native_route_hops"]==0
    assert described["artistic_fitness_claim"] is None
