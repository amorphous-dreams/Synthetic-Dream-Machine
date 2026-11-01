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

def test_intent_causes_missing_canopy_birth_from_authorized_floor(tmp_path):
    from projection_loom.place_genome import propose_from_spatial_intent
    from projection_loom.intent_seed import IntentContract
    from projection_loom.location_stack import LocationStack,Frame
    from projection_loom.place_campaign import run_place_campaign
    floor=next(x for x in fixture()[0].bodies if x.entity_id=="floor")
    spare=PlaceBody("other",floor.program,(15,0,0))
    original=PlaceGenome((floor,spare))
    intent=IntentContract("covered-place","Raise shelter over floor",("cover",))
    goal=SpatialIntent(intent.identity,(SpatialGoal("shelter","floor","roof",1.,1.),),
                       "operator")
    generated=propose_from_spatial_intent(original,goal)
    assert len(generated.bodies)==3 and "roof" in {x.entity_id for x in generated.bodies}
    assert generated.identity!=original.identity
    assert propose_from_spatial_intent(generated,goal)==generated
    source=LocationStack(intent.location)
    source.add_frame(Frame("authored-local","local3d","model_unit"))
    summary=run_place_campaign(source,intent,goal,original,tmp_path/"study",
                               epochs=1,offspring=1,exact_budget=1)
    assert summary["admitted"]==1
    assert summary["candidates"][0]["affordances"]["goals"][0]["status"]=="geometric-shelter-proposal"


def test_canopy_intent_does_not_replace_an_existing_native_roof():
    from projection_loom.place_genome import propose_from_spatial_intent
    genome,goal=fixture(roof_x=20)
    assert propose_from_spatial_intent(genome,goal)==genome

def test_same_original_site_intents_make_different_native_construction_claims(tmp_path):
    from projection_loom.place_genome import propose_from_spatial_intent
    from projection_loom.intent_seed import IntentContract
    floor=next(x for x in fixture()[0].bodies if x.entity_id=="floor")
    other=PlaceBody("other",floor.program,(15,0,0))
    original=PlaceGenome((floor,other))
    intent=IntentContract("covered-place","Choose a native relation",("cover","crossing"))
    shelter=SpatialIntent(intent.identity,(SpatialGoal("shelter","floor","roof"),),"operator")
    crossing=SpatialIntent(intent.identity,(SpatialGoal("connect","floor","other"),),"operator")
    roof=propose_from_spatial_intent(original,shelter)
    bridge=propose_from_spatial_intent(original,crossing)
    assert roof.identity!=bridge.identity
    assert {body.entity_id for body in roof.bodies}!={body.entity_id for body in bridge.bodies}
    for name,genome,spatial in (("roof",roof,shelter),("bridge",bridge,crossing)):
        package_scene(genome.declaration("covered-place"),tmp_path/name)
        result=assess_place(tmp_path/name,genome,spatial)
        assert result["all_declared_goals_witnessed"],result


def test_native_shelter_core_uses_explicit_width_not_entire_roof_footprint(tmp_path):
    genome,goal=fixture()
    package_scene(genome.declaration("covered-place"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,goal)
    assert result["all_declared_goals_witnessed"]
    proof=result["goals"][0]["proof"]
    assert proof["clear_core_width"]==pytest.approx(goal.goals[0].min_width)
    assert proof["clear_core_floor_area"]==pytest.approx(goal.goals[0].min_width**2)
    assert proof["native_planar_cover_area"]>proof["clear_core_floor_area"]
    assert proof["scope"]=="horizontal-roof-over-bounded-clear-core-only"
    assert not proof["occupancy_certification"]
