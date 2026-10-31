"""YIN relational emitter for the existing place OODA-HA helm.

Archive admits native-witnessed parents; this function generates candidate
proposals without certifying a child or making an artistic choice. Every
result, including abstention from an unavailable cross-parent birth, carries
replayable source identities and exact producer selection.
"""
from __future__ import annotations
from .place_genome import PlaceGenome
from .place_recombination import recombine_place_regions, _handles
from .place_source_seal import seal_constructive_growth
from .provenance_encoding import canonical_json_sha256


def generated_components(source, parent):
    """Complete generated dependency regions; relations may not be severed."""
    seal=seal_constructive_growth(source,parent)
    generated=set(seal["generated_body_ids"])
    groups={name:{name} for name in generated}
    for field in ("walkways","ascents","bearings"):
        for rel in getattr(parent,field):
            involved=_handles(rel)&generated
            if not involved:
                continue
            merged=set().union(*(groups[name] for name in involved))
            for name in merged:
                groups[name]=merged
    return sorted({tuple(sorted(v)) for v in groups.values()})


def _cross_parent(source, archive, spatial, *, seed, epoch, index):
    if len(archive)<2:
        return None,"two distinct native-admitted parents have not appeared"
    # Only native admitted parents enter the archive, and their own source
    # ancestry remains explicit. No inferred consent for artistic promotion.
    left,right=archive[-2:]
    a,b=left["genome"],right["genome"]
    from re import fullmatch
    if any(not fullmatch(r"[0-9a-f]{64}",p.get("workspace_sha256","")) for p in (left,right)):
        return None,"parent lacks independently witnessed native workspace identity"
    if a.identity==b.identity:
        return None,"both admitted parents contain identical native genomes"
    try:
        lc=generated_components(source,a)
        rc=generated_components(source,b)
        possibilities=[(x,y) for x in lc for y in rc if not set(x)&set(y)]
        if not possibilities:
            return None,"parents hold no disjoint closed generated regions"
        # Explore multiple compatible regions without ranking artistic quality.
        options=sorted(possibilities,key=lambda pair:(pair[0],pair[1]))
        selection_index=(seed+epoch*10007+index*137)%len(options)
        tested=[]
        chosen=None
        for offset in range(len(options)):
            attempt_index=(selection_index+offset)%len(options)
            pair=options[attempt_index]
            try:
                possible=recombine_place_regions(source,a,b,spatial,
                        left_generated=list(pair[0]),right_generated=list(pair[1]))
                # Relational breeding must actually combine two distinct
                # parental contributions. Do not call a copied parent a birth.
                if possible["child_genome_sha256"] in (a.identity,b.identity):
                    raise ValueError("generated child is identical to an admitted parent")
                record=possible
                selected=pair
                chosen=attempt_index
                break
            except ValueError as exc:
                tested.append({"candidate_pair_index":attempt_index,
                               "reason":str(exc)})
        if chosen is None:
            return None,("all compatible source-bound region alternatives refused: "+
                         "; ".join(str(row["candidate_pair_index"])+": "+
                                   row["reason"] for row in tested))
    except ValueError as exc:
        return None,"source-bound recombination refused: "+str(exc)
    ancestry={"left_candidate_id":left["candidate_id"],
              "right_candidate_id":right["candidate_id"],
              "left_genome_sha256":a.identity,"right_genome_sha256":b.identity,
              "left_native_workspace_sha256":left["workspace_sha256"],
              "right_native_workspace_sha256":right["workspace_sha256"],
              "eligible_region_pair_count":len(options),
              "sampled_pair_index":selection_index,
              "accepted_pair_index":chosen,
              "tested_region_pair_count":len(tested)+1,
              "rejected_region_alternatives":tested,
              "child_is_distinct_from_both_parents":True,
              "left_region":list(selected[0]),"right_region":list(selected[1]),
              "recombination_sha256":record["sha256"],
              "automatic_operator_acceptance":False}
    return (PlaceGenome.from_dict(record["child_genome"]),ancestry),None


def _topology_birth(original, spatial, *, seed, epoch, index):
    """Offer source-preserving route variation to the existing OODA-HA frontier.

    A route proposal alone never grants native admission. The existing campaign
    auditions its STEP solids under the original complete spatial intent.
    """
    from .place_three_hop import PATTERNS, propose_three_hop_route
    goals=[i for i,goal in enumerate(spatial.goals) if goal.kind=="connect"]
    if not goals:
        return None,"original intent declares no connect relationship"
    choice=(seed+epoch*10007+index*137)%len(goals)
    goal_index=goals[choice]
    pattern=PATTERNS[(seed+epoch+index)%len(PATTERNS)]
    prefix="route_e%d_c%d_g%d"%(epoch,index,goal_index)
    try:
        proposal=propose_three_hop_route(original,spatial,goal_index=goal_index,
                                         pattern=pattern,corner_prefix=prefix)
    except ValueError as exc:
        return None,"source-bound topology refused: "+str(exc)
    child=PlaceGenome.from_dict(proposal["proposed_genome"])
    return (child,{"source_genome_sha256":original.identity,
                   "spatial_intent_sha256":spatial.identity,
                   "goal_index":goal_index,"pattern":pattern,
                   "corner_prefix":prefix,"proposal_sha256":proposal["sha256"],
                   "native_audition_completed":False,
                   "automatic_operator_acceptance":False}),None


def emit_place_child(original,resolved,archive,spatial,*,epoch,index,offspring,seed):
    if (not isinstance(original,PlaceGenome) or not isinstance(resolved,PlaceGenome)
            or type(epoch) is not int or epoch<0
            or type(index) is not int or index<0
            or type(offspring) is not int or not 1<=offspring<=8
            or index>=offspring or type(seed) is not int):
        raise ValueError("Bounded attributed location emitter inputs required")
    if epoch==0 and index==0:
        child=resolved
        emitter="initial"
        ancestors=[]
        refusal=None
    else:
        # Every later epoch offers one cross-parent region opportunity, without
        # inventing a second controller or exceeding the original audition budget.
        breeding=(epoch>0 and index==offspring-1)
        topology=(epoch>0 and offspring>=3 and index==offspring-2)
        if breeding:
            proposal,refusal=_cross_parent(original,archive,spatial,
                                           seed=seed,epoch=epoch,index=index)
        elif topology:
            proposal,refusal=_topology_birth(original,spatial,
                                             seed=seed,epoch=epoch,index=index)
        else:
            proposal,refusal=None,None
        if proposal is None:
            parent=archive[index%len(archive)] if archive else {
                "genome":resolved,"candidate_id":"authored-intent"}
            child=parent["genome"].vary_spatial(
                spatial,seed+epoch*10007+index*137+1,count=1)
            emitter="mutation"
            ancestors=[{"candidate_id":parent["candidate_id"],
                        "genome_sha256":parent["genome"].identity}]
        else:
            child,ancestry=proposal
            emitter="relational-recombination" if breeding else "topology-birth"
            ancestors=[ancestry]
    body={"schema":"projection-loom/place-emitter-proposal",
          "emitter":emitter,"epoch":epoch,"index":index,
          "original_genome_sha256":original.identity,
          "resolved_genome_sha256":resolved.identity,
          "candidate_genome_sha256":child.identity,
          "ancestors":ancestors,
          "recombination_deferral":refusal,
          "native_audition_completed":False,
          "operator_accepted":False}
    return child,{**body,"sha256":canonical_json_sha256(body)}
