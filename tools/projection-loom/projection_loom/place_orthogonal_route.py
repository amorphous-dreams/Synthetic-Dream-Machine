"""Operator-steered right-angle route between two authored native sites.

Only finite axis-aligned segments acquire independent exact STEP witnesses.
The chosen corner and its direction remain explicit operator testimony.
"""
from __future__ import annotations
from dataclasses import dataclass
from math import isfinite
from .place_genome import PlaceBody,PlaceGenome,unique_walkway_chain,propose_from_spatial_intent
from .developmental import GrowthProgram,GrowthNode
from .spatial_intent import SpatialIntent,SpatialGoal
from .provenance_encoding import canonical_json_sha256

def propose_orthogonal_route(genome,spatial,*,turn,corner_id):
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Right-angle construction needs original typed source and aim")
    if turn not in ("x-then-y","y-then-x"):
        raise ValueError("Operator must choose a named x/y bend direction")
    if len(spatial.goals)!=1 or spatial.goals[0].kind!="connect":
        raise ValueError("Right-angle proposal requires one selected connect goal")
    goal=spatial.goals[0]
    known={b.entity_id:b for b in genome.bodies}
    if (not isinstance(corner_id,str) or not corner_id.isidentifier()
            or len(corner_id)>64 or corner_id in known):
        raise ValueError("Original scene or new semantic corner name conflicts")
    if goal.subject not in known or goal.object not in known:
        raise ValueError("Both diagonal endpoints must have original native bodies")
    if unique_walkway_chain(genome,goal.subject,goal.object):
        raise ValueError("An original authored route already connects these endpoints")
    a,b=known[goal.subject],known[goal.object]
    if (len(a.program.nodes)!=1 or len(b.program.nodes)!=1
            or a.program.nodes[0].op!="foundation"
            or b.program.nodes[0].op!="foundation"):
        raise ValueError("Right-angle route needs simple measured original native foundation sites")
    ax,ay,az=a.translation; bx,by,bz=b.translation
    pa=a.program.nodes[0].size;pb=b.program.nodes[0].size
    if (abs(ax-bx)<=1 or abs(ay-by)<=1 or
            abs((az+pa[2])-(bz+pb[2]))>1e-7):
        raise ValueError("Right-angle route needs distinct diagonal equal-top authored sites")
    width=min(pa[0],pa[1],pb[0],pb[1])
    if width<goal.min_width:
        raise ValueError("Authored sites cannot carry required route width")
    x,y=(bx,ay) if turn=="x-then-y" else (ax,by)
    z=az
    root=GrowthProgram((GrowthNode("root","foundation",
             size=(float(width),float(width),float(pa[2]))),))
    corner=PlaceBody(corner_id,root,(float(x),float(y),float(z)))
    anchored=PlaceGenome(tuple(sorted((*genome.bodies,corner),key=lambda row:row.entity_id)),
                         genome.walkways,genome.ascents,genome.bearings)
    legs=(SpatialGoal("connect",goal.subject,corner_id,
             goal.min_width,goal.max_step),
          SpatialGoal("connect",corner_id,goal.object,
             goal.min_width,goal.max_step))
    leg_intent=SpatialIntent(spatial.intent_sha256,
                            tuple(sorted(legs,key=lambda item:(item.kind,item.subject,item.object))),
                            spatial.authored_by)
    grown=propose_from_spatial_intent(anchored,leg_intent)
    chain=unique_walkway_chain(grown,goal.subject,goal.object)
    if len(chain)!=2 or len(grown.bodies)!=len(genome.bodies)+3:
        raise ValueError("Constructed corner did not preserve the unique two-hop route")
    return grown


def orthogonal_route_receipt(genome,spatial,*,turn,corner_id):
    result=propose_orthogonal_route(genome,spatial,turn=turn,corner_id=corner_id)
    payload={"schema":"projection-loom/operator-orthogonal-route-proposal",
             "original_genome_sha256":genome.identity,
             "spatial_intent_sha256":spatial.identity,
             "operator_bend_direction":turn,
             "operator_named_corner":corner_id,
             "result_genome_sha256":result.identity,
             "result_genome":result.to_dict(),
             "native_audition_completed":False,
             "accessible_route_certification":False,
             "structural_load_certification":False,
             "automatic_operator_selection":False}
    return {**payload,"sha256":canonical_json_sha256(payload)}


def verify_orthogonal_route_receipt(genome,spatial,receipt):
    expected=orthogonal_route_receipt(genome,spatial,
           turn=receipt["operator_bend_direction"],
           corner_id=receipt["operator_named_corner"])
    if receipt!=expected:
        raise ValueError("Right-angle proposal no longer matches original operator choice and genome")
    return True
