"""Native horizontal cover hypothesis, deliberately weaker than safe shelter.

The exact imported STEP floor-top and roof-underside must overlap as planar
BRep faces. The enclosed rectangular headroom probe must remain empty of
third-party solids. Sidewalls, weatherproofing, loads, egress, construction
method and human occupancy retain NO certification here.
"""
from __future__ import annotations
from hashlib import sha256
from math import isfinite
from pathlib import Path
import cadquery as cq
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from .native_support import _bearing_face_area
from .provenance_encoding import canonical_json_sha256


def native_shelter_cover(bundle,manifest,solids,bounds,goal,*,headroom=1.8):
    floor_id,roof_id=goal.subject,goal.object
    if floor_id not in solids or roof_id not in solids:
        return None,"Named floor and roof require two independently imported native bodies"
    floor,roof=solids[floor_id],solids[roof_id]
    a,b=bounds[floor_id],bounds[roof_id]
    lowx,highx=max(a[0],b[0]),min(a[3],b[3])
    lowy,highy=max(a[1],b[1]),min(a[4],b[4])
    gap=b[2]-a[5]
    if (highx-lowx<goal.min_width or highy-lowy<goal.min_width
            or not headroom<=gap<=4.):
        return None,"Insufficient positive roof footprint or bounded clear headroom"
    # The footpoint needs cover, not a distant slab connected by a corner.
    midx=(a[0]+a[3])/2
    midy=(a[1]+a[4])/2
    if not(lowx<=midx<=highx and lowy<=midy<=highy):
        return None,"Floor center lies outside native roof projection"
    try:
        face_area=_bearing_face_area(floor,roof,a,b,gap,.001)
    except ValueError as exc:
        return None,"Native underside/floor planar comparison refused: "+str(exc)
    if face_area<goal.min_width**2:
        return None,"Native planar overhead cover area falls below authored footprint"
    # Exact independent STEP solids (not bounding boxes) determine whether
    # any unrelated body occupies the proposed enclosed headroom.
    # The claim protects only the bounded central refuge core. An
    # independently measured bearing column may occupy the surrounding
    # original roof footprint without silently being called empty.
    core_width=goal.min_width
    if (not lowx<=midx-core_width/2 or not midx+core_width/2<=highx
            or not lowy<=midy-core_width/2 or not midy+core_width/2<=highy):
        return None,"Authored central refuge core lies outside native roof coverage"
    occupied=cq.Workplane("XY").box(
        core_width,core_width,gap-.004).translate(
        (midx,midy,(a[5]+b[2])/2)).val()
    intruders=[]
    for name,shape in solids.items():
        if name in (floor_id,roof_id):
            continue
        overlap=BRepAlgoAPI_Common(shape.wrapped,occupied.wrapped)
        overlap.Build()
        if not overlap.IsDone():
            raise ValueError("Exact shelter occupancy Boolean failed")
        volume=float(cq.Shape.cast(overlap.Shape()).Volume())
        if not isfinite(volume):
            raise ValueError("Native shelter occupancy volume nonfinite")
        if volume>1e-6:
            intruders.append(name)
    if intruders:
        return None,"Third-party native geometry intrudes into sheltered volume"
    rows={r["entity_id"]:r for r in manifest["bodies"]}
    payload={"schema":"projection-loom/natively-bounded-overhead-cover",
             "scene_sha256":manifest["sha256"],"floor":floor_id,
             "roof":roof_id,"floor_step_sha256":sha256(
                 (Path(bundle)/rows[floor_id]["step_path"]).read_bytes()).hexdigest(),
             "roof_step_sha256":sha256(
                 (Path(bundle)/rows[roof_id]["step_path"]).read_bytes()).hexdigest(),
             "native_planar_cover_area":float(face_area),
             "headroom_height":float(gap),"required_headroom":float(headroom),
             "minimum_cover_width":float(min(highx-lowx,highy-lowy)),
             "clear_core_width":float(core_width),
             "clear_core_floor_area":float(core_width**2),
             "intrusions":0,"scope":"horizontal-roof-over-bounded-clear-core-only",
             "weather_certification":False,"occupancy_certification":False,
             "load_certification":False,"automatic_promotion":False}
    return {**payload,"sha256":canonical_json_sha256(payload)},None
