"""Typed spatial obligations under the existing place constructor and helm.

YIN: compose authored constraints before making more native bodies.
This produces an ordered *proposal*, not geometric validity or permission
to choose among equally authorized design alternatives.
"""
from __future__ import annotations
from .spatial_intent import SpatialIntent
from .place_genome import PlaceGenome
from .provenance_encoding import canonical_json_sha256


def plan_spatial_obligations(genome: PlaceGenome, spatial: SpatialIntent):
    if not isinstance(genome, PlaceGenome) or not isinstance(spatial, SpatialIntent):
        raise ValueError("Obligation planning requires typed original bodies and goals")
    original={body.entity_id for body in genome.bodies}
    producers={}
    for index,goal in enumerate(spatial.goals):
        if goal.kind=="shelter" and goal.object not in original:
            if goal.object in producers:
                raise ValueError("Competing shelter goals claim the same native body")
            producers[goal.object]=index
    # Dependency edges refer only to original authored spatial-goal indices.
    requirements={}
    for index,goal in enumerate(spatial.goals):
        depends=set()
        for endpoint in (goal.subject,goal.object):
            if endpoint in producers:
                producer=producers[endpoint]
                if producer==index:
                    if goal.subject==endpoint:
                        raise ValueError("Shelter cannot produce its own source")
                else:
                    depends.add(producer)
        requirements[index]=depends
    # Ascents may influence canopy placement; bearings consume shelter roofs.
    # Preserve original goal indices so the constructor's generated handles
    # stay source-attributable even when execution order changes.
    def priority(index):
        goal=spatial.goals[index]
        if goal.kind=="ascend":
            return 0
        if goal.kind=="connect":
            known={b.entity_id:b for b in genome.bodies}
            if goal.subject in known and goal.object in known:
                left,right=known[goal.subject],known[goal.object]
                dx=abs(left.translation[0]-right.translation[0])
                dy=abs(left.translation[1]-right.translation[1])
                return 2 if dx>1e-7 and dy>1e-7 else 0
            return 2
        if goal.kind=="shelter":
            return 1
        return 3  # Bearing interpretation follows authored shelter birth.
    remaining=set(requirements)
    ordered=[]
    while remaining:
        ready=[i for i in remaining if requirements[i]<=set(ordered)]
        if not ready:
            raise ValueError("Spatial construction obligations contain a dependency cycle")
        index=min(ready,key=lambda i:(priority(i),i))
        ordered.append(index)
        remaining.remove(index)
    rows=[{"goal_index":i,"kind":spatial.goals[i].kind,
           "goal_sha256":canonical_json_sha256(spatial.goals[i].to_dict()),
           "requires_goal_indices":sorted(requirements[i]),
           "produces_native_handle":(
               spatial.goals[i].object if i in producers.values() else None)}
          for i in ordered]
    # Local Jing: restriction of the composed obligations back to individual
    # authored goals must recover exactly their original identities.
    projected={row["goal_index"]:row["goal_sha256"] for row in rows}
    original_sha={i:canonical_json_sha256(g.to_dict())
                  for i,g in enumerate(spatial.goals)}
    if projected!=original_sha or len(rows)!=len(spatial.goals):
        raise ValueError("Composed spatial obligations lost original authored intent")
    body={"schema":"projection-loom/spatial-obligation-plan",
          "original_genome_sha256":genome.identity,
          "spatial_intent_sha256":spatial.identity,
          "ordered_goals":rows,
          "composition_restriction_coheres":True,
          "native_audition_completed":False,
          "automatic_operator_selection":False,
          "physical_safety_certification":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_spatial_obligations(genome,spatial,receipt):
    expected=plan_spatial_obligations(genome,spatial)
    if receipt!=expected:
        raise ValueError("Spatial obligation plan diverged from authored source or dependency graph")
    return True
