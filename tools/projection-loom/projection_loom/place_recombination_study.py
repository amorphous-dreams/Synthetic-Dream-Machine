"""Exact STEP witness for a fully specified cross-parent region birth.

The operator selects regional inheritance, not an architectural winner. The
new child always receives its own native audition; parental evidence never
crosses this source/geometry boundary by implication.
"""
from __future__ import annotations
import json
from pathlib import Path
from .place_genome import PlaceGenome
from .place_recombination import recombine_place_regions
from .place_affordances import assess_place,verify_place_affordances
from .scene_usd import package_scene
from .receipt_store import save_once
from .study_reentry import replay_completed_or_require_fresh
from .provenance_encoding import canonical_json_sha256


def _pre(original,left,right,spatial,location,left_generated,right_generated):
    if not isinstance(location,str) or not location:
        raise ValueError("Native recombinant requires its original named place")
    proposal=recombine_place_regions(original,left,right,spatial,
                    left_generated=left_generated,right_generated=right_generated)
    body={"schema":"projection-loom/native-recombination-preregistration",
          "location":location,"original_genome_sha256":original.identity,
          "left_parent_sha256":left.identity,"right_parent_sha256":right.identity,
          "spatial_intent_sha256":spatial.identity,
          "operator_selected_left_generated":sorted(left_generated),
          "operator_selected_right_generated":sorted(right_generated),
          "proposed_genome_sha256":proposal["child_genome_sha256"],
          "proposal_sha256":proposal["sha256"],
          "independent_native_auditions":1,
          "parental_native_success_inherited":False,
          "automatic_operator_choice":False}
    return proposal,{**body,"sha256":canonical_json_sha256(body)}


def _native_row(root,child,spatial,proposal,pre):
    audit=assess_place(root/"scene",child,spatial)
    verify_place_affordances(root/"scene",child,spatial,audit)
    body={"schema":"projection-loom/native-recombinant-result",
          "preregistration_sha256":pre["sha256"],
          "proposal_sha256":proposal["sha256"],
          "result_genome_sha256":child.identity,
          "native_evidence":audit,
          "goal_statuses":[{"goal":item["goal"],"status":item["status"]}
                            for item in audit["goals"]],
          "status":("native-all-goals-witnessed" if audit[
              "all_declared_goals_witnessed"] else "spatial-unverified"),
          "parental_native_success_inherited":False,
          "physical_safety_certification":False,
          "automatic_artistic_winner":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_recombined_native(root,original,left,right,spatial,*,
                              location,left_generated,right_generated):
    root=Path(root)
    proposal,pre=_pre(original,left,right,spatial,location,
                      left_generated,right_generated)
    if (root/"FAILED").exists() or json.loads(
            (root/"preregistration.json").read_text(encoding="utf8"))!=pre:
        raise ValueError("Native recombinant preregistration changed its original parent sources or choice")
    child=PlaceGenome.from_dict(proposal["child_genome"])
    if json.loads((root/"child_genome.json").read_text(encoding="utf8"))!=child.to_dict():
        raise ValueError("Native recombinant child genotype no longer matches its parent sources")
    expected=_native_row(root,child,spatial,proposal,pre)
    if json.loads((root/"receipt.json").read_text(encoding="utf8"))!=expected:
        raise ValueError("Recombinant child native STEP or spatial proof changed")
    return expected


def run_recombined_native(original,left,right,spatial,out,*,
                          location,left_generated,right_generated):
    root=Path(out)
    resumed=replay_completed_or_require_fresh(
        root,completion="receipt.json",
        verify=lambda: verify_recombined_native(
            root,original,left,right,spatial,location=location,
            left_generated=left_generated,right_generated=right_generated),
        occupied_reason="Native recombinant requires a fresh immutable study root")
    if resumed is not None:
        return resumed
    proposal,pre=_pre(original,left,right,spatial,location,
                      left_generated,right_generated)
    child=PlaceGenome.from_dict(proposal["child_genome"])
    root.mkdir(parents=True)
    save_once(root/"preregistration.json",pre)
    save_once(root/"child_genome.json",child.to_dict())
    try:
        package_scene(child.declaration(location),root/"scene")
        result=_native_row(root,child,spatial,proposal,pre)
        save_once(root/"receipt.json",result)
        return verify_recombined_native(root,original,left,right,spatial,
                    location=location,left_generated=left_generated,
                    right_generated=right_generated)
    except Exception:
        (root/"FAILED").write_text("Native recombinant unfinished; no inherited acceptance\n")
        raise
