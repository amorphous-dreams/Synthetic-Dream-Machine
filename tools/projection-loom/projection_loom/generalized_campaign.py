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
from .seed_adapters import compose_adapters, proxy_growth_program
from .developmental import GrowthNode, GrowthProgram, compile_growth, mutate_growth, crossover_growth
from .intent_evolution import (QualityArchive, ScoredCandidate, structural_descriptor,
                               fair_auditions, fixed_inspection_cameras,
                               observe_candidate, multi_fidelity_audit)
from .fractal_ooda_ha import OODAHAJournal
from .provenance_encoding import canonical_json_sha256

def save_once(path,payload):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    content=json.dumps(payload,sort_keys=True,indent=2,allow_nan=False)+"\n"
    if path.exists():
        if path.read_text(encoding="utf8")!=content:
            raise ValueError("Replay collides with a different immutable receipt")
        return
    tmp=path.with_name(path.name+".pending")
    tmp.write_text(content,encoding="utf8");tmp.replace(path)


def initial_program(adapters):
    """Compose source capabilities into one heritable proposed construction.

    A reference image constrains possible appearance, not world coordinates.
    Proxy and grammar supply proposed constructive operations and tiers.
    """
    types={a.seed.kind:a for a in adapters}
    proxy=types.get("geometry-proxy")
    grammar=types.get("constructive-grammar")
    if proxy:
        nodes=list(proxy_growth_program(proxy.program).nodes)
    elif grammar:
        size=(grammar.program["growth_program"]["nodes"][0]["size"]
              if "growth_program" in grammar.program else
              grammar.program["steps"][0]["size"])
        nodes=[GrowthNode("root","foundation",size=tuple(size))]
    else:
        nodes=[GrowthNode("root","foundation",size=(3,3,7))]
    if grammar:
        if "growth_program" in grammar.program:
            authored=GrowthProgram.from_dict(grammar.program["growth_program"])
            if not proxy:
                nodes=list(authored.nodes)
            else:
                mapping={authored.nodes[0].key:"root"}
                mapping.update({n.key:"grammar_"+n.key for n in authored.nodes[1:]})
                for node in authored.nodes[1:]:
                    nodes.append(replace(node,key=mapping[node.key],
                        parent=mapping.get(node.parent),
                        target=mapping.get(node.target)))
        else:
            prev="root"
            for i,step in enumerate(grammar.program["steps"][1:],1):
                if step["op"]!="box":
                    continue
                key=f"grammar_{i}"
                nodes.append(GrowthNode(key,"spawn",parent=prev,
                    face=step.get("grow_face","up"),size=tuple(step["size"])))
                prev=key
    if len(nodes)==1:
        nodes.append(GrowthNode("crown","spawn",parent="root",face="up",size=(1.7,1.7,1.3)))
    return GrowthProgram(tuple(nodes))


def source_alpha(adapters):
    images=sorted((a for a in adapters if a.seed.kind=="image-group"),
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


def restore_archive(epoch_file,archive):
    rows=json.loads(Path(epoch_file).read_text(encoding="utf8"))
    for row in rows["candidates"]:
        if row["state"]=="native-valid":
            program=GrowthProgram.from_dict({"nodes":row["program"]})
            archive.consider(ScoredCandidate(row["id"],program,True,
                row["metrics"],structural_descriptor(program),row["parent"]))
    return rows


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
        "source_camera_authority":"provisional" if "image-group" in types else "none"}
    save_once(out/"pre_registration.json",manifest)
    if (out/"summary.json").exists():
        return json.loads((out/"summary.json").read_text(encoding="utf8"))
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
             "operational_errors":len(errors),"niches":archive.receipt()["niches"],
             "finalists":winners,"auto_promotion":False,
             "source_authority":manifest["source_camera_authority"]}
    save_once(out/"summary.json",summary)
    journal.transition("location","aftermath",{
        "valid":summary["native_valid"],"errors":len(errors)})
    journal.transition("location","closed")
    journal.data["status"]="completed";journal.save()
    if errors:raise RuntimeError(f"Operational errors: {len(errors)}")
    return summary


