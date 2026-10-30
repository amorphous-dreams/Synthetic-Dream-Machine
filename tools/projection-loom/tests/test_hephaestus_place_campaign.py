"""N8-D: an intent held constant across native, source and aftermath."""
import pytest
from projection_loom.place_campaign import run_place_campaign, verify_place_campaign
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_genome import PlaceGenome,PlaceBody,Walkway

def setup():
    def body(name,size,p):
        return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=size),)),p)
    genome=PlaceGenome((body("deck",(12,2,.5),(5,0,2)),
                        body("east",(4,4,2),(10,0,0)),
                        body("west",(4,4,2),(0,0,0))),
                       (Walkway("west","deck","east"),))
    intent=IntentContract("place-study","Cross between the heights",("crossing",))
    goal=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east"),),"operator")
    return LocationStack("place-study"),intent,goal,genome

def test_spatial_campaign_has_native_locations_and_exact_ooda_ha_reentry(tmp_path):
    inputs=setup()
    out=tmp_path/"study"
    summary=run_place_campaign(*inputs,out,epochs=2,offspring=2,exact_budget=1,seed=8)
    assert summary["attempted"]==2 and summary["deferred"]==2
    assert summary["admitted"]>=1
    assert summary["operator_winner"] is None
    assert verify_place_campaign(out)==summary
    assert run_place_campaign(*inputs,out,epochs=2,offspring=2,exact_budget=1,seed=8)==summary
    with pytest.raises(ValueError,match="Re-entry changes"):
        run_place_campaign(*inputs,out,epochs=2,offspring=2,exact_budget=1,seed=9)

def test_unimplemented_goal_cannot_be_credited_as_built(tmp_path):
    inventory,intent,_,genome=setup()
    goal=SpatialIntent(intent.identity,(SpatialGoal("shelter","west","east"),),"operator")
    result=run_place_campaign(inventory,intent,goal,genome,tmp_path/"shelter",
                              epochs=1,offspring=1,exact_budget=1)
    assert result["admitted"]==0
    assert result["candidates"][0]["status"]=="spatial-unverified"

def test_review_requires_explicit_operator_choice_and_valid_witness(tmp_path):
    from projection_loom.place_campaign import review_place_candidate
    data=setup()
    out=tmp_path/"reviewable"
    result=run_place_campaign(*data,out,epochs=1,offspring=1,exact_budget=1)
    ident=next(row["candidate_id"] for row in result["candidates"]
               if row["status"]=="admitted")
    record=review_place_candidate(out,ident,actor="operator",decision="accept",
             reason="Retain this walkable-corridor proposal for future authored work",
             destination=tmp_path/"decision.json")
    assert record["review"]["automatic_canon_promotion"] is False
    assert record["automatic_next_epoch"] is False
    assert record["genome_path"].endswith("genome.json")
    with pytest.raises(ValueError,match="uniquely named"):
        review_place_candidate(out,"invented",actor="operator",decision="accept",
             reason="",destination=tmp_path/"wrong.json")

def test_intent_births_a_walkway_from_two_sites_not_a_fixed_seed(tmp_path):
    inventory,intent,goal,whole=setup()
    source=PlaceGenome(whole.bodies[1:],())
    summary=run_place_campaign(inventory,intent,goal,source,tmp_path/"intent-birth",
                               epochs=1,offspring=1,exact_budget=1)
    assert summary["admitted"]==1
    assert summary["candidates"][0]["affordances"]["all_declared_goals_witnessed"]
    assert source.walkways==()
