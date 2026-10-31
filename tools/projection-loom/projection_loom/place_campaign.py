"""Bounded place-level developmental study under the EXISTING OODAHAJournal.

Neither a replacement five-phase controller nor a new artistic winner engine:
the existing journal receives genuine phase/candidate actions, each native
winner acquires a portable immutable location workspace. Source, geometry,
spatial goal, and operator judgment retain separate authorities.
"""
from __future__ import annotations
from pathlib import Path
import json
import shutil
from .intent_seed import IntentContract
from .location_stack import LocationStack
from .place_genome import PlaceGenome
from .spatial_intent import SpatialIntent
from .place_affordances import assess_place, verify_place_affordances
from .scene_usd import package_scene
from .location_workspace import create_workspace, verify_workspace
from .generalized_campaign import save_once
from .fractal_ooda_ha import OODAHAJournal, single_runner
from .constructive_phases import open_child,close_child
from .provenance_encoding import canonical_json_sha256


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))

def observed_place_descriptor(genome:PlaceGenome,affordances):
    """Observed route morphology, not guessed architectural or artistic value."""
    if (not isinstance(genome,PlaceGenome)
            or not affordances.get("all_declared_goals_witnessed")):
        raise ValueError("Native route descriptor needs an admitted exact affordance witness")
    routes=[]
    cover=[]
    ascents=[]
    bearings=[]
    for item in affordances["goals"]:
        proof=item["proof"]
        if item["status"]=="geometric-bearing-proposal":
            chain=(proof or {}).get("support_chain",[])
            if (not isinstance(chain,list) or len(chain) not in (1,2)
                    or any(not isinstance(contact,dict)
                           or contact.get("load_certification") is not False
                           or contact.get("native_contact_area",0)<=0
                           for contact in chain)):
                raise ValueError("Place bearing lacks independent exact STEP contact testimony")
            bearings.append({"native_contact_area":min(
                                 x["native_contact_area"] for x in chain),
                             "lower":chain[0]["lower"],
                             "upper":chain[-1]["upper"],
                             "native_contact_count":len(chain)})
            continue
        if item["status"]=="geometric-ascent-proposal":
            if (not proof or not proof.get("edge_contacts")
                    or proof.get("total_native_rise",0)<=0
                    or proof.get("minimum_tread_width",0)<=0):
                raise ValueError("Ascent morphology lacks exact native rising tread witnesses")
            ascents.append({"risers":len(proof["edge_contacts"]),
                            "height":proof["total_native_rise"],
                            "width":proof["minimum_tread_width"],
                            "axis":proof["principal_axis"]})
            continue
        if item["status"]=="geometric-shelter-proposal":
            if (not proof or proof.get("intrusions")!=0
                    or not proof.get("native_planar_cover_area",0)>0):
                raise ValueError("Overhead cover lacks independent native planar proof")
            cover.append({"area":proof["native_planar_cover_area"],
                          "width":proof["minimum_cover_width"],
                          "headroom":proof["headroom_height"]})
            continue
        if item["status"]!="geometric-route-proposal":
            raise ValueError("Only fully witnessed goals enter observed morphology")
        segments=proof.get("segments",[proof])
        if not segments or any(not x.get("bearing_sha256") or
                               x.get("native_clearance_obstructions")!=0
                               for x in segments):
            raise ValueError("Native segment evidence missing from spatial descriptor")
        routes.append({"hops":len(segments),
                       "width":min(x["route_width_lower_bound"] for x in segments),
                       "axes":sorted(set(x["principal_axis"] for x in segments)),
                       "ordered_axes":[x["principal_axis"] for x in segments],
                       "segment_widths":[x["route_width_lower_bound"] for x in segments]})
    widths=([x["width"] for x in routes]+[x["width"] for x in cover]
            +[x["width"] for x in ascents]
            +[x["native_contact_area"]**.5 for x in bearings])
    width=min(widths)
    hops=max((x["hops"] for x in routes),default=0)
    axis_count=len(set(axis for route in routes for axis in route["axes"]))
    # An x-then-y and y-then-x journey have the same axis set and hop
    # count, yet organize different places. Add route order without
    # ranking either form. Zero means no witnessed passage.
    sequences=sorted(tuple(route["ordered_axes"]) for route in routes)
    first_axis=(0 if not sequences else 1 if sequences[0][0]=="x" else 2)
    turns=max((sum(a!=b for a,b in zip(route["ordered_axes"],
                                        route["ordered_axes"][1:]))
               for route in routes),default=0)
    niche=(min(8,len(genome.walkways)),min(8,hops),min(8,int(width*2)),
           min(2,axis_count),min(8,len(cover)),min(8,len(ascents)),
           min(8,len(bearings)),first_axis,min(8,turns))
    return {"schema":"projection-loom/observed-place-morphology",
            "native_scene_sha256":affordances["native_scene_sha256"],
            "body_count":len(genome.bodies),"walkway_count":len(genome.walkways),
            "goals":routes,"native_overhead_cover":cover,
            "shelter_witness_count":len(cover),
            "native_ascent_risers":ascents,
            "ascent_witness_count":len(ascents),
            "native_bearings":bearings,"bearing_witness_count":len(bearings),
            "route_width_lower_bound":(min(x["width"] for x in routes)
                                     if routes else None),
            "minimum_spatial_width":width,
            "max_native_route_hops":hops,"distinct_axes":axis_count,
            "ordered_route_axis_sequences":[list(x) for x in sequences],
            "max_native_route_turns":turns,
            "niche":list(niche),"architectural_fitness_claim":None,
            "artistic_fitness_claim":None}





def relational_emission_census(frontiers,records):
    """YIN: record actual relational proposals, refusals and exact native results.

    The census derives from immutable offered/attempted witness records. It
    never treats source digests or a proposed recombinant as native admission.
    """
    offered=[row for frontier in frontiers for row in frontier["offered"]]
    actual={row["candidate_id"]:row for row in records}
    if len(actual)!=len(records) or len({row["candidate_id"] for row in offered})!=len(offered):
        raise ValueError("Relational census requires uniquely attributable candidate identities")
    selected=[row for row in offered if row["emitter"]=="relational-recombination"]
    attempted=[row for row in selected if row["audition"]=="attempted"]
    admitted=[row for row in attempted if actual.get(row["candidate_id"],{}).get("status")=="admitted"]
    deferred=[row for row in offered if row["emitter_receipt"]["proposal_deferral"] is not None]
    reasons={}
    for row in deferred:
        reason=row["emitter_receipt"]["proposal_deferral"]
        reasons[reason]=reasons.get(reason,0)+1
    if any(row["candidate_id"] not in actual for row in attempted):
        raise ValueError("Relational census found an auditioned but unreported candidate")
    ancestry=[row["emitter_receipt"]["ancestors"][0] for row in selected]
    considered=sum(x["tested_region_pair_count"] for x in ancestry)
    rejected=sum(len(x["rejected_region_alternatives"]) for x in ancestry)
    if any(x["tested_region_pair_count"]!=1+len(x["rejected_region_alternatives"])
           or x["accepted_pair_index"]>=x["eligible_region_pair_count"]
           or not x["child_is_distinct_from_both_parents"] for x in ancestry):
        raise ValueError("Relational pairing record lost source-bound alternative testimony")
    topologies=[row for row in offered if row["emitter"]=="topology-birth"]
    topology_attempted=[row for row in topologies if row["audition"]=="attempted"]
    topology_admitted=[row for row in topology_attempted if actual.get(row["candidate_id"],{}).get("status")=="admitted"]
    body={"schema":"projection-loom/observed-relational-emission-census",
          "all_offered":len(offered),"native_attempts":len(actual),
          "region_pairs_considered_in_proposals":considered,
          "region_pairs_refused_before_birth":rejected,
          "relational_offered":len(selected),
          "relational_native_attempted":len(attempted),
          "relational_native_admitted":len(admitted),
          "relational_native_unverified":len(attempted)-len(admitted),
          "topology_offered":len(topologies),
          "topology_native_attempted":len(topology_attempted),
          "topology_native_admitted":len(topology_admitted),
          "proposal_deferrals":len(deferred),
          "deferral_reasons":reasons,
          "distinct_admitted_recombinants":len({row["genome_sha256"] for row in admitted}),
          "automatic_artistic_winner":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def select_place_auditions(offered,budget,preferred=None,*,epoch=0,emitter_receipts=None):
    """One existing OODA-HA preference can reorder finite native auditions.

    Refuse to pretend unsupported shared emitters exist at the place aperture.
    This changes which children consume the same exact native budget, never
    their original genome proposals or score/physical safety rules.
    """
    if preferred not in (None,"initial","mutation","relational-recombination","topology-birth"):
        raise ValueError("Place runner supports only initial, mutation, relational-recombination and topology-birth emitters")
    if type(budget) is not int or not 1<=budget<=len(offered):
        raise ValueError("Invalid exact native place audition budget")
    keyed=list(enumerate(offered))
    if emitter_receipts is not None and preferred is not None:
        keyed.sort(key=lambda row:(0 if emitter_receipts[row[1][0]]["emitter"]==preferred else 1,
                                   row[0]))
    elif preferred=="mutation":
        keyed.sort(key=lambda row:(0 if (epoch>0 or row[0]>0) else 1,row[0]))
    # An initial preference keeps ordinary original-first audition order.
    return [row for _,row in keyed[:budget]]


def _place_frontier(epoch,offered,pre,preferred,emitter_receipts):
    seats=select_place_auditions(offered,pre["exact_budget"],preferred,epoch=epoch,
                                 emitter_receipts=emitter_receipts)
    admitted={identifier for identifier,_ in seats}
    body={"schema":"projection-loom/place-proposal-frontier",
          "epoch":epoch,"run_id":pre["run_id"],
          "spatial_intent_sha256":pre["spatial_intent_sha256"],
          "original_inventory_sha256":pre["original_inventory_sha256"],
          "exact_budget":pre["exact_budget"],
          "operator_preferred_emitter":preferred,
          "audition_order":[identifier for identifier,_ in seats],
          "offered":[{"candidate_id":identifier,
                      "genome_sha256":candidate.identity,
                      "genome":candidate.to_dict(),
                      "emitter":emitter_receipts[identifier]["emitter"],
                      "emitter_receipt":emitter_receipts[identifier],
                      "audition":"attempted" if identifier in admitted else "deferred"}
                     for i,(identifier,candidate) in enumerate(offered)]}
    return json.loads(json.dumps(body,sort_keys=True,allow_nan=False))


def _verify_place_frontiers(path,pre,summary,spatial,resolved):
    """Reconstruct every offered genome, even those never sent to STEP.

    Neither a mutated deferred receipt nor a freshly rehashed summary may
    substitute for the original deterministic proposal stream.
    """
    from .place_emitters import emit_place_child
    original=PlaceGenome.from_dict(pre["original_genome"])
    archive=[]
    niches=set()
    digests=[]
    reconstructed_frontiers=[]
    total=0
    journal=OODAHAJournal(path/"session.json",identity={
        "location":pre["location"],"score_state":"spatial-proposal-native-only",
        "run":pre["run_id"]},initial={},autonomy=1.)
    for epoch in range(pre["epochs"]):
        offered=[]
        emitter_receipts={}
        for i in range(pre["offspring"]):
            candidate,production=emit_place_child(original,resolved,archive,spatial,
                    epoch=epoch,index=i,offspring=pre["offspring"],seed=pre["seed"])
            identifier=f"p{epoch:03d}c{i:03d}"
            offered.append((identifier,candidate))
            emitter_receipts[identifier]=production
        loop=f"location/place-{epoch:03d}"
        decision=journal.data["loops"][loop]["receipts"]["decide"]
        observe=journal.data["loops"][loop]["receipts"]["observe"]
        if observe.get("construction_obligations_sha256")!=pre["construction_obligations"]["sha256"]:
            raise ValueError("Epoch Observe lost the original compositional intent")
        if (decision["exact_budget"]!=pre["exact_budget"]
                or decision["explicit_goal"]!=pre["spatial_intent_sha256"]
                or decision.get("construction_obligations_sha256")!=pre["construction_obligations"]["sha256"]):
            raise ValueError("Operator steering altered authored native budget or original spatial goal")
        preferred=decision.get("operator_preferred_emitter")
        seats=select_place_auditions(offered,pre["exact_budget"],preferred,epoch=epoch,
                                    emitter_receipts=emitter_receipts)
        expected=_place_frontier(epoch,offered,pre,preferred,emitter_receipts)
        actual=_read(path/"frontiers"/f"epoch_{epoch:03d}.json")
        if actual!=expected:
            raise ValueError("Native place proposal frontier diverged from original intent and source seed")
        digests.append(canonical_json_sha256(expected))
        reconstructed_frontiers.append(expected)
        attempted=summary["candidates"][total:total+pre["exact_budget"]]
        if ([row["candidate_id"] for row in attempted] !=
                [name for name,_ in seats]):
            raise ValueError("Audition frontier omits or substitutes a candidate")
        for (identifier,candidate),row in zip(seats,attempted):
            if (row["genome_sha256"]!=candidate.identity or row["epoch"]!=epoch
                    or row.get("emitter_receipt")!=emitter_receipts[identifier]):
                raise ValueError("Audited native child differs from offered developmental genome")
            child_id=loop+"/"+identifier
            child_observe=journal.data["loops"][child_id]["receipts"]["observe"]
            if (child_observe.get("place-genome")!=candidate.identity
                    or child_observe.get("construction_obligations_sha256")
                    !=pre["construction_obligations"]["sha256"]
                    or child_observe.get("emitter_receipt_sha256")!=emitter_receipts[identifier]["sha256"]):
                raise ValueError("Candidate Observe lost its source or original obligations")
            if row["status"]=="admitted":
                niche=tuple(row["niche"])
                niches.add(niche)
                if (not any(p["genome"].identity==candidate.identity for p in archive)
                        and sum(p["niche"]==niche for p in archive)<2):
                    archive.append({"genome":candidate,"candidate_id":identifier,
                                    "workspace_sha256":row["workspace_sha256"],
                                    "niche":niche})
        total+=len(attempted)
    if summary.get("relational_emissions")!=relational_emission_census(
            reconstructed_frontiers,summary["candidates"]):
        raise ValueError("Relational birth/refusal census differs from audited native frontiers")
    if (total!=summary["attempted"] or
            summary.get("frontier_sha256")!=digests or
            summary["offered"]!=pre["epochs"]*pre["offspring"] or
            summary["deferred"]!=pre["epochs"]*(pre["offspring"]-pre["exact_budget"])):
        raise ValueError("Native proposed/deferred frontier counters or digest changed")
    return True


def verify_place_campaign(path):
    path=Path(path)
    pre=_read(path/"pre_registration.json")
    summary=_read(path/"summary.json")
    if summary.get("schema")!="projection-loom/place-development-summary" or (
            summary["pre_registration_sha256"]!=canonical_json_sha256(pre)):
        raise ValueError("Location campaign summary diverged from preregistration")
    intent=SpatialIntent.from_dict(pre["spatial_intent"])
    contract_fields=pre["intent_contract"]
    if not isinstance(contract_fields,dict) or set(contract_fields)!={
            "location","aim","objectives","invariants","budgets"}:
        raise ValueError("Place preregistration lacks complete original intent")
    original_intent=IntentContract(contract_fields["location"],contract_fields["aim"],
                  tuple(contract_fields["objectives"]),
                  tuple(contract_fields["invariants"]),
                  tuple(tuple(x) for x in contract_fields["budgets"]))
    if original_intent.identity!=pre["intent_sha256"] or intent.intent_sha256!=original_intent.identity:
        raise ValueError("Place intent contract changed after native construction")
    genome=PlaceGenome.from_dict(pre["original_genome"])
    if intent.identity!=pre["spatial_intent_sha256"] or genome.identity!=pre["original_genome_sha256"]:
        raise ValueError("Campaign original sources or intent changed")
    from .place_genome import propose_from_spatial_intent
    from .place_obligations import plan_spatial_obligations
    if pre.get("construction_obligations")!=plan_spatial_obligations(genome,intent):
        raise ValueError("Campaign construction obligations diverged from authored source")
    from .place_source_seal import seal_constructive_growth
    constructed=PlaceGenome.from_dict(pre["intent_constructed_genome"])
    if pre.get("source_preserving_growth")!=seal_constructive_growth(genome,constructed):
        raise ValueError("Campaign intent growth rewrote or lost original source declarations")
    if (PlaceGenome.from_dict(pre["intent_constructed_genome"]).identity
            !=pre["intent_constructed_genome_sha256"]
            or propose_from_spatial_intent(genome,intent).identity
            !=pre["intent_constructed_genome_sha256"]):
        raise ValueError("Authored spatial construction changed after preregistration")
    predecessor=pre.get("predecessor")
    if predecessor is not None:
        from .location_review import verify_location_review
        parent_workspace=path/"parent-native-workspace"
        report=verify_workspace(parent_workspace)
        if report["workspace_sha256"]!=predecessor["workspace_sha256"]:
            raise ValueError("Parent native evidence cannot independently replay")
        review=_read(path/"parent-review.json")
        prior=predecessor["prior_pre_registration"]
        if canonical_json_sha256(prior)!=predecessor["prior_campaign_sha256"]:
            raise ValueError("Prior place campaign preregistration changed")
        from .place_amendment import verify_place_amendment
        old_goal=(prior["intent_sha256"],prior["spatial_intent_sha256"])
        new_goal=(pre["intent_sha256"],pre["spatial_intent_sha256"])
        amendment=predecessor.get("intent_amendment")
        if old_goal!=new_goal:
            verify_place_amendment(amendment,prior,original_intent,intent)
        elif amendment is not None:
            raise ValueError("Unchanged inherited place cannot smuggle an intent amendment")
        if review!=predecessor["review"] or review.get("decision")!="accept":
            raise ValueError("Continuation lacks the prior accepted operator decision")
        verify_location_review(parent_workspace,review)
        if predecessor["genome_sha256"]!=genome.identity:
            raise ValueError("Inherited source genome differs from operator choice")
    for row in summary["candidates"]:
        folder=path/"candidates"/row["candidate_id"]
        receipt=_read(folder/"receipt.json")
        if receipt!=row or receipt["genome_sha256"]!=PlaceGenome.from_dict(
                _read(folder/"genome.json")).identity:
            raise ValueError("Candidate ancestry or immutable receipt changed")
        current=PlaceGenome.from_dict(_read(folder/"genome.json"))
        first=row.get("initial_affordances")
        if first is not None:
            verify_place_affordances(folder/"scene",current,intent,first)
        if row["status"]=="admitted":
            workspace=folder/"workspace"
            verified=verify_workspace(workspace)
            if verified["workspace_sha256"]!=row["workspace_sha256"]:
                raise ValueError("Location native workspace changed")
            assert intent.identity==pre["spatial_intent_sha256"]
            verify_place_affordances(workspace/"scene",current,intent,row["affordances"])
            expected_descriptor=observed_place_descriptor(current,row["affordances"])
            if row.get("descriptor")!=expected_descriptor or row.get("niche")!=expected_descriptor["niche"]:
                raise ValueError("Native-observed place descriptor or niche changed")
    _verify_place_frontiers(path,pre,summary,intent,
                            PlaceGenome.from_dict(pre["intent_constructed_genome"]))
    if summary["admitted"]!=sum(x["status"]=="admitted" for x in summary["candidates"]):
        raise ValueError("Location archive admission count changed")
    if summary["spatial_niches"]!=len({tuple(x["niche"]) for x in summary["candidates"]
                                      if x["status"]=="admitted"}):
        raise ValueError("Spatial morphology archive diverged")
    journal=OODAHAJournal(path/"session.json",identity={
        "location":pre["location"],"score_state":"spatial-proposal-native-only",
        "run":pre["run_id"]},initial={},autonomy=1.)
    from .constructive_phases import audit_closed_constructive_helm
    audit_closed_constructive_helm(journal,candidate_ids=[
        "location/place-"+f"{row['epoch']:03d}"+"/"+row["candidate_id"]
        for row in summary["candidates"]])
    return summary


def _run_place_campaign_locked(inventory:LocationStack,intent:IntentContract,
                       spatial:SpatialIntent,genome:PlaceGenome,out,*,
                       epochs=2,offspring=3,exact_budget=2,seed=41,
                       predecessor=None,prefer_emitter=None):
    if not isinstance(inventory,LocationStack) or inventory.location_id!=intent.location:
        raise ValueError("Place campaign requires its original source/frame inventory")
    if not isinstance(genome,PlaceGenome) or not isinstance(intent,IntentContract):
        raise ValueError("Place campaign requires typed construction and intent")
    spatial.bind(intent)
    if (type(epochs) is not int or not 1<=epochs<=6
            or type(offspring) is not int or not 1<=offspring<=8
            or type(exact_budget) is not int or not 1<=exact_budget<=offspring
            or type(seed) is not int
            or prefer_emitter not in (None,"initial","mutation","relational-recombination","topology-birth")):
        raise ValueError("Bounded matched location experiment budgets required")
    inventory.audit()
    local=[f for f in inventory.frames.values() if f.kind=="local3d"]
    if len(local)!=1:
        raise ValueError("Location campaign requires exactly one explicitly authored local3d frame")
    source_status=inventory.verify_source_bytes()
    if any(state!="matched" for state in source_status.values()):
        raise ValueError("Original source bytes no longer match the authored location inventory")
    out=Path(out)
    from .place_genome import propose_from_spatial_intent
    from .place_obligations import plan_spatial_obligations
    from .place_source_seal import seal_constructive_growth
    construction_plan=plan_spatial_obligations(genome,spatial)
    resolved=propose_from_spatial_intent(genome,spatial)
    pre={"schema":"projection-loom/place-preregistration",
         "location":intent.location,"intent_sha256":intent.identity,
         "intent_contract":{"location":intent.location,"aim":intent.aim,
                            "objectives":list(intent.objectives),
                            "invariants":list(intent.invariants),
                            "budgets":[list(x) for x in intent.budgets]},
         "spatial_intent":spatial.to_dict(),"spatial_intent_sha256":spatial.identity,
         "original_inventory_sha256":inventory.to_dict()["snapshot_sha256"],
         "source_evidence_scope":("original-file-bytes-matched-no-survey-certificate"
                                  if source_status else "authored-construction-no-external-sources"),
         "original_genome":genome.to_dict(),"original_genome_sha256":genome.identity,
         "construction_obligations":construction_plan,
         "source_preserving_growth":seal_constructive_growth(genome,resolved),
         "intent_constructed_genome":resolved.to_dict(),
         "intent_constructed_genome_sha256":resolved.identity,
         "epochs":epochs,"offspring":offspring,"exact_budget":exact_budget,"seed":seed,
         "initial_emitter_preference":prefer_emitter,
         "native_policy":"exact-STEP-before-spatial-admission",
         "autoranking":False,
         "predecessor":({k:v for k,v in predecessor.items() if k!="workspace_path"}
                        if predecessor is not None else None)}
    pre["run_id"]=canonical_json_sha256(pre)
    # Snapshot JSON is the causal comparison, not Python tuple/list identity.
    # Preserve original bytes and the canonical full-length content digest.
    pre=json.loads(json.dumps(pre,allow_nan=False,sort_keys=True))
    if (out/"summary.json").exists():
        old=_read(out/"pre_registration.json")
        if old!=pre:
            raise ValueError("Re-entry changes original source or budget")
        return verify_place_campaign(out)
    if out.exists():
        raise ValueError("Incomplete or occupied campaign must not replay as success")
    out.mkdir(parents=True)
    if predecessor is not None:
        from .location_review import verify_location_review
        prior=Path(predecessor["workspace_path"])
        if verify_workspace(prior)["workspace_sha256"]!=predecessor["workspace_sha256"]:
            raise ValueError("Inherited native parent differs from reviewed evidence")
        if not verify_location_review(prior,predecessor["review"]):
            raise ValueError("Inherited operator review does not match native parent")
        shutil.copytree(prior,out/"parent-native-workspace")
        save_once(out/"parent-review.json",predecessor["review"])
    save_once(out/"pre_registration.json",pre)
    journal=OODAHAJournal(out/"session.json",identity={
        "location":intent.location,"score_state":"spatial-proposal-native-only",
        "run":pre["run_id"]},initial={},autonomy=1.)
    original=genome
    genome=resolved
    from .place_emitters import emit_place_child
    archive=[]
    niches=set()
    all_records=[]
    frontier_sha256=[]
    frontier_records=[]
    try:
        for epoch in range(epochs):
            loop=f"location/place-{epoch:03d}"
            if not journal.poll():
                raise RuntimeError("Operator pause or review must resolve before native place audition")
            selected_preference=(journal.data["policy"].get("preferred_emitter")
                                 or pre["initial_emitter_preference"])
            if selected_preference not in (None,"initial","mutation","relational-recombination","topology-birth"):
                raise ValueError("Operator preferred emitter unavailable at living-place aperture")
            open_child(journal,loop,parent="location",scope="epoch",
                       evidence={"genome":genome.identity,"spatial":spatial.identity,
                                 "construction_obligations_sha256":construction_plan["sha256"]},
                       orient={"source":pre["original_inventory_sha256"]},
                       decide={"exact_budget":exact_budget,
                               "explicit_goal":spatial.identity,
                               "construction_obligations_sha256":construction_plan["sha256"],
                               "operator_preferred_emitter":selected_preference},
                       act={"native":"independent-STEP"})
            offered=[]
            emitter_receipts={}
            for i in range(offspring):
                candidate,production=emit_place_child(original,resolved,archive,spatial,
                         epoch=epoch,index=i,offspring=offspring,seed=seed)
                identifier=f"p{epoch:03d}c{i:03d}"
                offered.append((identifier,candidate))
                emitter_receipts[identifier]=production
            frontier=_place_frontier(epoch,offered,pre,selected_preference,emitter_receipts)
            seats=select_place_auditions(offered,exact_budget,
                                         selected_preference,epoch=epoch,
                                         emitter_receipts=emitter_receipts)
            save_once(out/"frontiers"/f"epoch_{epoch:03d}.json",frontier)
            frontier_sha256.append(canonical_json_sha256(frontier))
            frontier_records.append(frontier)
            for i,(identifier,candidate) in enumerate(seats):
                loopid=loop+"/"+identifier
                open_child(journal,loopid,parent=loop,scope="candidate",
                           evidence={"place-genome":candidate.identity,
                                     "construction_obligations_sha256":construction_plan["sha256"],
                                     "emitter_receipt_sha256":emitter_receipts[identifier]["sha256"]},
                           orient={"source":pre["original_inventory_sha256"]},
                           decide={"gate":"native-then-spatial"},
                           act={"candidate":identifier})
                folder=out/"candidates"/identifier
                folder.mkdir(parents=True)
                save_once(folder/"genome.json",candidate.to_dict())
                row={"candidate_id":identifier,"genome_sha256":candidate.identity,
                     "emitter_receipt":emitter_receipts[identifier],
                     "epoch":epoch,"status":"native-rejected","affordances":None,
                     "workspace_sha256":None,"reason":None,
                     "initial_affordances":None}
                try:
                    package_scene(candidate.declaration(intent.location),folder/"scene")
                    evidence=assess_place(folder/"scene",candidate,spatial)
                    row["initial_affordances"]=evidence
                    row["affordances"]=evidence
                    if evidence["all_declared_goals_witnessed"]:
                        # The rebuilt immutable workspace has its OWN source
                        # scene digest. Re-audit that actual STEP; do not
                        # transplant the rehearsal scene's content identity.
                        witness=create_workspace(inventory,candidate.declaration(intent.location),
                                                 folder/"workspace")
                        final_evidence=assess_place(folder/"workspace"/"scene",
                                                    candidate,spatial)
                        if not final_evidence["all_declared_goals_witnessed"]:
                            raise ValueError("Rebuilt native workspace no longer witnesses authored intent")
                        if [x["status"] for x in final_evidence["goals"]] != [
                                x["status"] for x in evidence["goals"]]:
                            raise ValueError("Native source and immutable workspace disagree on spatial status")
                        row["affordances"]=final_evidence
                        row["status"]="admitted"
                        row["workspace_sha256"]=witness["sha256"]
                        # Preserve morphology/route niches rather than treating
                        # every native-valid variation as an automatic elite.
                        descriptor=observed_place_descriptor(candidate,final_evidence)
                        niche=tuple(descriptor["niche"])
                        row["descriptor"]=descriptor
                        row["niche"]=list(niche)
                        niches.add(niche)
                        if (not any(p["genome"].identity==candidate.identity for p in archive)
                                and sum(p["niche"]==niche for p in archive)<2):
                            archive.append({"genome":candidate,"candidate_id":identifier,
                                            "workspace_sha256":row["workspace_sha256"],
                                            "niche":niche,"witness":evidence})
                    else:
                        row["status"]="spatial-unverified"
                        row["reason"]="Original goal lacks full native affordance evidence"
                except ValueError as exc:
                    row["reason"]=str(exc)
                save_once(folder/"receipt.json",row)
                all_records.append(row)
                close_child(journal,loopid,aftermath={"status":row["status"]})
            close_child(journal,loop,aftermath={"admitted":sum(
                r["status"]=="admitted" and r["epoch"]==epoch for r in all_records),
                "deferred":offspring-exact_budget})
        summary={"schema":"projection-loom/place-development-summary",
                 "pre_registration_sha256":canonical_json_sha256(pre),
                 "run_id":pre["run_id"],"candidates":all_records,
                 "offered":epochs*offspring,"attempted":len(all_records),
                 "deferred":epochs*(offspring-exact_budget),
                 "frontier_sha256":frontier_sha256,
                 "relational_emissions":relational_emission_census(frontier_records,all_records),
                 "admitted":sum(r["status"]=="admitted" for r in all_records),
                 "distinct_admitted_genomes":len({r["genome_sha256"] for r in all_records
                                            if r["status"]=="admitted"}),
                 "spatial_niches":len(niches),
                 "operator_winner":None,"automatic_promotion":False}
        save_once(out/"summary.json",summary)
        journal.transition("location","aftermath",{"admitted":summary["admitted"]})
        journal.transition("location","closed")
        journal.data["status"]="completed"
        journal.save()
        return verify_place_campaign(out)
    except Exception:
        (out/"FAILED").write_text("Incomplete living-place campaign; not an accepted study\n",
                                 encoding="utf8")
        raise

def run_place_campaign(inventory:LocationStack,intent:IntentContract,
                       spatial:SpatialIntent,genome:PlaceGenome,out,*,
                       epochs=2,offspring=3,exact_budget=2,seed=41,
                       predecessor=None,prefer_emitter=None):
    """Use the existing single-runner lease for native location sessions.

    A sibling lock protects the not-yet-created immutable output directory;
    creating that output early would violate the first-publication rule.
    """
    out=Path(out)
    out.parent.mkdir(parents=True,exist_ok=True)
    lock=out.parent/("."+out.name+".session.json")
    with single_runner(lock):
        return _run_place_campaign_locked(
            inventory,intent,spatial,genome,out,epochs=epochs,offspring=offspring,
            exact_budget=exact_budget,seed=seed,predecessor=predecessor,
            prefer_emitter=prefer_emitter)


def review_place_candidate(campaign,candidate_id,*,actor,decision,reason,destination):
    """Explicit operator choice references a real audited location candidate."""
    summary=verify_place_campaign(campaign)
    found=[x for x in summary["candidates"] if x["candidate_id"]==candidate_id]
    if len(found)!=1 or found[0]["status"]!="admitted":
        raise ValueError("Only uniquely named, natively admitted place candidates can be reviewed")
    from .location_review import review_location, verify_location_review
    workspace=Path(campaign)/"candidates"/candidate_id/"workspace"
    witness=review_location(workspace,actor=actor,decision=decision,
                            reason=reason,destination=destination)
    if not verify_location_review(workspace,witness):
        raise ValueError("Operator review did not reverify its location")
    return {"candidate_id":candidate_id,"genome_path":str(
                Path(campaign)/"candidates"/candidate_id/"genome.json"),
            "review":witness,"automatic_next_epoch":False,
            "automatic_promotion":False}

def continue_place_campaign(previous,review_receipt,intent,spatial,out,*,
                            epochs=2,offspring=3,exact_budget=2,seed=41,
                            amendment=None,prefer_emitter=None):
    """Only a reviewed ACCEPT choice may seed a new, fully witnessed study."""
    prior=Path(previous)
    summary=verify_place_campaign(prior)
    prior_pre=_read(prior/"pre_registration.json")
    spatial.bind(intent)
    from .place_amendment import verify_place_amendment
    changed=(prior_pre["intent_sha256"],prior_pre["spatial_intent_sha256"])!=(
        intent.identity,spatial.identity)
    if changed:
        verify_place_amendment(amendment,prior_pre,intent,spatial)
    elif amendment is not None:
        raise ValueError("Unchanged place intent refuses an unnecessary amendment")
    review=_read(review_receipt)
    if review.get("decision")!="accept":
        raise ValueError("Only an operator-accepted place may seed continuation")
    admitted=[x for x in summary["candidates"] if x["status"]=="admitted"
              and x["workspace_sha256"]==review.get("workspace_sha256")]
    if len(admitted)!=1:
        raise ValueError("Operator review does not uniquely select an audited candidate")
    selected=admitted[0]
    source=prior/"candidates"/selected["candidate_id"]
    parent=source/"workspace"
    from .location_review import verify_location_review
    verify_location_review(parent,review)
    genome=PlaceGenome.from_dict(_read(source/"genome.json"))
    old_inventory=LocationStack.load(parent/"inventory.json")
    # Preserve independent source testimony, but remove generated CAD members;
    # the new workspace must reconstruct these from inherited native programs.
    fresh=LocationStack.from_dict(old_inventory.to_dict())
    fresh.elements={k:v for k,v in fresh.elements.items() if v.kind!="cad_body"}
    fresh.relations=[r for r in fresh.relations
                     if r.subject in fresh.elements and r.object in fresh.elements]
    fresh.audit()
    parent_manifest=_read(parent/"manifest.json")
    lineage={"workspace_path":str(parent),
             "workspace_sha256":parent_manifest["sha256"],
             "genome_sha256":genome.identity,"review":review,
             "prior_campaign_sha256":summary["pre_registration_sha256"],
             "prior_pre_registration":prior_pre,
             "intent_amendment":amendment,
             "prior_candidate_id":selected["candidate_id"],
             "claim_scope":"attributed-study-lineage; not an editor causal reparent"}
    return run_place_campaign(fresh,intent,spatial,genome,out,epochs=epochs,
                              offspring=offspring,exact_budget=exact_budget,
                              seed=seed,predecessor=lineage,
                              prefer_emitter=prefer_emitter)
