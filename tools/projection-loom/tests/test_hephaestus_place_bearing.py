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


def test_intent_grows_separate_column_and_proves_both_native_bearings(tmp_path):
    from projection_loom.place_genome import propose_from_spatial_intent
    from projection_loom.intent_seed import IntentContract
    from projection_loom.location_stack import LocationStack,Frame
    from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
    original,old=fixture(roof_z=4.)
    contract=IntentContract("bearing-site","Give a raised roof native contact",("bearing",))
    goal=SpatialIntent(contract.identity,old.goals,"operator")
    child=propose_from_spatial_intent(original,goal)
    assert len(child.bearings)==1 and len(child.bodies)==3
    assert child.bearings[0].lower=="base" and child.bearings[0].upper=="cap"
    assert propose_from_spatial_intent(child,goal)==child
    package_scene(child.declaration(contract.location),tmp_path/"native")
    proof=assess_place(tmp_path/"native",child,goal)
    assert proof["all_declared_goals_witnessed"],proof
    assert proof["goals"][0]["proof"]["contact_count"]==2
    assert not proof["goals"][0]["proof"]["load_certification"]
    source=LocationStack(contract.location)
    source.add_frame(Frame("local-author","local3d","model_unit"))
    study=tmp_path/"study"
    result=run_place_campaign(source,contract,goal,original,study,
                              epochs=1,offspring=1,exact_budget=1)
    assert result["admitted"]==1
    assert result["candidates"][0]["descriptor"]["native_bearings"][0][
        "native_contact_count"]==2
    assert verify_place_campaign(study)==result


def test_laterally_misaligned_original_roof_refuses_column_birth():
    from projection_loom.place_genome import propose_from_spatial_intent
    original,goal=fixture(roof_z=4.)
    cap=next(x for x in original.bodies if x.entity_id=="cap")
    base=next(x for x in original.bodies if x.entity_id=="base")
    moved=PlaceBody("cap",cap.program,(2,0,4))
    displaced=PlaceGenome(tuple(sorted((base,moved),key=lambda x:x.entity_id)))
    with pytest.raises(ValueError,match="aligned authored footprints"):
        propose_from_spatial_intent(displaced,goal)


def test_intent_grows_supported_canopy_without_blocking_center_refuge(tmp_path):
    from projection_loom.place_genome import propose_from_spatial_intent
    from projection_loom.intent_seed import IntentContract
    floor=PlaceBody("floor",GrowthProgram((GrowthNode("root","foundation",
                   size=(4,4,1)),)),(0,0,0))
    roof=PlaceBody("roof",GrowthProgram((GrowthNode("root","foundation",
                   size=(5,5,.4)),)),(0,0,4))
    original=PlaceGenome((floor,roof))
    intent=IntentContract("shelter-with-bearing","A sheltered and physically grounded court",
                          ("bearing","cover"))
    goals=SpatialIntent(intent.identity,(
        SpatialGoal("bear","floor","roof",.8,1.1),
        SpatialGoal("shelter","floor","roof",.8,1.1)), "operator")
    created=propose_from_spatial_intent(original,goals)
    assert len(created.bodies)==3 and len(created.bearings)==1
    package_scene(created.declaration(intent.location),tmp_path/"joint")
    evidence=assess_place(tmp_path/"joint",created,goals)
    assert evidence["all_declared_goals_witnessed"],evidence
    statuses={row["status"] for row in evidence["goals"]}
    assert statuses=={"geometric-bearing-proposal","geometric-shelter-proposal"}
    cover=next(x["proof"] for x in evidence["goals"]
               if x["status"]=="geometric-shelter-proposal")
    assert cover["clear_core_floor_area"]==.64
    assert cover["intrusions"]==0
    assert not cover["load_certification"] and not cover["occupancy_certification"]
