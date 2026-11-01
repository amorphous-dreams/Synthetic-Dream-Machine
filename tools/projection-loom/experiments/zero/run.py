"""Experiment Zero fixtures and seven-cohort controls, not Loom machinery."""
from __future__ import annotations
from pathlib import Path
import argparse
import json

from projection_loom.intent_seed import IntentContract
from projection_loom.seed_adapters import load_adapters
from projection_loom.generalized_campaign import run_cohort
from projection_loom.receipt_store import save_once

COHORTS={
    "I":("image",), "B":("brutalist",), "Z":("ziggurat",),
    "IB":("image","brutalist"), "IZ":("image","ziggurat"),
    "BZ":("brutalist","ziggurat"), "IBZ":("image","brutalist","ziggurat"),
}

def fixture_adapters(inputs,types):
    root=Path(inputs)
    return load_adapters(
        image_manifest=root/"image_group/manifest.json" if "image" in types else None,
        grammar_path=root/"brutalist_grammar/grammar.json" if "brutalist" in types else None,
        proxy_path=root/"ziggurat_proxy/proxy.json" if "ziggurat" in types else None)

def run_fixture_cohort(inputs,types,out,*,epochs=3,offspring=4,exact_budget=4,finalists=2):
    adapters=fixture_adapters(inputs,types)
    contract=IntentContract("experiment-zero-"+"-".join(types),
        "grow alternative inhabitable places",
        ("native-validity","structural-novelty") if "image" not in types else
        ("native-validity","source-silhouette","structural-novelty"),
        budgets=(("epochs",epochs),("exact",exact_budget),("offspring",offspring)))
    return run_cohort(adapters,contract,out,epochs=epochs,offspring=offspring,
                      exact_budget=exact_budget,finalists=finalists)

def run_matrix(inputs,out,*,epochs=3,offspring=4,exact_budget=4,finalists=2):
    root=Path(out)
    results={}
    for label,types in COHORTS.items():
        results[label]=run_fixture_cohort(inputs,types,root/label,
            epochs=epochs,offspring=offspring,exact_budget=exact_budget,
            finalists=finalists)
    summary={"schema":"projection-loom/seven-cohort-crucible",
             "cohorts":results,"passed":all(x["native_valid"]>0 for x in results.values())}
    save_once(root/"matrix.json",summary)
    if not summary["passed"]:
        raise RuntimeError("At least one input combination lacked native admission")
    return summary

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--inputs",required=True)
    parser.add_argument("--out",required=True)
    parser.add_argument("--epochs",type=int,default=3)
    parser.add_argument("--offspring",type=int,default=4)
    parser.add_argument("--exact-budget",type=int,default=4)
    parser.add_argument("--finalists",type=int,default=2)
    a=parser.parse_args(argv)
    r=run_matrix(a.inputs,a.out,epochs=a.epochs,offspring=a.offspring,
                 exact_budget=a.exact_budget,finalists=a.finalists)
    print(json.dumps({k:{"native_valid":v["native_valid"],"niches":v["niches"]}
                      for k,v in r["cohorts"].items()},indent=2))

if __name__=="__main__":
    main()
