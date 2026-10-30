"""N9-B: attributed bearing means exact STEP contact, not engineered load."""
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place,verify_place_affordances
import pytest


def fixture(*,roof_z=2.):
    root=lambda dims:GrowthProgram((GrowthNode("root","foundation",size=dims),))
    genome=PlaceGenome((PlaceBody("base",root((4,4,2)),(0,0,0)),
                        PlaceBody("cap",root((3,3,.5)),(0,0,roof_z))))
    goal=SpatialIntent("a"*64,(SpatialGoal("bear","base","cap",.8,1.1),),"operator")
    return genome,goal


def test_native_bearing_evidence_reimports_two_exact_support_faces(tmp_path):
    genome,goal=fixture()
    package_scene(genome.declaration("bearing-site"),tmp_path/"native")
    report=assess_place(tmp_path/"native",genome,goal)
    assert report["all_declared_goals_witnessed"],report
    proof=report["goals"][0]["proof"]
    assert proof["native_contact"]["native_contact_area"]>.05
    assert not proof["load_certification"] and not proof["automatic_promotion"]
    assert verify_place_affordances(tmp_path/"native",genome,goal,report)


def test_noncontacting_floor_cannot_claim_support(tmp_path):
    genome,goal=fixture(roof_z=4.)
    package_scene(genome.declaration("bearing-site"),tmp_path/"native")
    report=assess_place(tmp_path/"native",genome,goal)
    assert not report["all_declared_goals_witnessed"]
    assert report["goals"][0]["status"]=="unverified"


def test_bearing_enters_a_replayable_native_place_without_load_claim(tmp_path):
    from projection_loom.intent_seed import IntentContract
    from projection_loom.location_stack import LocationStack,Frame
    from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
    native,original=fixture()
    intent=IntentContract("bearing-site","Preserve exact contact",("bear",))
    spatial=SpatialIntent(intent.identity,original.goals,"operator")
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("operator-local","local3d","model_unit"))
    study=tmp_path/"study"
    report=run_place_campaign(inventory,intent,spatial,native,study,
                              epochs=1,offspring=1,exact_budget=1)
    assert report["admitted"]==1
    assert report["candidates"][0]["descriptor"]["bearing_witness_count"]==1
    assert report["candidates"][0]["descriptor"]["artistic_fitness_claim"] is None
    assert verify_place_campaign(study)==report


def test_fire_can_bind_bearing_without_granting_load_authority():
    from projection_loom.fire_spatial import bind_fire_spatial
    from projection_loom.intent_seed import IntentContract
    from projection_loom.provenance_encoding import canonical_json_sha256
    native,old=fixture()
    intent=IntentContract("bearing-site","Native bearings only",("bear",))
    body={"schema":"projection-loom/fire-bound-plan",
          "source_witness_id":"contact-original",
          "seed_entity_sha256":None,"location":intent.location,
          "resolved":{"a":"base","b":"cap"},
          "alternatives":[{"id":"bearing-one","relation":"bears",
                           "implementation":"bearing-column",
                           "subject":"a","object":"b"}]}
    plan={**body,"sha256":canonical_json_sha256(body)}
    result=bind_fire_spatial(plan,intent,native,alternative_id="bearing-one",
             source_witness_id="contact-original",authored_by="operator")
    assert result["spatial_intent"]["goals"][0]["kind"]=="bear"
    assert not result["automatic_promotion"]
