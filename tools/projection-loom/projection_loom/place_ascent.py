"""Native geometric rising tread chain, without accessibility or load certification.

The operator supplies each independent STEP body and the exact ordered path.
Full planar side-face BRep intersections, monotone measured top rises, shared
width and empty finite headroom decide a narrow *geometric* stair hypothesis.
"""
from __future__ import annotations
from hashlib import sha256
from math import isfinite
from pathlib import Path
import cadquery as cq
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from .provenance_encoding import canonical_json_sha256


def _side_area(a,b,axis,sign):
    def direction(face):
        normal=face.normalAt()
        return (normal.x,normal.y)[axis]
    first=[f for f in a.Faces() if f.geomType()=="PLANE"
           and direction(f)*sign>.9999]
    second=[f for f in b.Faces() if f.geomType()=="PLANE"
            and direction(f)*sign<-.9999]
    if len(first)*len(second)>256:
        raise ValueError("Native side face-pair complexity exceeded")
    area=0.
    for f in first:
        for g in second:
            common=BRepAlgoAPI_Common(f.wrapped,g.wrapped)
            common.Build()
            if not common.IsDone():
                raise ValueError("Native side face intersection failed")
            area+=sum(face.Area() for face in cq.Shape.cast(common.Shape()).Faces())
    if not isfinite(area):
        raise ValueError("Native stair side intersection nonfinite")
    return float(area)


def native_ascent_run(bundle,manifest,solids,bounds,run,goal,*,headroom=1.8):
    names=(run.source,*run.steps,run.destination)
    if (run.source!=goal.subject or run.destination!=goal.object
            or any(name not in solids for name in names)):
        return None,"Ascent endpoints and independently imported STEP bodies disagree"
    centers={k:tuple((bounds[k][j]+bounds[k][j+3])/2 for j in (0,1))
             for k in names}
    delta=[centers[names[-1]][j]-centers[names[0]][j] for j in (0,1)]
    axis=0 if abs(delta[0])>=abs(delta[1]) else 1
    other=1-axis
    if abs(delta[other])>1e-7 or abs(delta[axis])<=1:
        return None,"Ascent requires one authored monotone horizontal axis"
    sign=1 if delta[axis]>0 else -1
    rows={r["entity_id"]:r for r in manifest["bodies"]}
    contacts=[]
    for left,right in zip(names,names[1:]):
        a,b=bounds[left],bounds[right]
        if (sign*(centers[right][axis]-centers[left][axis])<=0
                or abs(centers[right][other]-centers[left][other])>1e-7
                or abs((a[axis+3] if sign>0 else a[axis]) -
                       (b[axis] if sign>0 else b[axis+3]))>.001):
            return None,"Native stair treads fail monotone side adjacency"
        rise=b[5]-a[5]
        width=min(a[other+3],b[other+3])-max(a[other],b[other])
        if rise<=.001 or rise>goal.max_step or width<goal.min_width:
            return None,"Native riser height or tread overlap violates authored envelope"
        face_area=_side_area(solids[left],solids[right],axis,sign)
        if face_area<.05:
            return None,"Native tread side faces lack positive exact planar contact"
        contacts.append({"from":left,"to":right,"top_rise":float(rise),
                         "native_side_contact_area":face_area,"shared_width":float(width),
                         "from_step_sha256":sha256((Path(bundle)/rows[left]["step_path"]).read_bytes()).hexdigest(),
                         "to_step_sha256":sha256((Path(bundle)/rows[right]["step_path"]).read_bytes()).hexdigest()})
    for tread in run.steps:
        a=bounds[tread]
        cx=(a[0]+a[3])/2;cy=(a[1]+a[4])/2
        clearance=cq.Workplane("XY").box(
            min(a[3]-a[0],goal.min_width)*.5,
            min(a[4]-a[1],goal.min_width)*.5,
            headroom).translate((cx,cy,a[5]+headroom/2+.002)).val()
        for other_id,shape in solids.items():
            if other_id==tread:
                continue
            intersect=BRepAlgoAPI_Common(shape.wrapped,clearance.wrapped)
            intersect.Build()
            if not intersect.IsDone():
                raise ValueError("Exact native stair headroom intersection failed")
            volume=float(cq.Shape.cast(intersect.Shape()).Volume())
            if not isfinite(volume):
                raise ValueError("Native stair obstruction volume nonfinite")
            if volume>1e-6:
                return None,"Native obstruction intrudes into a stair tread headroom"
    payload={"schema":"projection-loom/native-ascending-tread-chain",
             "scene_sha256":manifest["sha256"],"source":run.source,
             "destination":run.destination,"steps":list(run.steps),
             "principal_axis":"x" if axis==0 else "y",
             "total_native_rise":sum(c["top_rise"] for c in contacts),
             "max_native_step":max(c["top_rise"] for c in contacts),
             "minimum_tread_width":min(c["shared_width"] for c in contacts),
             "edge_contacts":contacts,"headroom":float(headroom),
             "scope":"bounded-native-edge-contact-and-step-height-only",
             "accessibility_certification":False,"load_certification":False,
             "automatic_promotion":False}
    return {**payload,"sha256":canonical_json_sha256(payload)},None
