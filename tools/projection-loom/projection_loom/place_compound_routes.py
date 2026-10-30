"""Matched native alternatives for an operator-selected compound spatial crossing.

Every complete authored goal enters the same independently reimported STEP
audition. Comparing two bends never elects a winner or implies certified
structural safety; an unsuccessful arm retains its negative testimony.
"""
from __future__ import annotations
import json
from pathlib import Path
from .place_composed_route import compose_operator_route
from .place_genome import PlaceGenome
from .spatial_intent import SpatialIntent
from .scene_usd import package_scene
from .place_affordances import assess_place,verify_place_affordances
from .provenance_encoding import canonical_json_sha256
from .generalized_campaign import save_once

TURNS=("x-then-y","y-then-x")


def _pre(genome,spatial,location,goal_index,corner_id):
    if (not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent)
            or type(goal_index) is not int or not 0<=goal_index<len(spatial.goals)
            or spatial.goals[goal_index].kind!="connect"
            or not isinstance(location,str) or not location):
        raise ValueError("Matched compound route requires a selected authored connect goal")
    return {"schema":"projection-loom/matched-compound-route-native",
            "original_genome_sha256":genome.identity,
            "spatial_intent_sha256":spatial.identity,
            "original_genome":genome.to_dict(),
            "spatial_intent":spatial.to_dict(),
            "selected_connect_goal_index":goal_index,
            "operator_named_corner":corner_id,"location":location,
            "turns":list(TURNS),"native_budget_per_arm":1,
            "automatic_operator_selection":False}


def _observation(genome,spatial,selected,native):
    goal=spatial.goals[selected].to_dict()
    matches=[g for g in native["goals"] if g["goal"]==goal]
    if len(matches)!=1:
        raise ValueError("Native selected route testimony absent or ambiguous")
    chosen=matches[0]
    if chosen["status"]!="geometric-route-proposal":
        return None
    proof=chosen["proof"]
    segments=proof.get("segments",[proof])
    return {"ordered_route_axes":[s["principal_axis"] for s in segments],
            "segment_width_lower_bounds":[s["route_width_lower_bound"] for s in segments],
            "hops":len(segments),
            "native_scene_sha256":native["native_scene_sha256"],
            "body_placements":[{"entity_id":b.entity_id,
                                "translation":list(b.translation)}
                               for b in genome.bodies]}


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _arm(root,genome,spatial,pre,turn):
    receipt=_read(root/turn/"receipt.json")
    proposed=compose_operator_route(genome,spatial,goal_index=pre[
        "selected_connect_goal_index"],turn=turn,corner_id=pre["operator_named_corner"])
    child=PlaceGenome.from_dict(proposed["proposed_genome"])
    native=assess_place(root/turn/"scene",child,spatial)
    verify_place_affordances(root/turn/"scene",child,spatial,native)
    body={"turn":turn,"proposal_sha256":proposed["sha256"],
          "result_genome_sha256":child.identity,
          "state":("native-all-goals-witnessed" if native[
              "all_declared_goals_witnessed"] else "spatial-unverified"),
          "native_evidence":native,
          "goal_statuses":[{"goal":g["goal"],"status":g["status"]}
                            for g in native["goals"]],
          "witnessed_route":_observation(child,spatial,pre[
              "selected_connect_goal_index"],native),
          "automatic_artistic_winner":False}
    if receipt!=body:
        raise ValueError("Compound route arm differs from original operator and native STEP evidence")
    return body


def _summary(pre,arms):
    observed=[row["witnessed_route"] for row in arms]
    descriptors=[None if x is None else {k:v for k,v in x.items()
                 if k!="native_scene_sha256"} for x in observed]
    distinct=(all(x is not None for x in descriptors)
              and len({canonical_json_sha256(x) for x in descriptors})==len(descriptors))
    body={"schema":"projection-loom/matched-compound-route-result",
          "preregistration_sha256":canonical_json_sha256(pre),
          "arms":arms,"native_attempts":len(arms),
          "distinct_witnessed_route_layouts":distinct,
          "all_goals_witnessed_in_both_arms":all(
              row["state"]=="native-all-goals-witnessed" for row in arms),
          "automatic_artistic_winner":False,"physical_safety_certification":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_compound_route_study(genome,spatial,root,*,location,goal_index,corner_id):
    root=Path(root)
    pre=_pre(genome,spatial,location,goal_index,corner_id)
    if (root/"FAILED").exists() or _read(root/"preregistration.json")!=pre:
        raise ValueError("Matched compound route changed its original source, goal or operator choice")
    arms=[_arm(root,genome,spatial,pre,turn) for turn in TURNS]
    expected=_summary(pre,arms)
    if _read(root/"summary.json")!=expected:
        raise ValueError("Matched compound native alternatives or refusal census changed")
    return expected


def run_compound_route_study(genome,spatial,out,*,location,goal_index,corner_id):
    root=Path(out)
    if root.exists():
        raise ValueError("Matched compound alternatives need an unused immutable root")
    pre=_pre(genome,spatial,location,goal_index,corner_id)
    root.mkdir(parents=True)
    save_once(root/"preregistration.json",pre)
    try:
        for turn in TURNS:
            proposed=compose_operator_route(genome,spatial,goal_index=goal_index,
                                             turn=turn,corner_id=corner_id)
            child=PlaceGenome.from_dict(proposed["proposed_genome"])
            package_scene(child.declaration(location),root/turn/"scene")
            evidence=assess_place(root/turn/"scene",child,spatial)
            body={"turn":turn,"proposal_sha256":proposed["sha256"],
                  "result_genome_sha256":child.identity,
                  "state":("native-all-goals-witnessed" if evidence[
                      "all_declared_goals_witnessed"] else "spatial-unverified"),
                  "native_evidence":evidence,
                  "goal_statuses":[{"goal":g["goal"],"status":g["status"]}
                                   for g in evidence["goals"]],
                  "witnessed_route":_observation(child,spatial,goal_index,evidence),
                  "automatic_artistic_winner":False}
            save_once(root/turn/"receipt.json",body)
        arms=[_arm(root,genome,spatial,pre,turn) for turn in TURNS]
        save_once(root/"summary.json",_summary(pre,arms))
        return verify_compound_route_study(genome,spatial,root,location=location,
                                           goal_index=goal_index,corner_id=corner_id)
    except Exception:
        (root/"FAILED").write_text("Unfinished native alternatives cannot certify a place\n")
        raise
