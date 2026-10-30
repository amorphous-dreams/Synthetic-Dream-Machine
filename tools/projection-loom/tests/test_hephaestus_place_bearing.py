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
