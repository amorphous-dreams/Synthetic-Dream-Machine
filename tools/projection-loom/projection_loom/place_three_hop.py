"""Construct genuinely different three-hop circulation from the same authored supports.

The middle lane stays explicit (two named waypoints). The operator chooses
one of two orthogonal axis patterns, but neither a generation heuristic nor
a rendered view gets to choose the architectural winner. Every deck remains
an independently tested native STEP body.
"""
from __future__ import annotations
from .developmental import GrowthNode,GrowthProgram
from .place_genome import PlaceBody,PlaceGenome,unique_walkway_chain,propose_from_spatial_intent
from .place_obligations import plan_spatial_obligations
from .place_source_seal import seal_constructive_growth
from .spatial_intent import SpatialIntent,SpatialGoal
from .provenance_encoding import canonical_json_sha256

PATTERNS=("x-y-x","y-x-y")


def propose_three_hop_route(genome:PlaceGenome,spatial:SpatialIntent,*,
                            goal_index:int,pattern:str,corner_prefix:str):
    if (not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent)
            or type(goal_index) is not int or not 0<=goal_index<len(spatial.goals)
            or pattern not in PATTERNS or not isinstance(corner_prefix,str)
            or not corner_prefix.isidentifier() or len(corner_prefix)>60):
        raise ValueError("Three-hop topology requires an explicitly selected source goal, pattern and corner name")
    goal=spatial.goals[goal_index]
    if goal.kind!="connect":
        raise ValueError("Three-hop topology can only construct an authored connect relationship")
    plan=plan_spatial_obligations(genome,spatial)
    originals={body.entity_id:body for body in genome.bodies}
    if goal.subject not in originals or goal.object not in originals:
        raise ValueError("Three-hop route requires two independently authored source supports")
    if unique_walkway_chain(genome,goal.subject,goal.object):
        raise ValueError("Three-hop proposal cannot overwrite a preexisting operator route")
    source,target=originals[goal.subject],originals[goal.object]
    if (len(source.program.nodes)!=1 or len(target.program.nodes)!=1
            or source.program.nodes[0].op!="foundation"
            or target.program.nodes[0].op!="foundation"):
        raise ValueError("Three-hop construction needs two simple native foundation sites")
    a,b=source.program.nodes[0].size,target.program.nodes[0].size
    x0,y0,z0=source.translation
    x1,y1,z1=target.translation
    width=min(a[0],a[1],b[0],b[1])
    if (abs(x1-x0)<=2*width+1 or abs(y1-y0)<=2*width+1
            or abs((z0+a[2])-(z1+b[2]))>1e-7
            or width<goal.min_width or goal.max_step<.5):
        raise ValueError("Three-hop route lacks diagonal equal-height span, transverse width or step allowance")
    # The chosen lane passes halfway through the unmodified authored sites.
    # Each leg therefore preserves native passage and room for both corners.
    mx=round((x0+x1)/2,6)
    my=round((y0+y1)/2,6)
    sites=((mx,y0),(mx,y1)) if pattern=="x-y-x" else ((x0,my),(x1,my))
    names=(corner_prefix+"_a",corner_prefix+"_b")
    if (len(genome.bodies)+5>16 or any(name in originals for name in names)
            or names[0]==names[1] or any(len(name)>64 for name in names)):
        raise ValueError("Three-hop source body capacity or semantic corner names conflict")
    root=GrowthProgram((GrowthNode("root","foundation",
                                  size=(float(width),float(width),float(a[2]))),))
    corners=[PlaceBody(name,root,(float(x),float(y),float(z0)))
             for name,(x,y) in zip(names,sites)]
    # Prospective generated *foundation* waypoints cannot silently displace
    # any original native body's measured root footprint. This constrained
    # cuboid check rejects obvious original-site conflicts before CAD, but
    # STEP remains authoritative on every subsequent deck clearance.
    for corner in corners:
        cx,cy,cz=corner.translation
        for original in genome.bodies:
            if len(original.program.nodes)!=1 or original.program.nodes[0].op!="foundation":
                raise ValueError("Three-hop avoidance requires measured single-foundation source bodies")
            ox,oy,oz=original.translation
            size=original.program.nodes[0].size
            overlap=(min(cx+width,ox+size[0])-max(cx,ox),
                     min(cy+width,oy+size[1])-max(cy,oy),
                     min(cz+a[2],oz+size[2])-max(cz,oz))
            if all(v>1e-7 for v in overlap):
                raise ValueError("Generated waypoint "+corner.entity_id+
                                 " intrudes into original native source "+original.entity_id)
    augmented=PlaceGenome(tuple(sorted((*genome.bodies,*corners),
                                       key=lambda row:row.entity_id)),
                          genome.walkways,genome.ascents,genome.bearings)
    anchors=(goal.subject,*names,goal.object)
    legs=tuple(sorted((SpatialGoal("connect",anchors[i],anchors[i+1],
                                   goal.min_width,goal.max_step)
                       for i in range(3)),
                      key=lambda row:(row.kind,row.subject,row.object)))
    local=SpatialIntent(spatial.intent_sha256,legs,spatial.authored_by)
    crossing=propose_from_spatial_intent(augmented,local)
    if len(unique_walkway_chain(crossing,goal.subject,goal.object))!=3:
        raise ValueError("Three-hop constructor did not preserve three separately defined walkway segments")
    # The full original intention still governs shelter, ascent and bearing;
    # it may refuse a conflicting generated plan rather than dropping a goal.
    complete=propose_from_spatial_intent(crossing,spatial)
    seal=seal_constructive_growth(genome,complete)
    body={"schema":"projection-loom/three-hop-spatial-proposal",
          "original_genome_sha256":genome.identity,
          "original_spatial_intent_sha256":spatial.identity,
          "original_obligations_sha256":plan["sha256"],
          "selected_connect_goal_index":goal_index,
          "operator_pattern":pattern,"operator_corner_prefix":corner_prefix,
          "intermediate_center_positions":[[float(x),float(y)] for x,y in sites],
          "source_preserving_growth":seal,
          "proposed_genome_sha256":complete.identity,
          "proposed_genome":complete.to_dict(),
          "native_audition_completed":False,"automatic_artistic_winner":False,
          "automatic_operator_selection":False,"physical_safety_certification":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_three_hop_route(genome,spatial,receipt):
    if not isinstance(receipt,dict):
        raise ValueError("Three-hop topology requires a source-bound receipt")
    expected=propose_three_hop_route(genome,spatial,
               goal_index=receipt["selected_connect_goal_index"],
               pattern=receipt["operator_pattern"],
               corner_prefix=receipt["operator_corner_prefix"])
    if receipt!=expected:
        raise ValueError("Three-hop route diverged from its authored source or operator choices")
    return True
