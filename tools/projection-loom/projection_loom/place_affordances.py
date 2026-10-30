"""Native walking-*proposal* evidence over named multi-body construction.

A connected route proves only geometric deck contact and bounded empty
clearance under an authored agent envelope. It does not certify human
accessibility, safe walking, loads, slopes, codes, survey truth or aesthetics.
"""
from __future__ import annotations
from math import isfinite
from pathlib import Path
import json
import cadquery as cq
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from .native_support import native_support, _bounds
from .scene_usd import validate_scene
from .place_genome import PlaceGenome
from .spatial_intent import SpatialIntent
from .provenance_encoding import canonical_json_sha256


def _solid(path):
    value=cq.importers.importStep(str(path)).val()
    if not value.isValid() or len(value.Solids())!=1:
        raise ValueError("Route requires independently reimported valid STEP solid")
    return value


def assess_place(bundle,genome:PlaceGenome,spatial:SpatialIntent,*,headroom=1.8):
    """Evaluate original declared goals against STEP; never infer hidden routes."""
    if (not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent)
            or type(headroom) not in (int,float) or not isfinite(headroom)
            or not 1<=headroom<=4):
        raise ValueError("Typed spatial intent and bounded agent clearance required")
    bundle=Path(bundle)
    validate_scene(bundle)
    manifest=json.loads((bundle/"manifest.json").read_text(encoding="utf8"))
    if canonical_json_sha256(genome.declaration(manifest["location"]))!=manifest["declaration_sha256"]:
        raise ValueError("Audition scene does not match the inherited location genome")
    rows={x["entity_id"]:x for x in manifest["bodies"]}
    solids={k:_solid(bundle/v["step_path"]) for k,v in rows.items()}
    bounds={k:_bounds(v) for k,v in solids.items()}
    outcomes=[]
    for goal in spatial.goals:
        entry={"goal":goal.to_dict(),"status":"unverified","proof":None}
        if goal.kind != "connect":
            entry["reason"]="No native affordance witness implements this goal kind"
            outcomes.append(entry)
            continue
        routes=[w for w in genome.walkways if w.source==goal.subject
                and w.destination==goal.object]
        if len(routes)!=1:
            entry["reason"]="No uniquely declared supported walkway for these endpoints"
            outcomes.append(entry)
            continue
        route=routes[0]
        a,b,d=(bounds[x] for x in (route.source,route.destination,route.deck))
        centers=tuple(((v[0]+v[3])/2,(v[1]+v[4])/2) for v in (a,b))
        differences=(centers[1][0]-centers[0][0],centers[1][1]-centers[0][1])
        axis=0 if abs(differences[0])>=abs(differences[1]) else 1
        other=1-axis
        low_main=min(centers[0][axis],centers[1][axis])
        high_main=max(centers[0][axis],centers[1][axis])
        if (abs(differences[other])>1e-7 or high_main-low_main<=1
                or d[axis]>low_main or d[axis+3]<high_main):
            entry["reason"]="Deck fails to span an axis-aligned, independently authored corridor"
            outcomes.append(entry)
            continue
        shared_y=(max(a[other],b[other],d[other]),
                  min(a[other+3],b[other+3],d[other+3]))
        width=shared_y[1]-shared_y[0]
        rise=max(abs(d[5]-a[5]),abs(d[5]-b[5]))
        if width<goal.min_width or rise>goal.max_step:
            entry["reason"]="Width or step envelope outside explicitly authored bounds"
            outcomes.append(entry)
            continue
        try:
            left=native_support(bundle,route.source,route.deck)
            right=native_support(bundle,route.destination,route.deck)
        except ValueError as exc:
            entry["reason"]="Independent native deck bearings refused: "+str(exc)
            outcomes.append(entry)
            continue
        mid=[0.,0.,d[5]+headroom/2+0.002]
        mid[axis]=(low_main+high_main)/2
        mid[other]=(shared_y[0]+shared_y[1])/2
        shape=[goal.min_width,goal.min_width,headroom]
        shape[axis]=high_main-low_main
        # Native STEP faces and Boolean solids determine clearance; this
        # limited witness makes no claim for diagonal or sloped traversal.
        corridor=cq.Workplane("XY").box(*shape).translate(tuple(mid)).val()
        blocked=[]
        for key,body in solids.items():
            if key==route.deck:
                continue
            common=BRepAlgoAPI_Common(body.wrapped,corridor.wrapped)
            common.Build()
            if not common.IsDone():
                raise ValueError("Exact native corridor-clearance intersection failed")
            solid=cq.Shape.cast(common.Shape())
            overlap=float(solid.Volume())
            if not isfinite(overlap):
                raise ValueError("Nonfinite native corridor volume")
            if overlap>1e-6:
                blocked.append({"entity_id":key,"native_overlap_volume":overlap})
        if blocked:
            entry["reason"]="Native solid obstructs declared agent headroom"
            entry["obstructions"]=blocked
            outcomes.append(entry)
            continue
        proof={"schema":"projection-loom/natively-bounded-route-proposal",
               "scene_sha256":manifest["sha256"],"genome_sha256":genome.identity,
               "source":route.source,"destination":route.destination,"deck":route.deck,
               "bearing_sha256":[left["sha256"],right["sha256"]],
               "route_width_lower_bound":float(width),
               "deck_to_endpoint_step_upper_bound":float(rise),
               "agent_headroom":float(headroom),
               "principal_axis":("x" if axis==0 else "y"),
               "native_clearance_obstructions":0,
               "scope":"native-BRep-contact-and-axis-aligned-agent-corridor-only",
               "load_certification":False,"accessibility_certification":False}
        entry.update(status="geometric-route-proposal",proof={
            **proof,"sha256":canonical_json_sha256(proof)})
        outcomes.append(entry)
    return {"schema":"projection-loom/place-affordance-audit",
            "location":manifest["location"],"native_scene_sha256":manifest["sha256"],
            "spatial_intent_sha256":spatial.identity,
            "all_declared_goals_witnessed":all(
                r["status"]=="geometric-route-proposal" for r in outcomes),
            "goals":outcomes,"automatic_promotion":False}

def verify_place_affordances(bundle,genome,spatial,record):
    """Independent re-import, re-computation and comparison before handback."""
    expected=assess_place(bundle,genome,spatial)
    if record!=expected:
        raise ValueError("Recorded architectural affordances differ from native evidence")
    return True
