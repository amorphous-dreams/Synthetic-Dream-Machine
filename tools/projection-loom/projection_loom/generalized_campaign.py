"""Subject-neutral seed composition under the existing OODAHAJournal.

This coordinates developmental rules through the only phase helm; source images
constrain provisional visual fitness, never CAD truth or survey authority.
"""
from __future__ import annotations
from pathlib import Path
from dataclasses import replace
from PIL import Image
import json
import numpy as np

from .intent_seed import SeedBundle, IntentContract, GrowthContext
from .seed_adapters import compose_adapters, proxy_growth_program, image_growth_program, registered_views
from .developmental import GrowthNode, GrowthProgram, compile_growth, mutate_growth, crossover_growth
from .intent_evolution import (QualityArchive, ScoredCandidate, structural_descriptor,
                               fair_auditions, fixed_inspection_cameras,
                               observe_candidate, multi_fidelity_audit)
from .fractal_ooda_ha import OODAHAJournal, single_runner
from .constructive_phases import open_child,close_child
from .provenance_encoding import canonical_json_sha256
from .receipt_store import save_once

def initial_program(adapters):
    """Compose adapter-offered developmental capabilities without kind switches.

    The highest explicit constructive priority supplies the root; other
    independently authored structural programs enter as named, attributable
    subtrees. Original image observations remain visual constraints when any
    constructive program exists. All input source identities remain separate.
    """
    offers = sorted(adapters, key=lambda a:(-a.composition_priority, a.seed.identity))
    independent_visual = [a for a in offers if a.visual_source]
    if (len(independent_visual) > 1
            and all(a.composition_priority <= 0 for a in offers)):
        raise ValueError("Multiple independent images need a declared provisional construction primary")
    if not offers:
        raise ValueError("No producer capability entered the Loom")
    foundation = offers[0]
    nodes = list(foundation.offered_growth().nodes)
    if nodes[0].key != "root":
        original_root = nodes[0].key
        nodes = [replace(n,
                  key="root" if n.key==original_root else n.key,
                  parent="root" if n.parent==original_root else n.parent,
                  target="root" if n.target==original_root else n.target)
                 for n in nodes]
    existing = {n.key for n in nodes}
    for adapter in offers[1:]:
        if adapter.composition_priority <= 0:
            continue
        authored = adapter.offered_growth()
        prefix = "producer_" + adapter.seed.identity[:12] + "_"
        mapping = {authored.nodes[0].key: "root"}
        mapping.update({n.key: prefix + n.key for n in authored.nodes[1:]})
        for node in authored.nodes[1:]:
            mapped = replace(node, key=mapping[node.key],
                             parent=mapping.get(node.parent),
                             target=mapping.get(node.target))
            if mapped.key in existing:
                raise ValueError("Independent producer construction key collision")
            nodes.append(mapped)
            existing.add(mapped.key)
    if len(nodes) == 1:
        nodes.append(GrowthNode("crown", "spawn", parent="root",
                               face="up", size=(1.7, 1.7, 1.3)))
    return GrowthProgram(tuple(nodes))


def source_alpha(adapters):
    images=sorted((a for a in adapters if a.visual_source),
                  key=lambda a:a.seed.identity)
    if not images:
        return None
    if len(images)>1 or images[0].registration is not None:
        # Calibrated sources must use their measured camera, never the
        # synthetic oblique. Uncalibrated multi-image sources abstain.
        return None
    with Image.open(images[0].seed.locator) as im:
        return np.asarray(im.getchannel("A"),dtype=np.uint8).copy()


def proposals(initial,archive,ctx,epoch,count):
    parents=archive.parents()
    result=[]
    for i in range(count):
        parent=parents[i%len(parents)] if parents else None
        base=parent.program if parent else initial
        method=("initial" if epoch==0 and i==0 else
                "topology" if i%3==0 else "crossover" if i%3==1 else "mutation")
        if method=="initial":program=base
        elif method=="crossover" and parent:
            program=crossover_growth(base,initial,ctx,epoch=epoch,child=i)
        else:
            program=mutate_growth(base,ctx,epoch=epoch,child=i,edits=3)
            if method=="topology" and len(program.nodes)<24:
                options=[n for n in program.nodes if n.op!="carve"]
                site=options[ctx.substream_seed("site",epoch,i)%len(options)]
                program=GrowthProgram((*program.nodes,GrowthNode(
                    f"new_{epoch}_{i}","spawn",parent=site.key,
                    face=("east","west","north","south")[i%4],
                    size=(1.4,1.4,1.0))))
        result.append({"id":f"e{epoch:02d}c{i:02d}","emitter":method,
                       "program":program,"parent":parent.id if parent else None})
    return result


def activation_funnels(offered, selected, scored):
    """Measure receipt stages; rule presence is not a per-step activation claim."""
    selected_ids = {x["id"] for x in selected}
    if len(selected_ids) != len(selected):
        raise ValueError("Repeated selected candidate identity")
    receipts = {r["id"]: r for r in scored}
    if len(receipts) != len(scored) or set(receipts) != selected_ids:
        raise ValueError("Audition and candidate receipt identities disagree")
    if len({r["id"] for r in offered}) != len(offered) or not selected_ids <= {
            item["id"] for item in offered}:
        raise ValueError("Proposed and auditioned candidate identities disagree")

    def empty():
        return {"proposed": 0, "attempted": 0, "deferred": 0,
                "native_valid": 0, "native_rejected": 0, "operational_error": 0}

    emitters, rules = {}, {}
    for item in offered:
        cid = item["id"]
        families = {node.op for node in item["program"].nodes}
        rows = [emitters.setdefault(item["emitter"], empty())]
        rows += [rules.setdefault(kind, empty()) for kind in sorted(families)]
        for counts in rows:
            counts["proposed"] += 1
            if cid not in selected_ids:
                counts["deferred"] += 1
            else:
                state = receipts[cid]["state"]
                if state not in ("native-valid", "native-rejected", "operational-error"):
                    raise ValueError("Unknown exact audition outcome")
                counts["attempted"] += 1
                counts[{"native-valid": "native_valid",
                        "native-rejected": "native_rejected",
                        "operational-error": "operational_error"}[state]] += 1
    for counts in list(emitters.values()) + list(rules.values()):
        if (counts["attempted"] + counts["deferred"] != counts["proposed"]
                or counts["native_valid"] + counts["native_rejected"]
                + counts["operational_error"] != counts["attempted"]):
            raise AssertionError("Activation funnel does not reconcile")
    return {"emitters": {k: emitters[k] for k in sorted(emitters)},
            "declared_rule_presence": {k: rules[k] for k in sorted(rules)},
            "rule_scope": "candidate-contains-operator; not per-step runtime invocation"}


def measured_view_scores(mesh, registered, *, full_resolution=False):
    """Each independent original image receives its *own* measured projection.

    Preview masks order search; final masks preserve original pixel grids.
    Synthetic orthos are not scored as source observations.
    """
    from .source_registration import registered_silhouette
    from .intent_evolution import source_fit
    rows=[]
    for entry in registered:
        registration=entry["registration"]
        w,h=registration["camera"]["size"]
        if w*h>16_000_000:
            raise ValueError("Source view exceeds bounded perspective audit budget")
        if full_resolution:
            size=(w,h)
        else:
            ratio=min(1.,160/w,192/h)
            size=(max(16,round(w*ratio)),max(16,round(h*ratio)))
        with Image.open(entry["path"]) as image:
            if image.mode!="RGBA" or image.size!=(w,h):
                raise ValueError("Registered original RGBA pixels changed")
            alpha=image.getchannel("A")
            if size!=(w,h):
                alpha=alpha.resize(size,Image.Resampling.BILINEAR)
            source=np.asarray(alpha,dtype=np.uint8)
        candidate=registered_silhouette(mesh,registration,size=size)
        result=source_fit(source,candidate)
        rows.append({"source_id":entry["source_id"],
                     "camera_sha256":registration["sha256"],
                     "camera_residual_px":registration["observed_rms_px"],
                     "grid":[size[0],size[1]],
                     "source_fit":result})
    return rows


def evaluate(item,cameras,alpha,out,registered=None):
    program=item["program"]
    result={"id":item["id"],"parent":item["parent"],"emitter":item["emitter"],
            "program":[n.as_dict() for n in program.nodes],
            "program_sha256":program.identity}
    try:
        built=compile_growth(program)
        audit=built.audit()
    except ValueError as exc:
        return {**result,"state":"native-rejected","reason":str(exc),"metrics":{}}
    except Exception as exc:
        return {**result,"state":"operational-error","reason":repr(exc),"metrics":{}}
    from .render import silhouette
    mesh=built.assembly.tessellate(union=True)
    source=(np.asarray(Image.fromarray(alpha,"L").resize((128,192)),dtype=np.uint8)
            if alpha is not None else None)
    observe=observe_candidate(mesh,cameras,source,size=(128,192))
    metrics=observe["views"]["oblique"].get("source_fit",{})
    if registered:
        measured=measured_view_scores(mesh,registered)
        metrics={"fitness":sum(row["source_fit"]["fitness"] for row in measured)/len(measured),
                 "registered_view_count":len(measured),
                 "source_authority":"landmark-consistent-registered-views"}
        observe["registered_source_views"]=measured
        observe["camera_authority"]="landmark-consistent-registered"
        observe["source_observations"]=len(measured)
    image=silhouette(mesh,cameras["oblique"],(128,192))
    p=Path(out)/"previews"/(item["id"]+".png")
    p.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(image,"L").save(p)
    return {**result,"state":"native-valid","metrics":metrics,
            "observations":observe,
            "native":{"valid":audit["valid"],"union_valid":audit["union_valid"],
                      "parts":audit["parts"],"joints":audit["joints"]}}


def _read_epoch(epoch_file):
    """Inspect the immutable candidate frontier, not only its elite survivors."""
    epoch_file = Path(epoch_file)
    record = json.loads(epoch_file.read_text(encoding="utf8"))
    if record.get("schema") != "projection-loom/developmental-epoch":
        raise ValueError("Invalid developmental epoch receipt")
    rows = record.get("candidates")
    if not isinstance(rows, list) or record.get("attempted") != len(rows):
        raise ValueError("Incomplete developmental epoch receipt")
    ids = set()
    for row in rows:
        if row.get("id") in ids or not isinstance(row.get("id"), str):
            raise ValueError("Repeated or missing candidate identity")
        ids.add(row["id"])
        state = row.get("state")
        if state not in ("native-valid", "native-rejected", "operational-error"):
            raise ValueError("Unknown candidate receipt state")
        receipt = epoch_file.parent / "receipts" / (row["id"] + ".json")
        if not receipt.is_file() or json.loads(receipt.read_text(encoding="utf8")) != row:
            raise ValueError("Candidate receipt missing or inconsistent with epoch")
        if state == "operational-error":
            raise RuntimeError("Replayed epoch contains an operational error")
    if (record.get("valid") != sum(r["state"] == "native-valid" for r in rows)
            or record.get("rejected") != sum(r["state"] == "native-rejected" for r in rows)):
        raise ValueError("Epoch counts disagree with candidate receipts")
    return record


def restore_archive(epoch_file, archive):
    rows = _read_epoch(epoch_file)
    for row in rows["candidates"]:
        if row["state"] == "native-valid":
            program = GrowthProgram.from_dict({"nodes": row["program"]})
            if program.identity != row["program_sha256"]:
                raise ValueError("Replayed candidate's program digest changed")
            archive.consider(ScoredCandidate(row["id"], program, True,
                row["metrics"], structural_descriptor(program), row["parent"]))
    return rows


def _completed_summary(out, manifest, contract):
    """A summary is only a success if its supporting immutable frontier agrees."""
    out = Path(out)
    summary = json.loads((out / "summary.json").read_text(encoding="utf8"))
    if summary.get("status") != "completed" or summary.get("operational_errors") != 0:
        raise RuntimeError("Failed or incomplete campaign cannot replay as success")
    if (summary.get("schema") != "projection-loom/developmental-campaign-summary"
            or summary.get("run_id") != manifest["run_id"]
            or summary.get("epochs") != manifest["epochs"]
            or summary.get("seeds") != manifest["types"]
            or summary.get("source_authority") != manifest["source_camera_authority"]):
        raise ValueError("Summary identity does not match preregistration")
    records = []
    for epoch in range(manifest["epochs"]):
        record = _read_epoch(out / f"epoch_{epoch:03d}.json")
        if record.get("epoch") != epoch:
            raise ValueError("Epoch sequence disagrees with preregistration")
        records.append(record)
    if (summary.get("native_attempts") != sum(r["attempted"] for r in records)
            or summary.get("native_valid") != sum(r["valid"] for r in records)
            or summary.get("native_rejected") != sum(r["rejected"] for r in records)
            or summary.get("proposals") != sum(r["proposed"] for r in records)):
        raise ValueError("Completed summary counters disagree with immutable epochs")
    journal = OODAHAJournal(out / "session.json", identity={
        "location": contract.location,
        "score_state": manifest["source_camera_authority"],
        "run": manifest["run_id"]}, initial={}, autonomy=1.)
    if journal.data.get("status") != "completed":
        raise RuntimeError("Campaign journal is not completed")
    for finalist in summary.get("finalists", []):
        path = out / "finalists" / (finalist["id"] + ".json")
        if not path.is_file():
            raise ValueError("Finalist evidence missing from completed run")
        witness = json.loads(path.read_text(encoding="utf8"))
        if witness.get("id") != finalist["id"] or witness.get("full_source") != finalist["full_source"]:
            raise ValueError("Finalist summary and witness disagree")
    return summary


def _run_cohort_locked(adapters,contract:IntentContract,out,*,epochs=3,offspring=4,
               exact_budget=4,finalists=2,seed=41,source_policy="auto"):
    """Run any typed seed bundle without naming experiment fixtures.

    The fixed five-phase journal remains the only execution controller.
    """
    if not (1<=epochs<=12 and 1<=offspring<=24 and
            1<=exact_budget<=offspring and 1<=finalists<=12):
        raise ValueError("Unbounded campaign request")
    if source_policy not in ("auto", "withheld"):
        raise ValueError("Unknown preregistered source scoring policy")
    adapters=tuple(adapters)
    types=tuple(sorted({a.seed.kind for a in adapters}))
    if not isinstance(contract,IntentContract):
        raise ValueError("An explicit intent contract is required")
    scene=compose_adapters(adapters,contract)
    scene.audit()
    seeds=SeedBundle(tuple(a.seed for a in adapters))
    seeds.verify_files()
    initial=initial_program(adapters)
    context=GrowthContext(seeds,contract,initial.identity,
        canonical_json_sha256({"native":"OpenCascade","operators":
                               ("foundation","spawn","split","bridge","carve")}),seed)
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    independent_images = [a for a in adapters if a.visual_source]
    authenticated_views=registered_views(adapters)  # verify even for control arm
    registered=(authenticated_views if source_policy=="auto" else None)
    run_id=(context.run_id if source_policy=="auto" else
            canonical_json_sha256({"base":context.run_id,"source_policy":source_policy}))
    visual_authority = ("withheld-controlled-ablation" if source_policy=="withheld" and independent_images
                        else "landmark-consistent-multiview" if registered and len(registered)>1
                        else "landmark-consistent-single-view" if registered
                        else "withheld-uncalibrated-multiview" if len(independent_images)>1
                        else "provisional" if independent_images else "none")
    manifest={"schema":"projection-loom/experimental-input-cohort",
        "run_id":run_id,"seeds":seeds.manifest(),"intent":contract.identity,
        "initial_program":initial.to_dict(),"types":list(types),
        "epochs":epochs,"offspring":offspring,"exact_budget":exact_budget,
        "source_camera_authority": visual_authority,
        "source_policy": source_policy,
        "common_proposal_stream_sha256": context.run_id,
        "independent_source_observations": [a.seed.identity for a in independent_images],
        "registered_source_camera_sha256": [x["registration"]["sha256"] for x in registered or []]}
    save_once(out/"pre_registration.json",manifest)
    if (out/"summary.json").exists():
        return _completed_summary(out, manifest, contract)
    journal=OODAHAJournal(out/"session.json",identity={
        "location":contract.location,"score_state":manifest["source_camera_authority"],
        "run":run_id},initial={},autonomy=1.)
    alpha=source_alpha(adapters) if source_policy=="auto" else None
    seed_model=compile_growth(initial)
    cameras=fixed_inspection_cameras(seed_model.assembly.tessellate(union=True))
    archive=QualityArchive()
    all_epochs=[]
    errors=[]
    for epoch in range(epochs):
        if not journal.poll():
            raise RuntimeError("Operator pause or review must resolve before native audition")
        output=out/f"epoch_{epoch:03d}.json"
        if output.exists():
            all_epochs.append(restore_archive(output,archive));continue
        eid=f"location/e{epoch:03d}"
        held=journal.data["loops"].get(eid)
        preferred=(held["receipts"]["decide"].get("operator_preferred_emitter")
                   if held and "decide" in held["receipts"]
                   else journal.data["policy"].get("preferred_emitter"))
        open_child(journal,eid,parent="location",scope="epoch",
                   evidence={"epoch":epoch,"source":run_id},
                   orient={"source_digest":seeds.identity},
                   decide={"exact_budget":exact_budget,
                           "operator_preferred_emitter":preferred},
                   act={"instruction":"construct, audit, score"})
        offered=proposals(initial,archive,context,epoch,offspring)
        seats=fair_auditions(offered,exact_budget,preferred_emitter=preferred)
        scored=[]
        for item in seats:
            cid=eid+"/"+item["id"]
            open_child(journal,cid,parent=eid,scope="candidate",
                       evidence={"program":item["program"].identity},
                       orient={"kernel":"native"},
                       decide={"gate":"strict BRep before score"},
                       act={"candidate":item["id"]})
            receipt=out/"receipts"/(item["id"]+".json")
            if receipt.exists():
                result=json.loads(receipt.read_text(encoding="utf8"))
                if result["program_sha256"]!=item["program"].identity:
                    raise ValueError("Candidate replay identity conflict")
            else:
                result=(evaluate(item,cameras,alpha,out,registered)
                        if registered else evaluate(item,cameras,alpha,out))
                save_once(receipt,result)
            close_child(journal,cid,aftermath={"state":result["state"]})
            scored.append(result)
            if result["state"]=="native-valid":
                prog=GrowthProgram.from_dict({"nodes":result["program"]})
                archive.consider(ScoredCandidate(result["id"],prog,True,
                    result["metrics"],structural_descriptor(prog),result["parent"]))
            elif result["state"]=="operational-error":
                errors.append(result)
        record={"schema":"projection-loom/developmental-epoch","epoch":epoch,
                "proposed":len(offered),"attempted":len(seats),
                "valid":sum(x["state"]=="native-valid" for x in scored),
                "rejected":sum(x["state"]=="native-rejected" for x in scored),
                "activation_funnels":activation_funnels(offered,seats,scored),
                "candidates":scored,"archive":archive.receipt()}
        save_once(output,record)
        all_epochs.append(record)
        close_child(journal,eid,aftermath={"valid":record["valid"],
                                           "rejected":record["rejected"]})
    winners=[]
    for parent in archive.parents()[:finalists]:
        build=compile_growth(parent.program)
        witness={"id":parent.id,"program_sha256":parent.program.identity,
                 "native":build.audit(),
                 "six_view":observe_candidate(build.assembly.tessellate(union=True),cameras),
                 "full_source":None,"automatic_operator_promotion":False}
        if registered:
            witness["full_source"]={
                "registered_source_views":measured_view_scores(
                    build.assembly.tessellate(union=True),registered,
                    full_resolution=True),
                "camera_authority":visual_authority,
                "source_count":len(registered),
                "native_valid":True}
        elif alpha is not None:
            size=(alpha.shape[1],alpha.shape[0])
            witness["full_source"]=multi_fidelity_audit(build,cameras,alpha,final=size)
        from .gallery_artifacts import finalist_gallery
        witness["gallery"]=finalist_gallery(
            build,cameras,out/"finalists"/parent.id,alpha=alpha)
        save_once(out/"finalists"/(parent.id+".json"),witness)
        winners.append({"id":parent.id,"full_source":witness["full_source"]})
    summary={"schema":"projection-loom/developmental-campaign-summary",
             "run_id":run_id,"seeds":list(types),"epochs":epochs,
             "proposals":epochs*offspring,
             "native_attempts":sum(x["attempted"] for x in all_epochs),
             "native_valid":sum(x["valid"] for x in all_epochs),
             "native_rejected":sum(x["rejected"] for x in all_epochs),
             "operational_errors":len(errors),"status":"failed" if errors else "completed",
             "niches":archive.receipt()["niches"],
             "activation_funnels":[x["activation_funnels"] for x in all_epochs],
             "finalists":winners,"auto_promotion":False,
             "source_authority":manifest["source_camera_authority"]}
    save_once(out/"summary.json",summary)
    journal.transition("location","aftermath",{
        "valid":summary["native_valid"],"errors":len(errors)})
    journal.transition("location","closed")
    journal.data["status"]="failed" if errors else "completed";journal.save()
    if errors:raise RuntimeError(f"Operational errors: {len(errors)}")
    return summary




def run_cohort(adapters, contract: IntentContract, out, *, epochs=3, offspring=4,
               exact_budget=4, finalists=2, seed=41, source_policy="auto"):
    """Use the existing single-runner OODA-HA checkpoint for every replay.

    Operator control files may safely request pause/resume or emitter
    preference at epoch boundaries. Native, source and replay gates remain
    independent of that soft choice.
    """
    out=Path(out)
    out.mkdir(parents=True,exist_ok=True)
    with single_runner(out/"session.json"):
        return _run_cohort_locked(
            adapters,contract,out,epochs=epochs,offspring=offspring,
            exact_budget=exact_budget,finalists=finalists,seed=seed,
            source_policy=source_policy)
