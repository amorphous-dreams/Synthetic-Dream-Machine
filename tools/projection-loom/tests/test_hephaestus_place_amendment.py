"""N9 intentional continuation: place acceptance alone never authorizes changed aim."""
import pytest
from projection_loom.intent_seed import IntentContract
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_amendment import author_place_amendment,verify_place_amendment


def prior():
    intent=IntentContract("place","Keep a crossing",("crossing",))
    goal=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east"),),"operator")
    pre={"schema":"projection-loom/place-preregistration","location":"place",
         "run_id":"a"*64,"intent_sha256":intent.identity,
         "spatial_intent_sha256":goal.identity}
    return pre,intent,goal


def test_prior_approval_is_not_permission_to_silently_change_intent():
    pre,intent,goal=prior()
    new=IntentContract("place","Find refuge",("shelter",))
    updated=SpatialIntent(new.identity,(SpatialGoal("shelter","west","roof"),),"operator")
    with pytest.raises(ValueError,match="explicit"):
        verify_place_amendment(None,pre,new,updated)
    receipt=author_place_amendment(pre,new,updated,actor="operator",
                                   reason="Try a roof without erasing the prior crossing")
    assert verify_place_amendment(receipt,pre,new,updated)
    assert not receipt["automatic_artistic_promotion"]
    altered=dict(receipt,reason="changed after authorship")
    with pytest.raises(ValueError,match="diverges"):
        verify_place_amendment(altered,pre,new,updated)
    with pytest.raises(ValueError,match="Unchanged"):
        author_place_amendment(pre,intent,goal,actor="operator",reason="not needed")


def test_amendment_retains_original_site_and_required_actor():
    pre,_,_=prior()
    moved=IntentContract("another","Retarget",("cover",))
    goal=SpatialIntent(moved.identity,(SpatialGoal("shelter","west","roof"),),"operator")
    with pytest.raises(ValueError,match="different original location"):
        author_place_amendment(pre,moved,goal,actor="operator",reason="retarget")
    with pytest.raises(ValueError,match="attributable"):
        author_place_amendment(pre,IntentContract("place","Retarget",("cover",)),
                              SpatialIntent(IntentContract("place","Retarget",("cover",)).identity,
                              (SpatialGoal("shelter","west","roof"),),"operator"),
                              actor="",reason="retarget")


def test_accepted_native_place_can_only_change_aim_with_separate_amendment(tmp_path):
    from test_hephaestus_place_campaign import setup
    from projection_loom.place_campaign import (
        run_place_campaign,review_place_candidate,continue_place_campaign,
        verify_place_campaign)
    source,intent,spatial,genome=setup()
    first=tmp_path/"first"
    prior=run_place_campaign(source,intent,spatial,genome,first,
                             epochs=1,offspring=1,exact_budget=1)
    chosen=prior["candidates"][0]["candidate_id"]
    receipt=tmp_path/"accept.json"
    review_place_candidate(first,chosen,actor="operator",decision="accept",
                           reason="Keep native crossing",destination=receipt)
    new_intent=IntentContract(intent.location,"Keep crossing but change artistic aim",
                              tuple(sorted((*intent.objectives,"new-intention"))))
    next_goal=SpatialIntent(new_intent.identity,spatial.goals,"operator")
    with pytest.raises(ValueError,match="explicit"):
        continue_place_campaign(first,receipt,new_intent,next_goal,tmp_path/"forbidden",
                                epochs=1,offspring=1,exact_budget=1)
    import json
    amendment=author_place_amendment(
        json.loads((first/"pre_registration.json").read_text()),new_intent,next_goal,
        actor="operator",reason="Retain the native route for a different design study")
    inherited=tmp_path/"changed"
    summary=continue_place_campaign(first,receipt,new_intent,next_goal,inherited,
                              epochs=1,offspring=1,exact_budget=1,amendment=amendment)
    assert summary["admitted"]>=1
    assert verify_place_campaign(inherited)==summary
    original_prelude=json.loads((first/"pre_registration.json").read_text())
    assert original_prelude["intent_sha256"]==intent.identity
    assert original_prelude["spatial_intent_sha256"]==spatial.identity


def test_amendment_cli_keeps_accepted_place_and_new_purpose_distinct(tmp_path):
    from test_hephaestus_place_campaign import setup
    from projection_loom.place_campaign import run_place_campaign
    from projection_loom.cli import main
    import json
    source,intent,spatial,genome=setup()
    prior=tmp_path/"original"
    run_place_campaign(source,intent,spatial,genome,prior,
                       epochs=1,offspring=1,exact_budget=1)
    amended=IntentContract(intent.location,"Additional operator purpose",
                           tuple(sorted((*intent.objectives,"amended"))))
    goal=SpatialIntent(amended.identity,spatial.goals,"operator")
    contract_path=tmp_path/"intent.json"
    spatial_path=tmp_path/"spatial.json"
    contract_path.write_text(json.dumps({
        "location":amended.location,"aim":amended.aim,
        "objectives":list(amended.objectives),
        "invariants":list(amended.invariants),
        "budgets":[list(x) for x in amended.budgets]}))
    spatial_path.write_text(json.dumps(goal.to_dict()))
    target=tmp_path/"amendment.json"
    output=main(["place-amend","--campaign",str(prior),
        "--intent",str(contract_path),"--spatial",str(spatial_path),
        "--actor","operator","--reason","Change the design context",
        "--out",str(target)])
    assert json.loads(target.read_text())==output
    assert verify_place_amendment(output,
        json.loads((prior/"pre_registration.json").read_text()),
        amended,goal)
