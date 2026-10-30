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
