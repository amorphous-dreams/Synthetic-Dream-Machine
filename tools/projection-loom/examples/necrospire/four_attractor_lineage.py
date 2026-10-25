"""Begin a new source-bound Necrospire ancestry from four attributed attractors.

Inputs: original oblique RGBA, independent oblique alpha, interpretive Ur
ziggurat proxy, and locally authored brutalist modular grammar. The latter
two only guide unitless *proposal loci*; they cannot certify or import
architectural geometry and never replace the source image or native CAD gates.

The historical six-generation pilot remains wholly outside this lineage.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image

from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor
from projection_loom.evidence_receipts import CompoundAuditReceipt
from projection_loom.pipeline import Project
from projection_loom.epochs import _hash, _atomic

HERE = Path(__file__).resolve().parent
REPO_EVIDENCE = {
    "rgba": HERE / "source_rgba.png",
    "alpha": HERE / "source_alpha_8bit.png",
    "ziggurat_project": HERE.parent / "ur" / "project.json",
    "ziggurat_rules": HERE.parent / "ur" / "grow.py",
    "ziggurat_provenance": HERE.parent / "ur" / "provenance.json",
    "brutalist_project": HERE.parent / "brutalist" / "project.json",
    "brutalist_rules": HERE.parent / "brutalist" / "grow.py",
    "brutalist_provenance": HERE.parent / "brutalist" / "provenance.json",
    "source_project": HERE / "project_alpha.json",
    "source_recipe": HERE / "hybrid" / "recipe_alpha.json",
}
SEED = 58321


def file_hash(path):
    return sha256(Path(path).read_bytes()).hexdigest()


def sources():
    missing = [name for name, file in REPO_EVIDENCE.items() if not file.is_file()]
    if missing:
        raise FileNotFoundError("Four-attractor source absent: " + ", ".join(missing))
    rgba = np.asarray(Image.open(REPO_EVIDENCE["rgba"]).convert("RGBA"))
    alpha = np.asarray(Image.open(REPO_EVIDENCE["alpha"]).convert("L"))
    if rgba.shape != (1536, 1024, 4) or alpha.shape != (1536, 1024):
        raise ValueError("Original oblique source dimensions changed")
    if not np.array_equal(rgba[..., 3], alpha):
        raise ValueError("Original oblique alpha no longer matches RGBA witness")
    ur = json.loads(REPO_EVIDENCE["ziggurat_project"].read_text())
    brut = json.loads(REPO_EVIDENCE["brutalist_project"].read_text())
    return ur, brut


def guide_loci(project, ur, brut):
    """Only scale-free analogies move genes: not real-world unit transfers.

    Ur: authored lower stage length and an interpretive 36-unit upper stage.
    Brutalism: authored 26-unit podium and 19-unit core from grow.py.
    Both numeric constructions are source-bound synthetic/interpretive priors.
    """
    ur_step = 36.0 / float(ur["initial"]["base_length"])
    ur_rise = float(ur["initial"]["stage_height"]) / float(ur["initial"]["base_height"])
    brutal_overhang = float(brut["initial"]["cantilever_offset"]) / 26.0
    brutal_slab = float(brut["initial"]["slab_length"]) / 19.0
    scalars = {
        "terrace_overhang": ur_step,
        "spire_segmentation": ur_rise,
        "gallery_reach": brutal_slab,
        "terrace_offset": brutal_overhang,
    }
    targets = {}
    for gene, normalized in scalars.items():
        lo, hi = project.bounds[gene]
        targets[gene] = float(lo + min(1., max(0., normalized)) * (hi - lo))
    return targets, {"ur_stage_footprint": ur_step,
                     "ur_stage_height_ratio": ur_rise,
                     "brutalist_cantilever_over_podium": brutal_overhang,
                     "brutalist_slab_over_core": brutal_slab}


def prepare(out):
    out = Path(out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Fresh lineage requires a new EMPTY output root")
    if "experiments" in out.parts or "breeding_20261025" in out.parts:
        raise ValueError("The frozen six-generation pilot remains untouched")
    ur, brut = sources()
    project = Project.load(REPO_EVIDENCE["source_project"])
    recipe = CapabilityRecipe.load(REPO_EVIDENCE["source_recipe"])
    if recipe.location != project.location or file_hash(project.reference) != recipe.source_hashes["image"]:
        raise ValueError("Original source identity does not agree with the recipe")
    guide, analogies = guide_loci(project, ur, brut)
    project_dict = json.loads(REPO_EVIDENCE["source_project"].read_text())
    original = dict(recipe.initial)
    # Bounded relaxation can find a valid guided initial specimen without
    # presenting a rejected CAD construction as a successful ancestor.
    tested = []
    choice = None
    for strength in (1., .5, .25, .125, 0.):
        changed = dict(original)
        changed.update({k: float(original[k] + strength * (v - original[k]))
                        for k, v in guide.items()})
        generated = CapabilityRecipe(
            location=recipe.location, pet_name=recipe.pet_name,
            steps=recipe.steps, bounds=recipe.bounds, initial=changed,
            cad_keys=recipe.cad_keys, source_hashes=recipe.source_hashes,
            provenance=recipe.provenance)
        # No change to the original alpha project: this fork captures a new
        # source-bound constructor in its OWN recipe + project on the runner.
        project_dict["initial"] = {k: changed[k] for k in project.initial}
        candidate_project = HERE / "project_four_attractor.generated.json"
        candidate_recipe = HERE / "hybrid" / "recipe_four_attractor.generated.json"
        candidate_project.write_text(json.dumps(project_dict, sort_keys=True, indent=2) + "\n")
        generated.save(candidate_recipe)
        assembled = Project.load(candidate_project)
        try:
            comp = CapabilityCompositor(
                assembled, generated, camera=assembled.cameras[assembled.reference_view],
                size=(64, 96), source_mask=assembled.source_mask((64, 96)))
            grown = comp.grow(changed)
            valid = CompoundAuditReceipt.from_native(grown.audit).render_admissible
        except (ValueError, RuntimeError, OSError) as exc:
            valid = False
            tested.append({"strength": strength, "native_valid": False,
                           "reason": str(exc)[:512]})
        else:
            tested.append({"strength": strength, "native_valid": bool(valid)})
        if valid:
            choice = (strength, generated, candidate_project, candidate_recipe)
            break
    if choice is None:
        raise ValueError("No CAD-valid fresh seed; do not start a fictitious lineage")
    strength, guided_recipe, new_project, new_recipe = choice
    out.mkdir(parents=True, exist_ok=True)
    input_dir = out / "inputs"
    input_dir.mkdir()
    # These exact bytes travel with the experiment artifact; the run retains
    # the original repo source files rather than replacing them.
    (input_dir / "project.json").write_bytes(new_project.read_bytes())
    (input_dir / "recipe.json").write_bytes(new_recipe.read_bytes())
    manifest = {
        "schema": "projection-loom/four-attractor-new-lineage",
        "name": "necrospire-four-attractor-experiment-zero",
        "seed": SEED, "pilot_ancestor": None,
        "historical_pilot": "read-only-excluded-from-ancestry-and-scores",
        "source_identity": {k: {"path": str(f.relative_to(HERE.parent.parent)),
                                "sha256": file_hash(f)}
                            for k, f in REPO_EVIDENCE.items()},
        "independent_oblique_alpha_match": True,
        "attractors": {
            "rgba_oblique": "original pixel-level appearance witness; not surveyed",
            "oblique_alpha": "original independently archived fixed-view fitness",
            "ziggurat": "interpretive terracing geometry prior; not an imported ruin",
            "brutalist": "locally authored cantilever/modular construction prior"},
        "proxy_unitless_ratios": analogies,
        "seed_locus_targets": guide,
        "seed_locus_strength": strength,
        "seed_native_trials": tested,
        "project_file": str(new_project),
        "recipe_file": str(new_recipe),
        "recipe_sha256": guided_recipe.sha256,
        "initial_genome_sha256": _hash(guided_recipe.initial),
        "experiment": {"passes": 3, "offspring_per_family": 3,
                       "exact_budget": 12, "detail_budget": 6,
                       "score_size": [64, 96], "overscan": 2,
                       "mutation_scale": .16, "seed": SEED},
        "interpretation": "Fresh source-bound ancestry. Proxy ratios guide seed only; mandatory native CAD/void/mesh/socket gates remain independent."
    }
    manifest["sha256"] = _hash(manifest)
    _atomic(input_dir / "manifest.json", manifest)
    return manifest


def evaluate_review(out):
    out = Path(out)
    manifest = json.loads((out / "inputs" / "manifest.json").read_text())
    if manifest["sha256"] != _hash({k:v for k,v in manifest.items() if k != "sha256"}):
        raise ValueError("Source manifest altered")
    review = json.loads((out / "experiment_zero_review" / "review.json").read_text())
    if review.get("sha256") != _hash({k:v for k,v in review.items() if k != "sha256"}):
        raise ValueError("Review digest changed")
    journal = json.loads((out / "session.json").read_text())
    if journal.get("status") != "completed":
        raise ValueError("Four-attractor OODA-HA campaign not completed")
    archive = json.loads((out / "lineage_archive.json").read_text())
    if len(archive["generations"]) != 3:
        raise ValueError("New lineage did not complete its three planned generations")
    original_rgba = np.asarray(Image.open(REPO_EVIDENCE["rgba"]).convert("RGBA"))
    alpha = np.asarray(Image.open(REPO_EVIDENCE["alpha"]).convert("L"))
    guidance = manifest["seed_locus_targets"]
    recipe = CapabilityRecipe.load(manifest["recipe_file"])
    scored = []
    for member in review["candidates"]:
        genome = member["genome"]
        ur_terms = ("terrace_overhang", "spire_segmentation")
        brutal_terms = ("gallery_reach", "terrace_offset")
        def distance(loci):
            return float(np.mean([abs(genome[k] - guidance[k]) /
                         (recipe.bounds[k][1] - recipe.bounds[k][0]) for k in loci]))
        ur_penalty = distance(ur_terms)
        brutal_penalty = distance(brutal_terms)
        oblique = Image.open(out / member["views"]["oblique"]["image"]).convert("L")
        w, h = oblique.size
        src_rgba = cv2.resize(original_rgba, (w,h), interpolation=cv2.INTER_AREA)
        src_mask = cv2.resize(alpha,(w,h),interpolation=cv2.INTER_AREA) > 96
        rgba_gray = cv2.cvtColor(src_rgba[:,:,:3],cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(rgba_gray, 45, 105) > 0
        edges &= src_mask
        # Boundary alignment measures a weak artistic hint, not color truth;
        # no claim that a monochrome silhouette reconstructs material shading.
        model = np.asarray(oblique)
        model_edges = cv2.Canny(model, 45, 105) > 0
        allowance = cv2.dilate(edges.astype(np.uint8), np.ones((5,5),np.uint8)) > 0
        rgba_boundary_match = float((model_edges & allowance).sum() /
                                    max(1,model_edges.sum()))
        alpha_iou = 1. - float(member["losses"]["silhouette"])
        guided_loss = float(member["combined_loss"] +
                            .016 * ur_penalty + .016 * brutal_penalty +
                            .004 * (1. - rgba_boundary_match))
        scored.append({
            "lineage_id": member["id"],
            "emitter": member["emitter"],
            "family": member["family"],
            "parent": member["parent"],
            "native_witness_id": member["native_witness_id"],
            "oblique_alpha_iou": alpha_iou,
            "original_combined_loss": member["combined_loss"],
            "rgba_boundary_match_unregistered": rgba_boundary_match,
            "ziggurat_unitless_prior_deviation": ur_penalty,
            "brutalist_unitless_prior_deviation": brutal_penalty,
            "four_attractor_advisory_loss": guided_loss,
            "extra_frame_fraction": member["observation"]["extra_fraction"],
            "views": member["views"]
        })
    scored.sort(key=lambda r:(r["four_attractor_advisory_loss"],r["lineage_id"]))
    report = {
        "schema": "projection-loom/four-attractor-review",
        "fresh_lineage_manifest_sha256": manifest["sha256"],
        "native_review_sha256": review["sha256"],
        "generations": 3,
        "births_planned": 54,
        "scored_review": len(scored),
        "ranked_advisory_survivors": scored,
        "recommendation": scored[0]["lineage_id"] if scored else None,
        "recommendation_authority": "adviser-only; no operator selection/pet-name/promotion",
        "attractor_authority": "alpha/source and RGBA are painting evidence; Ur and brutalism are synthetic or interpretive construction priors",
        "governance": "no old pilot results or ancestry; full native evidence remains in this new journal",
        "review_views": ["oblique","front","back","l-side","r-side","top"]
    }
    report["sha256"] = _hash(report)
    _atomic(out / "four_attractor_review.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "review"])
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.out) if args.action == "prepare" else evaluate_review(args.out)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
