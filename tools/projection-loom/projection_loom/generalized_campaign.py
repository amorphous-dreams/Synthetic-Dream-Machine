"""Subject-neutral seed composition under the existing OODAHAJournal.

This coordinates developmental rules through the only phase helm; source images
constrain provisional visual fitness, never CAD truth or survey authority.
"""
from __future__ import annotations
from pathlib import Path
from dataclasses import replace
from PIL import Image
import json
import os
import tempfile
import numpy as np

from .intent_seed import SeedBundle, IntentContract, GrowthContext
from .seed_adapters import compose_adapters, proxy_growth_program, image_growth_program
from .developmental import GrowthNode, GrowthProgram, compile_growth, mutate_growth, crossover_growth
from .intent_evolution import (QualityArchive, ScoredCandidate, structural_descriptor,
                               fair_auditions, fixed_inspection_cameras,
                               observe_candidate, multi_fidelity_audit)
from .fractal_ooda_ha import OODAHAJournal
from .provenance_encoding import canonical_json_sha256

def save_once(path, payload):
    """Publish one immutable JSON receipt without replacing competing writers.

    Unique scratch files and hard-link publication make the final name atomic:
    a competing writer can create it first, but cannot have it overwritten.
    A crash may leave a .pending-* scratch file, never a partial final receipt.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, sort_keys=True, indent=2, allow_nan=False) + "\n"
    if path.exists():
        if path.read_text(encoding="utf8") != content:
            raise ValueError("Replay collides with a different immutable receipt")
        return
    fd, pending = tempfile.mkstemp(prefix="." + path.name + ".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(pending, path)
        except FileExistsError:
            if path.read_text(encoding="utf8") != content:
                raise ValueError("Replay collides with a different immutable receipt")
    finally:
        Path(pending).unlink(missing_ok=True)


def initial_program(adapters):
    """Compose adapter-offered developmental capabilities without kind switches.

    The highest explicit constructive priority supplies the root; other
    independently authored structural programs enter as named, attributable
    subtrees. Original image observations remain visual constraints when any
    constructive program exists. All input source identities remain separate.
    """
    offers = sorted(adapters, key=lambda a:(-a.composition_priority, a.seed.identity))
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
    # Multiple images remain independent testimony; don't invent registration.
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


def evaluate(item,cameras,alpha,out):
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


def run_cohort(adapters,contract:IntentContract,out,*,epochs=3,offspring=4,
               exact_budget=4,finalists=2,seed=41):
    """Run any typed seed bundle without naming experiment fixtures.

    The fixed five-phase journal remains the only execution controller.
    """
    if not (1<=epochs<=12 and 1<=offspring<=24 and
            1<=exact_budget<=offspring and 1<=finalists<=12):
        raise ValueError("Unbounded campaign request")
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
    manifest={"schema":"projection-loom/experimental-input-cohort",
        "run_id":context.run_id,"seeds":seeds.manifest(),"intent":contract.identity,
        "initial_program":initial.to_dict(),"types":list(types),
        "epochs":epochs,"offspring":offspring,"exact_budget":exact_budget,
        "source_camera_authority":"provisional" if any(a.visual_source for a in adapters) else "none"}
    save_once(out/"pre_registration.json",manifest)
    if (out/"summary.json").exists():
        return _completed_summary(out, manifest, contract)
    journal=OODAHAJournal(out/"session.json",identity={
        "location":contract.location,"score_state":manifest["source_camera_authority"],
        "run":context.run_id},initial={},autonomy=1.)
    alpha=source_alpha(adapters)
    seed_model=compile_growth(initial)
    cameras=fixed_inspection_cameras(seed_model.assembly.tessellate(union=True))
    archive=QualityArchive()
    all_epochs=[]
    errors=[]
    for epoch in range(epochs):
        output=out/f"epoch_{epoch:03d}.json"
        if output.exists():
            all_epochs.append(restore_archive(output,archive));continue
        eid=f"location/e{epoch:03d}"
        journal.begin(eid,parent="location",scope="epoch",
                      evidence={"epoch":epoch,"source":context.run_id},parent_phase="act")
        journal.transition(eid,"orient",{"source_digest":seeds.identity})
        journal.transition(eid,"decide",{"exact_budget":exact_budget})
        journal.transition(eid,"act",{"instruction":"construct, audit, score"})
        offered=proposals(initial,archive,context,epoch,offspring)
        seats=fair_auditions(offered,exact_budget)
        scored=[]
        for item in seats:
            cid=eid+"/"+item["id"]
            journal.begin(cid,parent=eid,scope="candidate",
                          evidence={"program":item["program"].identity},parent_phase="act")
            journal.transition(cid,"orient",{"kernel":"native"})
            journal.transition(cid,"decide",{"gate":"strict BRep before score"})
            journal.transition(cid,"act",{"candidate":item["id"]})
            receipt=out/"receipts"/(item["id"]+".json")
            if receipt.exists():
                result=json.loads(receipt.read_text(encoding="utf8"))
                if result["program_sha256"]!=item["program"].identity:
                    raise ValueError("Candidate replay identity conflict")
            else:
                result=evaluate(item,cameras,alpha,out)
                save_once(receipt,result)
            journal.transition(cid,"aftermath",{"state":result["state"]})
            journal.transition(cid,"closed")
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
                "candidates":scored,"archive":archive.receipt()}
        save_once(output,record)
        all_epochs.append(record)
        journal.transition(eid,"aftermath",{"valid":record["valid"],
                                           "rejected":record["rejected"]})
        journal.transition(eid,"closed")
    winners=[]
    for parent in archive.parents()[:finalists]:
        build=compile_growth(parent.program)
        witness={"id":parent.id,"program_sha256":parent.program.identity,
                 "native":build.audit(),
                 "six_view":observe_candidate(build.assembly.tessellate(union=True),cameras),
                 "full_source":None,"automatic_operator_promotion":False}
        if alpha is not None:
            size=(alpha.shape[1],alpha.shape[0])
            witness["full_source"]=multi_fidelity_audit(build,cameras,alpha,final=size)
        from .gallery_artifacts import finalist_gallery
        witness["gallery"]=finalist_gallery(
            build,cameras,out/"finalists"/parent.id,alpha=alpha)
        save_once(out/"finalists"/(parent.id+".json"),witness)
        winners.append({"id":parent.id,"full_source":witness["full_source"]})
    summary={"schema":"projection-loom/developmental-campaign-summary",
             "run_id":context.run_id,"seeds":list(types),"epochs":epochs,
             "proposals":epochs*offspring,
             "native_attempts":sum(x["attempted"] for x in all_epochs),
             "native_valid":sum(x["valid"] for x in all_epochs),
             "native_rejected":sum(x["rejected"] for x in all_epochs),
             "operational_errors":len(errors),"status":"failed" if errors else "completed",
             "niches":archive.receipt()["niches"],
             "finalists":winners,"auto_promotion":False,
             "source_authority":manifest["source_camera_authority"]}
    save_once(out/"summary.json",summary)
    journal.transition("location","aftermath",{
        "valid":summary["native_valid"],"errors":len(errors)})
    journal.transition("location","closed")
    journal.data["status"]="failed" if errors else "completed";journal.save()
    if errors:raise RuntimeError(f"Operational errors: {len(errors)}")
    return summary


