"""Independent native CAD contact witness before proposing a causal bearing relation.

This verifies geometric support *contact*, not load-bearing engineering,
friction, stability, walkability or source survey authenticity. Neither
OpenUSD mesh proximity nor AABB overlap alone is accepted as native contact.
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import json
import math
import cadquery as cq
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepExtrema import BRepExtrema_DistShapeShape
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common

from .provenance_encoding import canonical_json_sha256
from .scene_usd import validate_scene
from .relational_ground import RelationalGround

SCHEMA = "projection-loom/native-geometric-support"


def _bounds(shape):
    box=Bnd_Box()
    BRepBndLib.AddOptimal_s(shape.wrapped,box,False,False)
    values=tuple(float(x) for x in box.Get())
    if not all(math.isfinite(x) for x in values):
        raise ValueError("Native exact BRep bounds are not finite")
    return values



def _bearing_face_area(lower, upper, lower_bounds, upper_bounds, gap, tolerance):
    """Measure actual overlapping horizontal STEP faces rather than their AABBs.

    Faces with only point/edge contact contribute zero area. Native analytic
    BRep intersections, not preview triangulation, decide this evidence.
    """
    top = [f for f in lower.Faces()
           if f.geomType() == "PLANE" and f.normalAt().z >= 0.9999
           and abs(_bounds(f)[2] - lower_bounds[5]) <= tolerance
           and abs(_bounds(f)[5] - lower_bounds[5]) <= tolerance]
    bottom = [f for f in upper.Faces()
              if f.geomType() == "PLANE" and f.normalAt().z <= -0.9999
              and abs(_bounds(f)[2] - upper_bounds[2]) <= tolerance
              and abs(_bounds(f)[5] - upper_bounds[2]) <= tolerance]
    if not top or not bottom:
        raise ValueError("Native bearing requires paired horizontal planar support faces")
    if len(top) * len(bottom) > 1024:
        raise ValueError("Native bearing face-pair audit exceeds bounded complexity")
    contact = 0.0
    for lower_face in top:
        for upper_face in bottom:
            aligned_upper = upper_face.translate((0, 0, -gap))
            intersection = BRepAlgoAPI_Common(
                lower_face.wrapped, aligned_upper.wrapped)
            intersection.Build()
            if not intersection.IsDone():
                raise ValueError("Native bearing planar intersection failed")
            shape = cq.Shape.cast(intersection.Shape())
            contact += sum(face.Area() for face in shape.Faces())
    if not math.isfinite(contact):
        raise ValueError("Native bearing face area is nonfinite")
    return contact


def native_support(bundle, lower_id, upper_id, *, tolerance=0.001,
                   minimum_contact_area=0.05):
    """Only a witnessed upper/lower face contact may inform a support proposal."""
    if (type(tolerance) not in (int,float) or not math.isfinite(tolerance)
            or not 1e-7 <= tolerance <= 0.01):
        raise ValueError("Bounded native contact tolerance required")
    if (type(minimum_contact_area) not in (int,float) or
            not math.isfinite(minimum_contact_area) or
            not 0 < minimum_contact_area <= 100):
        raise ValueError("Contact footprint threshold invalid")
    bundle=Path(bundle)
    validate_scene(bundle)
    manifest=json.loads((bundle/"manifest.json").read_text(encoding="utf8"))
    records={r["entity_id"]:r for r in manifest["bodies"]}
    if (lower_id == upper_id or lower_id not in records or upper_id not in records):
        raise ValueError("Geometric support requires two distinct existing native entities")
    def imported(name):
        p=bundle/records[name]["step_path"]
        shape=cq.importers.importStep(str(p)).val()
        if not shape.isValid() or len(shape.Solids())!=1:
            raise ValueError("Support evidence needs one valid exact native solid each")
        return shape
    lower,upper=imported(lower_id),imported(upper_id)
    a,b=_bounds(lower),_bounds(upper)
    contact_x=min(a[3],b[3])-max(a[0],b[0])
    contact_y=min(a[4],b[4])-max(a[1],b[1])
    area=max(0.,contact_x)*max(0.,contact_y)
    gap=b[2]-a[5]
    if area < minimum_contact_area:
        raise ValueError("Geometric supports require positive two-dimensional footprint overlap")
    if abs(gap)>tolerance:
        raise ValueError("Native bearing faces have a gap or penetration beyond tolerance")
    distance=BRepExtrema_DistShapeShape(lower.wrapped,upper.wrapped)
    distance.Perform()
    if not distance.IsDone() or not math.isfinite(distance.Value()):
        raise ValueError("OpenCascade exact solid distance could not be measured")
    if distance.Value()>tolerance:
        raise ValueError("Native solids do not contact at the bearing plane")
    contact_area = _bearing_face_area(lower, upper, a, b, gap, tolerance)
    if contact_area < minimum_contact_area:
        raise ValueError("Native bearing contact area below required minimum")
    payload={"schema":SCHEMA,"location":manifest["location"],
             "scene_sha256":manifest["sha256"],
             "lower":lower_id,"upper":upper_id,
             "lower_step_sha256":sha256((bundle/records[lower_id]["step_path"]).read_bytes()).hexdigest(),
             "upper_step_sha256":sha256((bundle/records[upper_id]["step_path"]).read_bytes()).hexdigest(),
             "native_distance":float(distance.Value()),
             "signed_vertical_gap":float(gap),
             "xy_contact_bound":float(area),
             "native_contact_area":float(contact_area),
             "tolerance":float(tolerance),
             "minimum_contact_area":float(minimum_contact_area),
             "contact_kind":"native-BRep-geometric-bearing-only",
             "load_certification":False,"occupancy_certification":False,
             "automatic_promotion":False}
    return {**payload,"sha256":canonical_json_sha256(payload)}


def propose_support(ground:RelationalGround, bundle, lower_id, upper_id, *,
                    actor="operator", tolerance=0.001):
    """Attach semantically only after an independent native contact witness."""
    if not isinstance(ground,RelationalGround) or ground.location != json.loads(
            (Path(bundle)/"manifest.json").read_text(encoding="utf8"))["location"]:
        raise ValueError("Native location and causal ground must agree")
    contact=native_support(bundle,lower_id,upper_id,tolerance=tolerance)
    operation={"kind":"attach","actor":actor,"target":upper_id,
               "frontier":list(ground.frontier),
               "payload":{"parent":lower_id,"verb":"supports","required":True}}
    next_ground,causal=ground.apply(operation)
    report={"schema":"projection-loom/native-support-proposal",
            "source_ground_sha256":ground.to_dict()["sha256"],
            "next_ground":next_ground.to_dict(),
            "operation_receipt":causal,
            "native_contact":contact,
            "status":"proposed-geometric-support-not-load-certified",
            "operator_promotion":False}
    return {**report,"sha256":canonical_json_sha256(report)}


def propose_reparent(ground: RelationalGround, bundle, old_parent, new_parent,
                     child, *, actor="operator", tolerance=0.001):
    """Reparent an existing *required* support with two real native face proofs.

    The old relation and both BRep bearing contacts are witnessed before any
    semantic change. No native geometry or five-phase controller is invented.
    """
    manifest=json.loads((Path(bundle)/"manifest.json").read_text(encoding="utf8"))
    if not isinstance(ground,RelationalGround) or ground.location!=manifest["location"]:
        raise ValueError("Native location and causal ground must agree")
    if len({old_parent,new_parent,child}) != 3:
        raise ValueError("Reparent needs three distinct native semantic entities")
    links=ground.snapshot()["relations"]
    required={"parent":old_parent,"child":child,"verb":"supports","required":True}
    if required not in links:
        raise ValueError("Reparent requires a currently required original support")
    old_contact=native_support(bundle,old_parent,child,tolerance=tolerance)
    new_contact=native_support(bundle,new_parent,child,tolerance=tolerance)
    operation={"kind":"reparent","actor":actor,"target":child,
               "frontier":list(ground.frontier),
               "payload":{"old_parent":old_parent,"new_parent":new_parent}}
    next_ground,causal=ground.apply(operation)
    report={"schema":"projection-loom/native-support-proposal",
            "source_ground_sha256":ground.to_dict()["sha256"],
            "next_ground":next_ground.to_dict(),
            "operation_receipt":causal,
            "prior_native_contact":old_contact,
            "native_contact":new_contact,
            "status":"proposed-geometric-reparent-not-load-certified",
            "operator_promotion":False}
    return {**report,"sha256":canonical_json_sha256(report)}


def verify_support_proposal(document,ground,bundle):
    if not isinstance(ground,RelationalGround):
        raise TypeError("Source semantic ground required")
    content={k:v for k,v in document.items() if k!="sha256"}
    if document.get("sha256")!=canonical_json_sha256(content):
        raise ValueError("Support proposal receipt digest changed")
    if document.get("schema")!="projection-loom/native-support-proposal":
        raise ValueError("Unsupported native support proposal")
    if document["source_ground_sha256"]!=ground.to_dict()["sha256"]:
        raise ValueError("Support proposal has stale causal source")
    contact=document["native_contact"]
    current=native_support(bundle,contact["lower"],contact["upper"],
                           tolerance=contact["tolerance"],
                           minimum_contact_area=contact["minimum_contact_area"])
    if current!=contact:
        raise ValueError("Native support evidence no longer matches source scene")
    next_ground=RelationalGround.from_dict(document["next_ground"])
    event=document["operation_receipt"]["event_id"]
    if event not in next_ground.events:
        raise ValueError("Native support proposal lacks admitted causal event")
    op=next_ground.events[event]["operation"]
    if op["kind"] == "attach":
        if (document.get("status")!="proposed-geometric-support-not-load-certified"
                or "prior_native_contact" in document
                or op["target"]!=contact["upper"]
                or op["payload"].get("parent")!=contact["lower"]
                or op["payload"].get("verb")!="supports"
                or op["payload"].get("required") is not True):
            raise ValueError("Support proposal causal relation differs from native evidence")
    elif op["kind"] == "reparent":
        prior=document.get("prior_native_contact")
        if (document.get("status")!="proposed-geometric-reparent-not-load-certified"
                or not isinstance(prior,dict)
                or op["target"]!=contact["upper"]
                or op["payload"].get("new_parent")!=contact["lower"]
                or op["payload"].get("old_parent")!=prior.get("lower")
                or prior.get("upper")!=contact["upper"]):
            raise ValueError("Reparent causal relation differs from native evidence")
        before=native_support(bundle,prior["lower"],prior["upper"],
                              tolerance=prior["tolerance"],
                              minimum_contact_area=prior["minimum_contact_area"])
        if before!=prior:
            raise ValueError("Reparent old native support evidence changed")
        if {"parent":prior["lower"],"child":prior["upper"],
            "verb":"supports","required":True} not in ground.snapshot()["relations"]:
            raise ValueError("Reparent lacks exact original required support")
    else:
        raise ValueError("Only native support attachment or reparent is supported")
    derived,receipt=ground.apply(op)
    if derived.to_dict()!=next_ground.to_dict() or receipt!=document["operation_receipt"]:
        raise ValueError("Native support proposal did not replay faithfully")
    return {"valid":True,"geometric_contact":True,"load_certified":False,
            "source_scene_sha256":contact["scene_sha256"],
            "causal_event":event,"automatic_promotion":False}
