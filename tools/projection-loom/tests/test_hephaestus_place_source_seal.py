"""Original source bodies and relations survive the compositional YIN cut."""
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,Walkway,propose_from_spatial_intent
from projection_loom.place_source_seal import seal_constructive_growth,verify_constructive_growth
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent


def body(name,pos):
    return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),)),pos)


def test_growth_seal_preserves_original_bodies_on_native_crossing_birth():
    site=PlaceGenome((body("east",(10,0,0)),body("west",(0,0,0))))
    spatial=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),),"operator")
    born=propose_from_spatial_intent(site,spatial)
    seal=seal_constructive_growth(site,born)
    assert seal["preserved_original_bodies"]==["east","west"]
    assert len(seal["generated_body_ids"])==1
    assert len(seal["added_relations"]["walkways"])==1
    assert seal["original_bodies_rewritten"] is False
    assert verify_constructive_growth(site,born,seal)


def test_growth_seal_refuses_silent_edits_and_lost_relations():
    site=PlaceGenome((body("east",(10,0,0)),body("west",(0,0,0))))
    changed=PlaceGenome((body("east",(10,0,2)),site.bodies[1]))
    with pytest.raises(ValueError,match="replaced"):
        seal_constructive_growth(site,changed)
    with pytest.raises(ValueError,match="preserve"):
        seal_constructive_growth(site,PlaceGenome((site.bodies[0],body("new",(1,0,0)))))
    deck=body("deck",(5,0,2))
    original=PlaceGenome(tuple(sorted((*site.bodies,deck),key=lambda b:b.entity_id)),
                         (Walkway("west","deck","east"),))
    with pytest.raises(ValueError,match="discarded"):
        seal_constructive_growth(original,PlaceGenome(original.bodies))
