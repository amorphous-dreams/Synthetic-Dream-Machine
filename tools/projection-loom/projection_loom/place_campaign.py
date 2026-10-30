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
from .fractal_ooda_ha import OODAHAJournal
from .provenance_encoding import canonical_json_sha256


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def verify_place_campaign(path):
    path=Path(path)
    pre=_read(path/"pre_registration.json")
    summary=_read(path/"summary.json")
    if summary.get("schema")!="projection-loom/place-development-summary" or (
            summary["pre_registration_sha256"]!=canonical_json_sha256(pre)):
        raise ValueError("Location campaign summary diverged from preregistration")
    intent=SpatialIntent.from_dict(pre["spatial_intent"])
    genome=PlaceGenome.from_dict(pre["original_genome"])
    if intent.identity!=pre["spatial_intent_sha256"] or genome.identity!=pre["original_genome_sha256"]:
        raise ValueError("Campaign original sources or intent changed")
    from .place_genome import propose_from_spatial_intent
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
        if row["status"]=="admitted":
            workspace=folder/"workspace"
            verified=verify_workspace(workspace)
            if verified["workspace_sha256"]!=row["workspace_sha256"]:
                raise ValueError("Location native workspace changed")
            current=PlaceGenome.from_dict(_read(folder/"genome.json"))
            assert intent.identity==pre["spatial_intent_sha256"]
            verify_place_affordances(workspace/"scene",current,intent,row["affordances"])
    if summary["admitted"]!=sum(x["status"]=="admitted" for x in summary["candidates"]):
        raise ValueError("Location archive admission count changed")
    if summary["spatial_niches"]!=len({tuple(x["niche"]) for x in summary["candidates"]
                                      if x["status"]=="admitted"}):
        raise ValueError("Spatial morphology archive diverged")
    journal=OODAHAJournal(path/"session.json",identity={
        "location":pre["location"],"score_state":"spatial-proposal-native-only",
        "run":pre["run_id"]},initial={},autonomy=1.)
    if journal.data["status"]!="completed":
        raise ValueError("Generative location's OODA-HA loop did not complete")
    return summary


def run_place_campaign(inventory:LocationStack,intent:IntentContract,
                       spatial:SpatialIntent,genome:PlaceGenome,out,*,
                       epochs=2,offspring=3,exact_budget=2,seed=41,
                       predecessor=None):
    if not isinstance(inventory,LocationStack) or inventory.location_id!=intent.location:
        raise ValueError("Place campaign requires its original source/frame inventory")
    if not isinstance(genome,PlaceGenome) or not isinstance(intent,IntentContract):
        raise ValueError("Place campaign requires typed construction and intent")
    spatial.bind(intent)
    if (type(epochs) is not int or not 1<=epochs<=6
            or type(offspring) is not int or not 1<=offspring<=8
            or type(exact_budget) is not int or not 1<=exact_budget<=offspring
            or type(seed) is not int):
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
    resolved=propose_from_spatial_intent(genome,spatial)
    pre={"schema":"projection-loom/place-preregistration",
         "location":intent.location,"intent_sha256":intent.identity,
         "spatial_intent":spatial.to_dict(),"spatial_intent_sha256":spatial.identity,
         "original_inventory_sha256":inventory.to_dict()["snapshot_sha256"],
         "original_genome":genome.to_dict(),"original_genome_sha256":genome.identity,
         "intent_constructed_genome":resolved.to_dict(),
         "intent_constructed_genome_sha256":resolved.identity,
         "epochs":epochs,"offspring":offspring,"exact_budget":exact_budget,"seed":seed,
         "native_policy":"exact-STEP-before-spatial-admission",
         "autoranking":False,
         "predecessor":({k:v for k,v in predecessor.items() if k!="workspace_path"}
                        if predecessor is not None else None)}
    pre["run_id"]=canonical_json_sha256(pre)
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
    genome=resolved
    archive=[]
    niches=set()
    all_records=[]
    try:
        for epoch in range(epochs):
            loop=f"location/place-{epoch:03d}"
            journal.begin(loop,parent="location",scope="epoch",
                          evidence={"genome":genome.identity,"spatial":spatial.identity},
                          parent_phase="act")
            journal.transition(loop,"orient",{"source":pre["original_inventory_sha256"]})
            journal.transition(loop,"decide",{"exact_budget":exact_budget,
                                              "explicit_goal":spatial.identity})
            journal.transition(loop,"act",{"native":"independent-STEP"})
            offered=[]
            for i in range(offspring):
                parent=(archive[i%len(archive)]["genome"] if archive else genome)
                candidate=(parent if epoch==0 and i==0 else parent.vary(
                    seed+epoch*10007+i*137+1,count=1))
                offered.append((f"p{epoch:03d}c{i:03d}",candidate))
            for i,(identifier,candidate) in enumerate(offered[:exact_budget]):
                loopid=loop+"/"+identifier
                journal.begin(loopid,parent=loop,scope="candidate",
                              evidence={"place-genome":candidate.identity},parent_phase="act")
                journal.transition(loopid,"orient",{"source":pre["original_inventory_sha256"]})
                journal.transition(loopid,"decide",{"gate":"native-then-spatial"})
                journal.transition(loopid,"act",{"candidate":identifier})
                folder=out/"candidates"/identifier
                folder.mkdir(parents=True)
                save_once(folder/"genome.json",candidate.to_dict())
                row={"candidate_id":identifier,"genome_sha256":candidate.identity,
                     "epoch":epoch,"status":"native-rejected","affordances":None,
                     "workspace_sha256":None,"reason":None}
                try:
                    package_scene(candidate.declaration(intent.location),folder/"scene")
                    evidence=assess_place(folder/"scene",candidate,spatial)
                    row["affordances"]=evidence
                    if evidence["all_declared_goals_witnessed"]:
                        # Each admitted offspring becomes an independently
                        # rehydratable source/causal/native location.
                        witness=create_workspace(inventory,candidate.declaration(intent.location),
                                                 folder/"workspace")
                        row["status"]="admitted"
                        row["workspace_sha256"]=witness["sha256"]
                        # Preserve morphology/route niches rather than treating
                        # every native-valid variation as an automatic elite.
                        width=evidence["goals"][0]["proof"]["route_width_lower_bound"]
                        deck_id=candidate.walkways[0].deck
                        deck=next(body for body in candidate.bodies if body.entity_id==deck_id)
                        niche=(int(width*2),int((deck.translation[1]+4)*2))
                        row["niche"]=list(niche)
                        if niche not in niches:
                            niches.add(niche)
                            archive.append({"genome":candidate,"candidate_id":identifier,
                                            "witness":evidence})
                    else:
                        row["status"]="spatial-unverified"
                        row["reason"]="Original goal lacks full native affordance evidence"
                except ValueError as exc:
                    row["reason"]=str(exc)
                save_once(folder/"receipt.json",row)
                all_records.append(row)
                journal.transition(loopid,"aftermath",{"status":row["status"]})
                journal.transition(loopid,"closed")
            journal.transition(loop,"aftermath",{"admitted":sum(
                r["status"]=="admitted" and r["epoch"]==epoch for r in all_records),
                "deferred":offspring-exact_budget})
            journal.transition(loop,"closed")
        summary={"schema":"projection-loom/place-development-summary",
                 "pre_registration_sha256":canonical_json_sha256(pre),
                 "run_id":pre["run_id"],"candidates":all_records,
                 "offered":epochs*offspring,"attempted":len(all_records),
                 "deferred":epochs*(offspring-exact_budget),
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
                            epochs=2,offspring=3,exact_budget=2,seed=41):
    """Only a reviewed ACCEPT choice may seed a new, fully witnessed study."""
    prior=Path(previous)
    summary=verify_place_campaign(prior)
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
             "prior_candidate_id":selected["candidate_id"],
             "claim_scope":"attributed-study-lineage; not an editor causal reparent"}
    return run_place_campaign(fresh,intent,spatial,genome,out,epochs=epochs,
                              offspring=offspring,exact_budget=exact_budget,
                              seed=seed,predecessor=lineage)
