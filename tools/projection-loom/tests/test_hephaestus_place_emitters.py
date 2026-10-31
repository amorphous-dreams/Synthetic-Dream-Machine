"""One helm receives deterministic regional births and explicit YIN deferrals."""
from projection_loom.place_emitters import emit_place_child,generated_components
from projection_loom.place_genome import PlaceBody,PlaceGenome,propose_from_spatial_intent
from projection_loom.developmental import GrowthProgram,GrowthNode
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal


def inputs():
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",p,(10,0,0)),
                          PlaceBody("refuge",p,(25,25,0)),
                          PlaceBody("west",p,(0,0,0))))
    spatial=SpatialIntent("a"*64,(
         SpatialGoal("connect","west","east"),
         SpatialGoal("shelter","refuge","roof")),"operator")
    resolved=propose_from_spatial_intent(original,spatial)
    return original,resolved,spatial


def test_proposals_hold_complete_parent_regions_and_repeat_identically():
    original,resolved,spatial=inputs()
    # Each independently admitted parent's goal-specific generated members
    # stay source-preserving; different shapes create distinct identities.
    from dataclasses import replace
    def change(entity,scale):
        bodies=[]
        for body in resolved.bodies:
            if body.entity_id==entity:
                nodes=list(body.program.nodes)
                root=nodes[0]
                nodes[0]=replace(root,size=(root.size[0]*scale,
                                           root.size[1],root.size[2]))
                body=replace(body,program=GrowthProgram(tuple(nodes)))
            bodies.append(body)
        return PlaceGenome(tuple(bodies),resolved.walkways,resolved.ascents,resolved.bearings)
    left=change("intent_deck_000",1.05)
    right=change("roof",1.08)
    archive=[{"candidate_id":"p000c000","genome":left,"workspace_sha256":"a"*64},
             {"candidate_id":"p000c001","genome":right,"workspace_sha256":"b"*64}]
    assert generated_components(original,resolved)==[("intent_deck_000",),("roof",)]
    params={"epoch":1,"index":1,"offspring":2,"seed":13}
    first,receipt=emit_place_child(original,resolved,archive,spatial,**params)
    repeated,again=emit_place_child(original,resolved,archive,spatial,**params)
    assert receipt==again and first.identity==repeated.identity
    assert receipt["emitter"]=="relational-recombination"
    assert first.identity not in (left.identity,right.identity)
    assert len(first.walkways)==1
    assert receipt["ancestors"][0]["automatic_operator_acceptance"] is False
    assert receipt["ancestors"][0]["eligible_region_pair_count"]>=1
    assert receipt["ancestors"][0]["child_is_distinct_from_both_parents"]
    assert receipt["ancestors"][0]["tested_region_pair_count"]<=receipt["ancestors"][0]["eligible_region_pair_count"]
    assert receipt["ancestors"][0]["left_native_workspace_sha256"]=="a"*64


def test_missing_parents_become_explicit_mutation_deferral():
    original,resolved,spatial=inputs()
    child,receipt=emit_place_child(original,resolved,[],spatial,
                                   epoch=1,index=1,offspring=2,seed=13)
    assert child.identity
    assert receipt["emitter"]=="mutation"
    assert "two distinct native-admitted parents" in receipt["recombination_deferral"]
    assert receipt["native_audition_completed"] is False

def test_missing_native_workspace_parent_cannot_enter_region_birth():
    original,resolved,spatial=inputs()
    archive=[{"candidate_id":"p000c000","genome":resolved},
             {"candidate_id":"p000c001","genome":resolved.vary_spatial(spatial,2)}]
    _,record=emit_place_child(original,resolved,archive,spatial,
                              epoch=1,index=1,offspring=2,seed=13)
    assert record["emitter"]=="mutation"
    assert "parent lacks independently witnessed native workspace" in record["recombination_deferral"]

def test_identical_architecture_cannot_be_rebranded_as_successful_recombination():
    # Distinct parent identities alone do not prove a third architectural
    # genotype. A redundant merge must defer to an actual mutation.
    from dataclasses import replace
    original,resolved,spatial=inputs()
    def scale_deck(factor):
        bodies=[]
        for body in resolved.bodies:
            if body.entity_id=="intent_deck_000":
                node=body.program.nodes[0]
                revised=replace(node,size=(node.size[0]*factor,*node.size[1:]))
                body=replace(body,program=GrowthProgram((revised,)))
            bodies.append(body)
        return PlaceGenome(tuple(bodies),resolved.walkways,resolved.ascents,resolved.bearings)
    archive=[{"candidate_id":"p000c000","genome":scale_deck(1.02),
              "workspace_sha256":"a"*64},
             {"candidate_id":"p000c001","genome":scale_deck(1.04),
              "workspace_sha256":"b"*64}]
    _,receipt=emit_place_child(original,resolved,archive,spatial,
                               epoch=1,index=1,offspring=2,seed=23)
    assert receipt["emitter"]=="mutation"
    assert "alternatives refused" in receipt["recombination_deferral"]
    assert "generated child is identical to an admitted parent" in receipt["recombination_deferral"]
    assert receipt["native_audition_completed"] is False

def test_relational_search_preserves_the_first_refusal_then_tries_another_closed_region(monkeypatch):
    import projection_loom.place_emitters as emitters
    from dataclasses import replace
    original,resolved,spatial=inputs()
    def change(entity,scale):
        bodies=[]
        for body in resolved.bodies:
            if body.entity_id==entity:
                nodes=list(body.program.nodes)
                node=nodes[0]
                nodes[0]=replace(node,size=(node.size[0]*scale,*node.size[1:]))
                body=replace(body,program=GrowthProgram(tuple(nodes)))
            bodies.append(body)
        return PlaceGenome(tuple(bodies),resolved.walkways,resolved.ascents,resolved.bearings)
    archive=[{"candidate_id":"p000c000","genome":change("intent_deck_000",1.05),
              "workspace_sha256":"a"*64},
             {"candidate_id":"p000c001","genome":change("roof",1.08),
              "workspace_sha256":"b"*64}]
    original_recombine=emitters.recombine_place_regions
    seen=[]
    def bounded_recombine(*args,**kwargs):
        seen.append((tuple(kwargs["left_generated"]),tuple(kwargs["right_generated"])))
        if len(seen)==1:
            raise ValueError("first spatial relation set failed its source constraint")
        return original_recombine(*args,**kwargs)
    monkeypatch.setattr(emitters,"recombine_place_regions",bounded_recombine)
    child,row=emit_place_child(original,resolved,archive,spatial,
                              epoch=1,index=1,offspring=2,seed=13)
    assert child.identity
    assert row["emitter"]=="relational-recombination"
    ancestry=row["ancestors"][0]
    assert ancestry["tested_region_pair_count"]==2
    assert len(ancestry["rejected_region_alternatives"])==1
    assert ancestry["rejected_region_alternatives"][0]["reason"].startswith("first spatial relation")
    assert ancestry["accepted_pair_index"]!=ancestry["sampled_pair_index"]
    assert row["native_audition_completed"] is False


def test_topology_birth_enters_same_emitter_stream_without_native_claim():
    from projection_loom.place_genome import unique_walkway_chain
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",p,(12,12,0)),
                          PlaceBody("refuge",p,(30,30,0)),
                          PlaceBody("west",p,(0,0,0))))
    spatial=SpatialIntent("a"*64,(
        SpatialGoal("connect","west","east"),
        SpatialGoal("shelter","refuge","roof")),"operator")
    resolved=propose_from_spatial_intent(original,spatial)
    params=dict(epoch=1,index=1,offspring=3,seed=12)
    child,row=emit_place_child(original,resolved,[],spatial,**params)
    again,replay=emit_place_child(original,resolved,[],spatial,**params)
    assert row==replay and child.identity==again.identity
    assert row["emitter"]=="topology-birth"
    assert len(unique_walkway_chain(child,"west","east"))==3
    assert row["ancestors"][0]["source_genome_sha256"]==original.identity
    assert row["ancestors"][0]["spatial_intent_sha256"]==spatial.identity
    assert row["native_audition_completed"] is False
    assert row["operator_accepted"] is False


def test_topology_refusal_keeps_finite_mutation_fallback():
    original,resolved,spatial=inputs()
    child,row=emit_place_child(original,resolved,[],spatial,
                               epoch=1,index=1,offspring=3,seed=12)
    assert child.identity
    assert row["emitter"]=="mutation"
    assert "source-bound topology refused" in row["recombination_deferral"]
    assert row["native_audition_completed"] is False


def test_topology_birth_keeps_all_source_bodies_and_full_goal_scope():
    from projection_loom.place_source_seal import seal_constructive_growth
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",p,(12,12,0)),
                          PlaceBody("refuge",p,(30,30,0)),
                          PlaceBody("west",p,(0,0,0))))
    spatial=SpatialIntent("a"*64,(
        SpatialGoal("connect","west","east"),
        SpatialGoal("shelter","refuge","roof")),"operator")
    resolved=propose_from_spatial_intent(original,spatial)
    child,receipt=emit_place_child(original,resolved,[],spatial,
                                  epoch=2,index=1,offspring=3,seed=11)
    assert receipt["emitter"]=="topology-birth"
    assert seal_constructive_growth(original,child)["original_bodies_rewritten"] is False
    assert "roof" in {body.entity_id for body in child.bodies}
    assert receipt["ancestors"][0]["native_audition_completed"] is False
    assert receipt["sha256"]
    assert receipt["candidate_genome_sha256"]==child.identity


def test_topology_proposal_is_independent_of_unwitnessed_parent_archive():
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",p,(12,12,0)),
                          PlaceBody("refuge",p,(30,30,0)),
                          PlaceBody("west",p,(0,0,0))))
    spatial=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),),"operator")
    resolved=propose_from_spatial_intent(original,spatial)
    archive=[{"candidate_id":"unwitnessed","genome":resolved,
              "workspace_sha256":"not-native"}]
    a,first=emit_place_child(original,resolved,[],spatial,
                             epoch=1,index=1,offspring=3,seed=12)
    b,second=emit_place_child(original,resolved,archive,spatial,
                              epoch=1,index=1,offspring=3,seed=12)
    assert a.identity==b.identity
    assert first==second
    assert first["emitter"]=="topology-birth"
