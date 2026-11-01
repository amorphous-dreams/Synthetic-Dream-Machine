"""Same offered genomes; operator changes finite native audition order."""
import pytest
from test_hephaestus_place_campaign import setup
from projection_loom.place_campaign import run_place_campaign,verify_place_campaign,select_place_auditions


def test_explicit_preference_changes_budgeted_native_candidate_not_source(tmp_path):
    initial=tmp_path/"initial"
    mutation=tmp_path/"mutation"
    inputs=setup()
    a=run_place_campaign(*inputs,initial,epochs=1,offspring=2,
                         exact_budget=1,seed=17,prefer_emitter="initial")
    b=run_place_campaign(*inputs,mutation,epochs=1,offspring=2,
                         exact_budget=1,seed=17,prefer_emitter="mutation")
    assert a["attempted"]==b["attempted"]==1
    assert a["offered"]==b["offered"]==2
    assert a["candidates"][0]["candidate_id"]=="p000c000"
    assert b["candidates"][0]["candidate_id"]=="p000c001"
    assert a["candidates"][0]["genome_sha256"]!=b["candidates"][0]["genome_sha256"]
    assert verify_place_campaign(initial)==a
    assert verify_place_campaign(mutation)==b
    with pytest.raises(ValueError,match="Re-entry changes"):
        run_place_campaign(*inputs,initial,epochs=1,offspring=2,
                          exact_budget=1,seed=17,prefer_emitter="mutation")


def test_shared_unimplemented_emitter_must_not_silently_claim_steering():
    offered=[("first","a"),("next","b")]
    with pytest.raises(ValueError,match="supports only"):
        select_place_auditions(offered,1,"sobol")
    assert select_place_auditions(offered,1,"mutation",epoch=0)==[("next","b")]
    assert select_place_auditions(offered,1,"initial",epoch=0)==[("first","a")]
    # An unavailable relational emitter cannot synthesize a native parent;
    # steering applies only to actual source-bound offers.
    receipts={"first":{"emitter":"initial"},"next":{"emitter":"relational-recombination"}}
    assert select_place_auditions(offered,1,"relational-recombination",
                                  epoch=1,emitter_receipts=receipts)==[("next","b")]
    assert select_place_auditions(offered,1,"relational-recombination",
                                  epoch=1,emitter_receipts={
                                  "first":{"emitter":"initial"},
                                  "next":{"emitter":"mutation"}})==[("first","a")]

def test_forged_preferred_frontier_order_fails_independent_replay(tmp_path):
    import json
    original,intent,spatial,genome=setup()
    root=tmp_path/"native"
    result=run_place_campaign(original,intent,spatial,genome,root,
                              epochs=1,offspring=2,exact_budget=1,seed=17,
                              prefer_emitter="mutation")
    location=root/"frontiers"/"epoch_000.json"
    forged=json.loads(location.read_text())
    assert forged["audition_order"]==["p000c001"]
    forged["audition_order"]=["p000c000"]
    location.write_text(json.dumps(forged))
    with pytest.raises(ValueError,match="proposal frontier diverged"):
        verify_place_campaign(root)


def test_empty_emitter_list_retains_initial_as_unadorned_default():
    assert select_place_auditions([("first","a"),("next","b")],1,None,
                                  epoch=0)==[("first","a")]
