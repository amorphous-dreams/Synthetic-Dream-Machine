"""N8-D: an intent held constant across native, source and aftermath."""
import pytest
from projection_loom.place_campaign import run_place_campaign, verify_place_campaign
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack, Frame
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
    inventory=LocationStack("place-study")
    inventory.add_frame(Frame("authored-local","local3d","model_unit"))
    return inventory,intent,goal,genome

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

def test_accepted_operator_place_continues_with_archived_source_and_native_parent(tmp_path):
    from projection_loom.place_campaign import continue_place_campaign,review_place_candidate
    data=setup()
    first=tmp_path/"first"
    prior=run_place_campaign(*data,first,epochs=1,offspring=1,exact_budget=1)
    selected=prior["candidates"][0]["candidate_id"]
    accepted=tmp_path/"accepted.json"
    review_place_candidate(first,selected,actor="operator",decision="accept",
                           reason="Hold this native crossing",destination=accepted)
    second=tmp_path/"second"
    summary=continue_place_campaign(first,accepted,data[1],data[2],second,
                                   epochs=1,offspring=1,exact_budget=1)
    assert summary["admitted"]>=1
    assert (second/"parent-native-workspace"/"manifest.json").exists()
    assert verify_place_campaign(second)==summary
    (second/"parent-native-workspace"/"manifest.json").write_text("{}")
    with pytest.raises(ValueError):
        verify_place_campaign(second)

def test_abstention_cannot_be_reinterpreted_as_operator_selection(tmp_path):
    from projection_loom.place_campaign import continue_place_campaign,review_place_candidate
    data=setup()
    first=tmp_path/"first"
    report=run_place_campaign(*data,first,epochs=1,offspring=1,exact_budget=1)
    review=tmp_path/"abstain.json"
    review_place_candidate(first,report["candidates"][0]["candidate_id"],
                           actor="operator",decision="abstain",reason="",destination=review)
    with pytest.raises(ValueError,match="operator-accepted"):
        continue_place_campaign(first,review,data[1],data[2],tmp_path/"forbidden",
                                epochs=1,offspring=1,exact_budget=1)

def test_source_free_implicit_frame_cannot_claim_native_location(tmp_path):
    _,intent,goal,genome=setup()
    with pytest.raises(ValueError,match="explicitly authored local3d"):
        run_place_campaign(LocationStack(intent.location),intent,goal,genome,
                           tmp_path/"no-frame",epochs=1,offspring=1,exact_budget=1)
    assert not (tmp_path/"no-frame").exists()

def test_immutable_grammar_source_survives_external_modification_without_promotion(tmp_path):
    from projection_loom.intent_seed import SeedEntry,SeedBundle
    from projection_loom.location_stack import Frame
    source=tmp_path/"authored-grammar.json"
    source.write_text('{"proposed_construction":"one crossing"}')
    _,intent,goal,genome=setup()
    entry=SeedEntry.from_file("constructive-grammar",source)
    inventory=LocationStack.admit_seed_bundle(SeedBundle((entry,)),intent)
    inventory.add_frame(Frame("authored-local","local3d","model_unit"))
    target=tmp_path/"source-place"
    report=run_place_campaign(inventory,intent,goal,genome,target,
                              epochs=1,offspring=1,exact_budget=1)
    assert report["admitted"]==1
    native=target/"candidates"/report["candidates"][0]["candidate_id"]/"workspace"
    assert any((native/"sources").iterdir())
    import json
    pre=json.loads((target/"pre_registration.json").read_text())
    assert pre["source_evidence_scope"]=="original-file-bytes-matched-no-survey-certificate"
    source.write_text('{"proposed_construction":"changed after audit"}')
    assert verify_place_campaign(target)==report
    with pytest.raises(ValueError,match="Source bytes disagree with hash"):
        run_place_campaign(inventory,intent,goal,genome,tmp_path/"corrupt-followup",
                           epochs=1,offspring=1,exact_budget=1)
    assert not (tmp_path/"corrupt-followup").exists()

def test_two_native_builds_keep_distinct_digest_bound_receipts(tmp_path):
    import json
    inputs=setup()
    target=tmp_path/"double-build"
    report=run_place_campaign(*inputs,target,epochs=1,offspring=1,exact_budget=1)
    item=report["candidates"][0]
    assert item["status"]=="admitted"
    assert item["initial_affordances"]["all_declared_goals_witnessed"]
    assert item["affordances"]["native_scene_sha256"]==json.loads(
        (target/"candidates"/item["candidate_id"]/"workspace"/"scene"/"manifest.json").read_text())["sha256"]
    assert verify_place_campaign(target)==report

def test_spatial_archive_uses_observed_route_not_part_count_for_qualities(tmp_path):
    from projection_loom.place_campaign import observed_place_descriptor
    original,_,spatial,genome=setup()
    folder=tmp_path/"observations"
    summary=run_place_campaign(original,_,spatial,genome,folder,
                               epochs=1,offspring=1,exact_budget=1)
    row=summary["candidates"][0]
    descriptor=observed_place_descriptor(genome,row["affordances"])
    assert row["descriptor"]==descriptor
    assert descriptor["max_native_route_hops"]==1
    assert descriptor["walkway_count"]==1
    assert descriptor["architectural_fitness_claim"] is None
    assert descriptor["artistic_fitness_claim"] is None
    assert summary["spatial_niches"]==1

def test_tampered_spatial_niche_cannot_promote_an_artistically_unrelated_elite(tmp_path):
    import json
    inputs=setup()
    study=tmp_path/"native"
    report=run_place_campaign(*inputs,study,epochs=1,offspring=1,exact_budget=1)
    item=report["candidates"][0]
    receipt=study/"candidates"/item["candidate_id"]/"receipt.json"
    doctored=json.loads(receipt.read_text())
    doctored["descriptor"]["niche"]=[8,8,8,2]
    receipt.write_text(json.dumps(doctored))
    with pytest.raises(ValueError):
        verify_place_campaign(study)

def test_native_place_runner_uses_same_single_runner_lease_as_generalized(tmp_path):
    from projection_loom.fractal_ooda_ha import single_runner
    inputs=setup()
    dest=tmp_path/"concurrent-place"
    sibling=tmp_path/".concurrent-place.session.json"
    with single_runner(sibling):
        with pytest.raises(RuntimeError,match="already has a runner"):
            run_place_campaign(*inputs,dest,epochs=1,offspring=1,exact_budget=1)
    assert not dest.exists()
    report=run_place_campaign(*inputs,dest,epochs=1,offspring=1,exact_budget=1)
    assert report["admitted"]==1
    assert run_place_campaign(*inputs,dest,epochs=1,offspring=1,exact_budget=1)==report
    assert not (tmp_path/".concurrent-place.session.runlock").exists()

def test_incomplete_native_campaign_stays_failed_after_single_runner_unlock(tmp_path):
    inputs=setup()
    out=tmp_path/"incomplete"
    out.mkdir()
    (out/"FAILED").write_text("a crashed earlier writer")
    with pytest.raises(ValueError,match="Incomplete or occupied"):
        run_place_campaign(*inputs,out,epochs=1,offspring=1,exact_budget=1)
    assert (out/"FAILED").exists()
    assert not (tmp_path/".incomplete.session.runlock").exists()

def test_relational_emitter_deferral_is_explicit_and_replayable(tmp_path):
    import json
    data=setup()
    root=tmp_path/"relational"
    report=run_place_campaign(*data,root,epochs=2,offspring=2,exact_budget=1,
                              prefer_emitter="relational-recombination")
    assert verify_place_campaign(root)==report
    front=json.loads((root/"frontiers"/"epoch_001.json").read_text())
    assert front["operator_preferred_emitter"]=="relational-recombination"
    assert all(row["emitter_receipt"]["candidate_genome_sha256"]==row["genome_sha256"]
               for row in front["offered"])
    assert any(row["emitter_receipt"]["proposal_deferral"]
               for row in front["offered"])
    assert all(not row["emitter_receipt"]["operator_accepted"] for row in front["offered"])


def test_study_replay_refuses_forged_emitter_parentage(tmp_path):
    import json
    data=setup()
    root=tmp_path/"genetic"
    run_place_campaign(*data,root,epochs=1,offspring=1,exact_budget=1)
    path=root/"frontiers"/"epoch_000.json"
    front=json.loads(path.read_text())
    front["offered"][0]["emitter_receipt"]["emitter"]="relational-recombination"
    path.write_text(json.dumps(front))
    with pytest.raises(ValueError,match="frontier diverged"):
        verify_place_campaign(root)

def test_relational_census_derives_real_auditions_and_abstentions(tmp_path):
    import json
    from projection_loom.place_campaign import relational_emission_census
    data=setup()
    root=tmp_path/"census"
    summary=run_place_campaign(*data,root,epochs=2,offspring=2,exact_budget=1,
                               prefer_emitter="relational-recombination")
    frontiers=[json.loads((root/"frontiers"/f"epoch_{epoch:03d}.json").read_text())
               for epoch in range(2)]
    census=relational_emission_census(frontiers,summary["candidates"])
    assert summary["relational_emissions"]==census
    assert census["all_offered"]==4 and census["native_attempts"]==2
    assert census["relational_offered"]==0
    assert census["relational_native_admitted"]==0
    assert census["proposal_deferrals"]==1
    assert census["region_pairs_considered_in_proposals"]==0
    assert census["region_pairs_refused_before_birth"]==0
    assert not census["automatic_artistic_winner"]
    assert verify_place_campaign(root)==summary


def test_relational_census_tamper_is_not_silent(tmp_path):
    import json
    data=setup()
    root=tmp_path/"tampered-census"
    run_place_campaign(*data,root,epochs=1,offspring=1,exact_budget=1)
    path=root/"summary.json"
    row=json.loads(path.read_text())
    row["relational_emissions"]["native_attempts"]=0
    path.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="Relational birth/refusal census"):
        verify_place_campaign(root)

def test_two_native_witnessed_variants_can_supply_breeding_without_invented_niches(tmp_path):
    from projection_loom.place_campaign import relational_emission_census
    data=setup()
    folder=tmp_path/"two-parent"
    result=run_place_campaign(*data,folder,epochs=2,offspring=2,
                              exact_budget=2,seed=8,
                              prefer_emitter="relational-recombination")
    assert verify_place_campaign(folder)==result
    census=result["relational_emissions"]
    assert census["relational_offered"]+census["proposal_deferrals"]>=1
    assert census["relational_native_attempted"]<=result["attempted"]
    assert census["distinct_admitted_recombinants"]<=census["relational_native_admitted"]
    assert census["automatic_artistic_winner"] is False


def test_diagonal_source_topology_campaign_preserves_replay_and_exact_budget(tmp_path):
    import json
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    source=PlaceGenome((PlaceBody("east",p,(12,12,0)),
                        PlaceBody("west",p,(0,0,0))))
    intent=IntentContract("diagonal-place","Native multi-hop inheritance",("circulation",))
    spatial=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east"),),"operator")
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("authored-local","local3d","model_unit"))
    out=tmp_path/"topology-native"
    summary=run_place_campaign(inventory,intent,spatial,source,out,
        epochs=2,offspring=3,exact_budget=1,seed=12,prefer_emitter="topology-birth")
    assert summary["offered"]==6
    assert summary["attempted"]==2
    assert summary["deferred"]==4
    assert summary["relational_emissions"]["topology_offered"]==1
    assert summary["relational_emissions"]["topology_native_attempted"]==1
    front=json.loads((out/"frontiers"/"epoch_001.json").read_text())
    assert front["offered"][1]["emitter"]=="topology-birth"
    assert front["audition_order"]==["p001c001"]
    assert verify_place_campaign(out)==summary
    tampered=json.loads((out/"frontiers"/"epoch_001.json").read_text())
    tampered["offered"][1]["emitter_receipt"]["ancestors"][0]["tested_patterns"]=8
    (out/"frontiers"/"epoch_001.json").write_text(json.dumps(tampered))
    with pytest.raises(ValueError,match="frontier diverged"):
        verify_place_campaign(out)


def test_diagonal_source_requires_explicit_topology_steering(tmp_path):
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    site=PlaceGenome((PlaceBody("east",p,(12,12,0)),
                      PlaceBody("west",p,(0,0,0))))
    intent=IntentContract("diagonal-refusal","Preserve authored diagonal site",("connect",))
    spatial=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east"),),"operator")
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("authored-local","local3d","model_unit"))
    with pytest.raises(ValueError,match="axis-aligned equally elevated"):
        run_place_campaign(inventory,intent,spatial,site,tmp_path/"ordinary",
                           epochs=2,offspring=3,exact_budget=1,seed=12)
    assert not (tmp_path/"ordinary").exists()
