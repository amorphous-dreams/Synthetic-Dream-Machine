"""Matched N9 native shelter/ascent site experiment, source-fixed and replayable.

This fixture authors two original bodies and two distinct explicit intentions.
Four campaigns share their source construction and budgets; independently
regrown STEP and causal location receipts decide admission. No generated mask,
external survey, load or artistic winner enters the data path.
"""
from pathlib import Path
import argparse
from .developmental import GrowthNode,GrowthProgram
from .place_genome import PlaceBody,PlaceGenome
from .intent_seed import IntentContract
from .location_stack import LocationStack,Frame
from .spatial_intent import SpatialGoal,SpatialIntent
from .place_campaign import run_place_campaign,verify_place_campaign
from .generalized_campaign import save_once
from .provenance_encoding import canonical_json_sha256


def run_matched_architecture(out,*,seeds=(41,73),epochs=2):
    if not 1<=len(seeds)<=4 or not 1<=epochs<=3:
        raise ValueError("Matched location experiment requires finite preregistered budgets")
    out=Path(out)
    if out.exists():
        raise ValueError("Matched site comparison needs a new immutable root")
    out.mkdir(parents=True)
    def body(name,size,position):
        return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",
                         size=size),)),position)
    original=PlaceGenome((body("begin",(3,3,1),(0,0,0)),
                          body("summit",(3,3,2.2),(9,0,0))))
    intent=IntentContract("n9-matched-site","Which relation should grow here?",
                          ("cover","rise"))
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("author-local","local3d","model_unit"))
    source_digest=inventory.to_dict()["snapshot_sha256"]
    rows=[]
    for seed in seeds:
        for name,goal in (("ascent",SpatialGoal("ascend","begin","summit",.9,.6)),
                          ("shelter",SpatialGoal("shelter","begin","roof",.9,1.1))):
            spatial=SpatialIntent(intent.identity,(goal,),"test-operator")
            folder=out/f"seed-{seed}"/name
            summary=run_place_campaign(inventory,intent,spatial,original,folder,
                        epochs=epochs,offspring=2,exact_budget=1,seed=seed)
            if not summary["admitted"]:
                raise AssertionError("Fixed-source architectural arm lacked native accepted geometry")
            if verify_place_campaign(folder)!=summary:
                raise AssertionError("Native architectural arm failed immutable replay")
            first=next(x for x in summary["candidates"] if x["status"]=="admitted")
            rows.append({"seed":seed,"arm":name,
                         "spatial_intent_sha256":spatial.identity,
                         "original_genome_sha256":original.identity,
                         "original_inventory_sha256":source_digest,
                         "native_candidate_sha256":first["genome_sha256"],
                         "workspace_sha256":first["workspace_sha256"],
                         "admitted":summary["admitted"],
                         "attempted":summary["attempted"],
                         "deferred":summary["deferred"],
                         "operator_winner":None})
    for seed in seeds:
        pair=[r for r in rows if r["seed"]==seed]
        if len(pair)!=2 or pair[0]["native_candidate_sha256"]==pair[1]["native_candidate_sha256"]:
            raise AssertionError("Authored architecture changed but native descendant did not")
        if len({p["original_genome_sha256"] for p in pair})!=1:
            raise AssertionError("Paired experiment changed original sources")
        if pair[0]["attempted"]!=pair[1]["attempted"]:
            raise AssertionError("Paired experiment used unmatched exact audition budgets")
    report={"schema":"projection-loom/n9-matched-spatial-development",
            "original_genome_sha256":original.identity,
            "source_inventory_sha256":source_digest,
            "epochs":epochs,"offspring":2,"exact_budget":1,"seeds":list(seeds),
            "arms":rows,"source_camera_registration":False,
            "accessibility_certification":False,"load_certification":False,
            "automatic_artistic_winner":False}
    save_once(out/"comparison.json",report)
    return report


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--epochs",type=int,default=2)
    args=parser.parse_args(argv)
    print(run_matched_architecture(args.out,epochs=args.epochs))


if __name__=="__main__":
    main()
