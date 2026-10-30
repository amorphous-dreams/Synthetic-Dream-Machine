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
        ac=(a[0]+a[3])/2
        bc=(b[0]+b[3])/2
        if ac>=bc or d[0]>ac or d[3]<bc:
            entry["reason"]="Deck fails to span named endpoints along the supported eastward corridor"
            outcomes.append(entry)
            continue
        shared_y=max(a[1],b[1],d[1]),min(a[4],b[4],d[4])
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
        cy=(shared_y[0]+shared_y[1])/2
        cx=(ac+bc)/2
        length=bc-ac
        # Keep finite headroom strictly above the deck top. STEP solids,
        # not preview meshes, decide intersecting obstructing material.
        corridor=cq.Workplane("XY").box(length,goal.min_width,headroom).translate(
            (cx,cy,d[5]+headroom/2+0.002)).val()
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
