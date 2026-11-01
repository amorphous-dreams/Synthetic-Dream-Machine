"""Independent seed-carrier admission under the existing source-bound place helm.

Native construction and auditions remain fixed across arms. This witnesses
the portability of provenance/intake, not automatic image-to-CAD generation.
"""
from __future__ import annotations
import json
from pathlib import Path
from .intent_seed import SeedBundle
from .location_stack import LocationStack, Frame
from .place_campaign import run_place_campaign, verify_place_campaign
from .receipt_store import save_once
from .provenance_encoding import canonical_json_sha256

KINDS=frozenset(("image-group","constructive-grammar","geometry-proxy"))


def _pre(arms,intent,spatial,genome,seed,epochs,offspring,exact_budget):
    if (not isinstance(arms,dict) or not 2<=len(arms)<=3
            or set(arms)-KINDS or any(
                not isinstance(b,SeedBundle) or len(b.entries)!=1
                or b.entries[0].kind!=kind for kind,b in arms.items())):
        raise ValueError("Independent source study needs two or three distinct seed carriers")
    if (type(seed) is not int or type(epochs) is not int or not 1<=epochs<=3
            or type(offspring) is not int or not 1<=offspring<=4
            or type(exact_budget) is not int or not 1<=exact_budget<=offspring):
        raise ValueError("Independent source study needs bounded equal native budgets")
    spatial.bind(intent)
    body={"schema":"projection-loom/source-transfer-preregistration",
          "intent_sha256":intent.identity,"spatial_intent_sha256":spatial.identity,
          "original_genome_sha256":genome.identity,
          "arms":[{"kind":kind,"bundle_sha256":arms[kind].identity}
                  for kind in sorted(arms)],
          "seed":seed,"epochs":epochs,"offspring":offspring,
          "exact_budget":exact_budget,"original_native_genome_fixed":True,
          "source_conditioned_architecture_proven":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def _inventory(bundle,intent):
    stack=LocationStack.admit_seed_bundle(bundle,intent)
    local=[frame for frame in stack.frames.values() if frame.kind=="local3d"]
    if len(local)>1:
        raise ValueError("Independent source study requires a unique authored local frame")
    if not local:
        stack.add_frame(Frame("author-local","local3d","model_unit"))
    stack.audit()
    return stack


def _summary(pre,root,arms,intent):
    rows=[]
    for arm in pre["arms"]:
        kind=arm["kind"]
        report=verify_place_campaign(root/kind)
        written=json.loads((root/kind/"pre_registration.json").read_text(encoding="utf8"))
        # The selected carrier must be the one actually admitted to this
        # location; a self-consistent but unrelated source inventory cannot
        # inherit the operator's original source designation.
        expected_inventory=_inventory(arms[kind],intent)
        if written["original_inventory_sha256"]!=expected_inventory.to_dict()["snapshot_sha256"]:
            raise ValueError("Source carrier and native inventory are not the same attributed bytes")
        if (written["original_genome_sha256"]!=pre["original_genome_sha256"]
                or written["spatial_intent_sha256"]!=pre["spatial_intent_sha256"]
                or written["intent_sha256"]!=pre["intent_sha256"]
                or written["seed"]!=pre["seed"] or written["epochs"]!=pre["epochs"]
                or written["offspring"]!=pre["offspring"]
                or written["exact_budget"]!=pre["exact_budget"]):
            raise ValueError("Native source arm changed its fixed original construction or budget")
        rows.append({"kind":kind,"bundle_sha256":arm["bundle_sha256"],
                     "inventory_sha256":written["original_inventory_sha256"],
                     "pre_registration_sha256":report["pre_registration_sha256"],
                     "attempted":report["attempted"],"deferred":report["deferred"],
                     "admitted":report["admitted"],"spatial_niches":report["spatial_niches"],
                     "candidate_genomes":[{"id":row["candidate_id"],
                                           "genome_sha256":row["genome_sha256"]}
                                          for row in report["candidates"]],
                     "native_morphologies":[{"id":row["candidate_id"],
                        "descriptor":({key:value for key,value in row["descriptor"].items()
                                       if key!="native_scene_sha256"}
                                      if row.get("descriptor") else None)}
                        for row in report["candidates"]]})
    comparable_genomes=[row["candidate_genomes"] for row in rows]
    comparable_morphologies=[row["native_morphologies"] for row in rows]
    body={"schema":"projection-loom/source-transfer-native-comparison",
          "source_preregistration_sha256":pre["sha256"],
          "arms":rows,"native_attempts":sum(x["attempted"] for x in rows),
          "equal_native_budgets":len({x["attempted"] for x in rows})==1,
          "distinct_source_inventories":len({x["inventory_sha256"] for x in rows})==len(rows),
          "identical_native_candidate_genomes":all(x==comparable_genomes[0]
                                                      for x in comparable_genomes),
          "identical_native_morphologies":all(x==comparable_morphologies[0]
                                               for x in comparable_morphologies),
          "source_conditioned_architecture_proven":False,
          "source_camera_registration":False,
          "automatic_artistic_winner":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def run_source_transfer(arms,intent,spatial,genome,out,*,
                        seed=41,epochs=1,offspring=2,exact_budget=1):
    pre=_pre(arms,intent,spatial,genome,seed,epochs,offspring,exact_budget)
    root=Path(out)
    if root.exists():
        raise ValueError("Source transfer needs a new immutable study root")
    root.mkdir(parents=True)
    save_once(root/"preregistration.json",pre)
    try:
        for row in pre["arms"]:
            kind=row["kind"]
            run_place_campaign(_inventory(arms[kind],intent),
                intent,spatial,genome,root/kind,seed=seed,epochs=epochs,
                offspring=offspring,exact_budget=exact_budget)
        result=_summary(pre,root,arms,intent)
        save_once(root/"comparison.json",result)
        return verify_source_transfer(arms,intent,spatial,genome,root,
            seed=seed,epochs=epochs,offspring=offspring,exact_budget=exact_budget)
    except Exception:
        (root/"FAILED").write_text("Source study incomplete; no accepted outcome\n")
        raise


def verify_source_transfer(arms,intent,spatial,genome,out,*,
                           seed=41,epochs=1,offspring=2,exact_budget=1):
    root=Path(out)
    pre=_pre(arms,intent,spatial,genome,seed,epochs,offspring,exact_budget)
    if (root/"FAILED").exists() or json.loads(
            (root/"preregistration.json").read_text(encoding="utf8"))!=pre:
        raise ValueError("Original source transfer preregistration diverged")
    actual=json.loads((root/"comparison.json").read_text(encoding="utf8"))
    if actual!=_summary(pre,root,arms,intent):
        raise ValueError("Source transfer comparison diverged from independent native arm witnesses")
    return actual
