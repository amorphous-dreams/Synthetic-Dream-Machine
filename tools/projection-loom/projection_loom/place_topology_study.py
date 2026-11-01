"""Matched topology experiment: two-hop and three-hop real STEP circulation.

One original site and one complete spatial intent. The fixed alternatives
receive equal native audition budgets and honest, individually replayed
positive or negative witnesses. No alternative wins by generator order.
"""
from __future__ import annotations
import json
from pathlib import Path
from .place_composed_route import compose_operator_route
from .place_compound_routes import _arm_receipt
from .place_three_hop import propose_three_hop_route
from .place_genome import PlaceGenome
from .scene_usd import package_scene
from .place_affordances import assess_place,verify_place_affordances
from .provenance_encoding import canonical_json_sha256
from .receipt_store import save_once

ALTERNATIVES=("x-then-y","y-then-x","x-y-x","y-x-y")


def _pre(original,spatial,*,location,goal_index,corner_prefix):
    if (not isinstance(original,PlaceGenome) or
            not isinstance(location,str) or not location or
            type(goal_index) is not int or not 0<=goal_index<len(spatial.goals)
            or spatial.goals[goal_index].kind!="connect"):
        raise ValueError("Native topology study needs a selected original connect goal")
    body={"schema":"projection-loom/matched-native-topology-study",
          "original_genome_sha256":original.identity,
          "spatial_intent_sha256":spatial.identity,
          "location":location,"goal_index":goal_index,
          "operator_named_corners":corner_prefix,
          "alternative_patterns":list(ALTERNATIVES),
          "native_budget_per_alternative":1,
          "automatic_operator_selection":False,
          "physical_safety_certification":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def _propose(original,spatial,pre,pattern):
    args={"goal_index":pre["goal_index"]}
    if pattern in ALTERNATIVES[:2]:
        return compose_operator_route(original,spatial,**args,
                     turn=pattern,corner_id=pre["operator_named_corners"])
    if pattern in ALTERNATIVES[2:]:
        return propose_three_hop_route(original,spatial,**args,
                     pattern=pattern,corner_prefix=pre["operator_named_corners"])
    raise ValueError("Operator must select a supported explicit topology")


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _refusal(spatial,pattern,reason):
    # Source-bounded construction refusal never masquerades as an executed
    # native STEP audition or silently disappears from the comparison.
    return {"turn":pattern,"proposal_sha256":None,
            "result_genome_sha256":None,"state":"construction-refused",
            "construction_refusal":reason,
            "native_evidence":None,
            "goal_statuses":[{"goal":g.to_dict(),"status":"unverified"}
                             for g in spatial.goals],
            "witnessed_route":None,"automatic_artistic_winner":False}


def _arm(root,original,spatial,pre,pattern):
    try:
        proposal=_propose(original,spatial,pre,pattern)
    except ValueError as exc:
        row=_refusal(spatial,pattern,str(exc))
    else:
        genome=PlaceGenome.from_dict(proposal["proposed_genome"])
        witness=assess_place(root/pattern/"scene",genome,spatial)
        verify_place_affordances(root/pattern/"scene",genome,spatial,witness)
        row=_arm_receipt(proposal,genome,spatial,pre["goal_index"],witness,pattern)
    if _read(root/pattern/"receipt.json")!=row:
        raise ValueError("Native topology alternative changed original goal or STEP evidence")
    return row


def _summary(pre,arms):
    layouts=[]
    for arm in arms:
        observed=arm["witnessed_route"]
        layouts.append(None if observed is None else
                       {"ordered_route_axes":observed["ordered_route_axes"],
                        "hops":observed["hops"],
                        "body_placements":observed["body_placements"],
                        "segment_width_lower_bounds":observed["segment_width_lower_bounds"]})
    witnessed=[x for x in layouts if x is not None]
    distinct=len({canonical_json_sha256(x) for x in witnessed})
    goals=[]
    for i in range(len(arms[0]["goal_statuses"])):
        values=[arm["goal_statuses"][i] for arm in arms]
        first=values[0]["goal"]
        if any(row["goal"]!=first for row in values):
            raise ValueError("Topology study lost complete source goal attribution")
        goals.append({"goal_index":i,"goal_sha256":canonical_json_sha256(first),
                      "status_by_alternative":{arm["turn"]:arm["goal_statuses"][i]["status"]
                                                for arm in arms},
                      "automatic_operator_selection":False})
    refused=[{"pattern":row["turn"],"reason":row["construction_refusal"]}
             for row in arms if row["state"]=="construction-refused"]
    body={"schema":"projection-loom/topology-native-comparison",
          "preregistration_sha256":pre["sha256"],
          "arms":arms,"goal_consequences":goals,
          "topology_alternatives_offered":len(arms),
          "construction_refusals":refused,
          "native_attempts":len(arms)-len(refused),
          "witnessed_route_count":len(witnessed),
          "observed_distinct_route_layouts":distinct,
          "observed_hops":[None if x is None else x["hops"] for x in layouts],
          "all_alternatives_witness_every_goal":all(
                   x["state"]=="native-all-goals-witnessed" for x in arms),
          "source_conditioned_morphology_proven":False,
          "automatic_artistic_winner":False,
          "structural_safety_certification":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_topology_study(original,spatial,out,*,location,goal_index,corner_prefix):
    root=Path(out)
    pre=_pre(original,spatial,location=location,
             goal_index=goal_index,corner_prefix=corner_prefix)
    if (root/"FAILED").exists() or _read(root/"preregistration.json")!=pre:
        raise ValueError("Topology preregistration lost original source or operator choices")
    rows=[_arm(root,original,spatial,pre,pattern) for pattern in ALTERNATIVES]
    actual=_summary(pre,rows)
    if _read(root/"summary.json")!=actual:
        raise ValueError("Topology native comparison diverged from original STEP witnesses")
    return actual


def run_topology_study(original,spatial,out,*,location,goal_index,corner_prefix):
    root=Path(out)
    if root.exists():
        raise ValueError("Matched topology study requires a new immutable root")
    pre=_pre(original,spatial,location=location,
             goal_index=goal_index,corner_prefix=corner_prefix)
    root.mkdir(parents=True)
    save_once(root/"preregistration.json",pre)
    try:
        for pattern in ALTERNATIVES:
            try:
                proposed=_propose(original,spatial,pre,pattern)
            except ValueError as exc:
                save_once(root/pattern/"receipt.json",_refusal(spatial,pattern,str(exc)))
                continue
            child=PlaceGenome.from_dict(proposed["proposed_genome"])
            package_scene(child.declaration(location),root/pattern/"scene")
            native=assess_place(root/pattern/"scene",child,spatial)
            save_once(root/pattern/"receipt.json",_arm_receipt(
                    proposed,child,spatial,goal_index,native,pattern))
        arms=[_arm(root,original,spatial,pre,p) for p in ALTERNATIVES]
        save_once(root/"summary.json",_summary(pre,arms))
        return verify_topology_study(original,spatial,root,location=location,
                                     goal_index=goal_index,corner_prefix=corner_prefix)
    except Exception:
        (root/"FAILED").write_text("Native topology study incomplete; no success\n")
        raise
