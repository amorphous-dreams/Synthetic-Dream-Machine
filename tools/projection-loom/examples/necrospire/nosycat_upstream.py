"""Source-pinned nosycat CC0 procedural architecture and fresh Experiment Zero.

The archive contains authored OpenSCAD repetition rules, not a universal
building grammar. We reuse motifs through independently audited native CAD.
The original upstream SCAD runs as a non-authoritative reference witness;
STL never substitutes for BRep nor becomes a seed mesh.
"""
from __future__ import annotations
from pathlib import Path
from hashlib import sha256
import argparse
import json
import re
import zipfile

from projection_loom.pipeline import Project
from projection_loom.capability_stack import Capability, CapabilityRecipe, CapabilityCompositor
from projection_loom.evidence_receipts import CompoundAuditReceipt
from projection_loom.epochs import _hash, _atomic

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
DEP=ROOT/"third_party"/"nosycat-brutalism2.json"
PIN="8a89504f2abf355f56f4ea93c9a50fbdc60fb3664bdad019c65e6582a91ff9a3"
SEED=58363
UPSTREAM=("apartments1","apartments2","apartments3",
          "commercial1","commercial2","commercial3","hotel1","institute1")
NEW_LOCI={
    "brutalist.bands":(.0,1.0,1.0),
    "brutalist.piers":(.0,1.0,1.0),
    "brutalist.band_count":(2.,6.,4.),
    "brutalist.pier_count":(2.,5.,3.),
    "brutalist.projection":(.16,.38,.26),
}
SOURCE=HERE/"project_alpha.json"
RECIPE=HERE/"hybrid"/"recipe_alpha.json"
OLD=HERE/"lineages"/"four_attractor_fresh"/"review.json"


def upstream(path):
    data=Path(path).read_bytes()
    if sha256(data).hexdigest()!=PIN:
        raise ValueError("Upstream CC0 archive failed SHA-256 pin")
    manifest=json.loads(DEP.read_text())
    if manifest["sha256"]!=PIN or manifest["license"]!="CC0-1.0":
        raise ValueError("Dependency provenance mismatch")
    with zipfile.ZipFile(path) as z:
        paths=z.namelist()
        if any(item.startswith("/") or ".." in Path(item).parts for item in paths):
            raise ValueError("Unsafe upstream ZIP path")
        expected={f"brutalism2/{name}.scad" for name in UPSTREAM}
        if not expected.issubset(paths):
            raise ValueError("CC0 source grammar set incomplete")
        scripts={key:z.read(f"brutalism2/{key}.scad").decode("utf-8")
                 for key in UPSTREAM}
        if (not re.search(r"for\s*\(\s*z\s*=\s*\[0:5\]",scripts["institute1"])
                or not re.search(r"for\s*\(\s*x\s*=\s*\[0:4\]",scripts["institute1"])
                or "cube(" not in scripts["apartments1"]
                or "for (z = [0:7])" not in scripts["commercial1"]):
            raise ValueError("Pinned source motifs unexpectedly differ")
    return scripts


def prepare(out, archive):
    out=Path(out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Start with empty output; never recycle an old lineage")
    if "experiments" in out.parts or "breeding_20261025" in out.parts:
        raise ValueError("Frozen pilot directory may not be written")
    scripts=upstream(archive)
    base=Project.load(SOURCE)
    recipe=CapabilityRecipe.load(RECIPE)
    new_project=json.loads(SOURCE.read_text())
    new_project["builder"]="grow_nosycat.py:grow"
    initial=dict(recipe.initial)
    # Architectural source priors, never reproduction from the earlier winners.
    ur=json.loads((HERE.parent/"ur"/"project.json").read_text())
    brut=json.loads((HERE.parent/"brutalist"/"project.json").read_text())
    ratios={"ur_stage":36.0/float(ur["initial"]["base_length"]),
            "ur_rise":float(ur["initial"]["stage_height"])/float(ur["initial"]["base_height"]),
            "brutalist_overhang":float(brut["initial"]["cantilever_offset"])/26.,
            "brutalist_slab":float(brut["initial"]["slab_length"])/19.}
    for gene,unit_ratio in zip(("terrace_overhang","spire_segmentation",
                                "terrace_offset","gallery_reach"),
                               (ratios["ur_stage"],ratios["ur_rise"],
                                ratios["brutalist_overhang"],ratios["brutalist_slab"])):
        lo,hi=base.bounds[gene]
        initial[gene]=float(lo+unit_ratio*(hi-lo))
    bounds=dict(recipe.bounds)
    for k,(lo,hi,seed) in NEW_LOCI.items():
        bounds[k]=(lo,hi)
        initial[k]=seed
    new_project["bounds"]={**new_project["bounds"],
                           **{k:[v[0],v[1]] for k,v in NEW_LOCI.items()}}
    new_project["initial"]={k:initial[k] for k in new_project["bounds"]}
    steps=list(recipe.steps)
    steps.extend([
        Capability("brutalist.bands.cad","Fortress","cad",
                   depends_on=("fortress.cad",),part="nosycat facade band 0",
                   activation="brutalist.bands",has=("#has/repeated-bands",)),
        Capability("brutalist.piers.cad","Fortress","cad",
                   depends_on=("fortress.cad",),part="nosycat vertical pier 0",
                   activation="brutalist.piers",has=("#has/modular-piers",))
    ])
    original_sha=sha256((HERE/"grow.py").read_bytes()).hexdigest()
    if PIN not in (HERE/"grow_nosycat.py").read_text():
        raise ValueError("The native builder lost its pinned upstream dependency identity")
    r=CapabilityRecipe(location=recipe.location,pet_name=recipe.pet_name,
        steps=steps,bounds=bounds,initial=initial,
        cad_keys=tuple(new_project["initial"]),
        # OODA-HA source witnesses hold only registered project/image evidence;
        # external CC0 dependencies retain an independently pinned manifest.
        source_hashes=dict(recipe.source_hashes),
        provenance=recipe.provenance,
        seed_entity_sha256=recipe.seed_entity_sha256)
    project_path=HERE/"project_nosycat.generated.json"
    recipe_path=HERE/"hybrid"/"recipe_nosycat.generated.json"
    project_path.write_text(json.dumps(new_project,sort_keys=True,indent=2)+"\n")
    r.save(recipe_path)
    project=Project.load(project_path)
    compositor=CapabilityCompositor(
        project,r,size=(64,96),
        source_mask=project.source_mask((64,96)))
    result=compositor.grow(r.initial)
    if not CompoundAuditReceipt.from_native(result.audit).render_admissible:
        raise ValueError("New source-derived seed lacks native CAD admission")
    state={row["id"]:row["state"] for row in result.steps}
    if state.get("brutalist.bands.cad")!="complete" or state.get("brutalist.piers.cad")!="complete":
        raise ValueError("Original CC0 grammar motifs did not activate")
    out.mkdir(parents=True,exist_ok=True)
    (out/"inputs").mkdir(exist_ok=True)
    (out/"inputs"/"project.json").write_bytes(project_path.read_bytes())
    (out/"inputs"/"recipe.json").write_bytes(recipe_path.read_bytes())
    dependency={
        "schema":"projection-loom/upstream-brutalist-capability",
        "url":json.loads(DEP.read_text())["url"], "license":"CC0-1.0",
        "archive_sha256":PIN,
        "source_files":{k:sha256(v.encode()).hexdigest() for k,v in scripts.items()},
        "motifs":{
          "horizontal_band_rule":"institute1.scad for z = [0:5]",
          "vertical_pier_rule":"institute1.scad for x = [0:4]",
          "floor_slab_rule":"commercial1.scad for z = [0:7]",
          "balcony_repetition":"apartments1.scad for i = [0:7]"
        },
        "reuse":"native CadQuery adaptation; upstream OpenSCAD itself remains runnable",
        "non_authority":"STL witness not a CAD BRep nor automatically a generalized grammar"}
    manifest={
        "schema":"projection-loom/nosycat-four-attractor-lineage",
        "seed":SEED,"parent_lineage":None,
        "frozen_six_generation_pilot":"excluded",
        "prior_four_attractor_experiment":"comparison-only; not a genetic donor",
        "original_alpha_sha256":sha256((HERE/"source_alpha_8bit.png").read_bytes()).hexdigest(),
        "original_rgba_sha256":sha256((HERE/"source_rgba.png").read_bytes()).hexdigest(),
        "ur_proxy_sha256":sha256((HERE.parent/"ur"/"grow.py").read_bytes()).hexdigest(),
        "brutalism_source":dependency,
        "source_guide_ratios":ratios,"recipe_sha256":r.sha256,
        "initial_sha256":_hash(r.initial),
        "activated_capabilities":[k for k in state if k.startswith("brutalist.") and state[k]=="complete"],
        "policy":{"generations":3,"offspring_per_family":3,"exact_per_generation":12,
                  "detail_per_generation":6,"score_size":[64,96],
                  "overscan":2,"seed":SEED}}
    manifest["sha256"]=_hash(manifest)
    _atomic(out/"inputs"/"manifest.json",manifest)
    return manifest


def compare(out):
    out=Path(out)
    previous=json.loads(OLD.read_text())
    review=json.loads((out/"experiment_zero_review"/"review.json").read_text())
    archive=json.loads((out/"lineage_archive.json").read_text())
    session=json.loads((out/"session.json").read_text())
    contract=json.loads((out/"inputs"/"manifest.json").read_text())
    if session["status"]!="completed" or len(archive["generations"])!=3:
        raise ValueError("New lineage incomplete")
    if review["reviewed"]<1:
        raise ValueError("No native valid scored descendants")
    def row_new(r):
        return {"id":r["id"],"family":r["family"],
                "silhouette_iou":1-float(r["losses"]["silhouette"]),
                "combined_loss":float(r["combined_loss"]),
                "overscan_fraction":r["observation"]["extra_fraction"],
                "active_brutalist_bands":r["genome"]["brutalist.bands"]>=.5,
                "active_brutalist_piers":r["genome"]["brutalist.piers"]>=.5,
                "genome":r["genome"]}
    def row_old(r):
        return {"id":r["lineage_id"],"family":r["family"],
                "silhouette_iou":r["oblique_alpha_iou"],
                "combined_loss":r["original_combined_loss"],
                "overscan_fraction":r["extra_frame_fraction"]}
    old=[row_old(r) for r in previous["ranked_advisory_survivors"]]
    new=[row_new(r) for r in review["candidates"]]
    def stats(rows):
        return {"reviewed":len(rows),
                "best_alpha_iou":max(r["silhouette_iou"] for r in rows),
                "mean_alpha_iou":sum(r["silhouette_iou"] for r in rows)/len(rows),
                "best_global_loss":min(r["combined_loss"] for r in rows),
                "distinct_families":sorted({r["family"] for r in rows}),
                "mean_extra_fraction":sum(r["overscan_fraction"] for r in rows)/len(rows)}
    base,newstats=stats(old),stats(new)
    result={
        "schema":"projection-loom/nosycat-comparison",
        "prior_lineage_review_sha256":previous["sha256"],
        "new_lineage_review_sha256":review["sha256"],
        "new_source_manifest_sha256":contract["sha256"],
        "baseline":base,"cc0_brutalist":newstats,
        "delta_best_alpha_iou":newstats["best_alpha_iou"]-base["best_alpha_iou"],
        "delta_mean_alpha_iou":newstats["mean_alpha_iou"]-base["mean_alpha_iou"],
        "delta_best_global_loss":newstats["best_global_loss"]-base["best_global_loss"],
        "new_band_enabled_review":sum(r["active_brutalist_bands"] for r in new),
        "new_pier_enabled_review":sum(r["active_brutalist_piers"] for r in new),
        "new_survivors":new,
        "comparison_scope":"two separate 3-generation fresh lineages; same source, camera, budgets and score size; different seeds and construction grammar",
        "limits":"observational across changed seed and new gene space; not matched random controlled causal improvement",
        "operator_authority":"advisory-only; no winner automatically promoted",
    }
    result["sha256"]=_hash(result)
    _atomic(out/"comparison.json",result)
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action",choices=["prepare","compare"])
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--archive",type=Path)
    args=parser.parse_args()
    if args.action=="prepare":
        if not args.archive:parser.error("prepare requires --archive")
        result=prepare(args.out,args.archive)
    else: result=compare(args.out)
    print(json.dumps(result,indent=2))


if __name__=="__main__":
    main()
