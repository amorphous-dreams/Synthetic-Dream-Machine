"""Native, bounded auditions of Fire-authored architectural relationships.

The Fire-facing plan is immutable. Each alternative grows into a separate,
staged CadQuery construction and independently passes the same native joint,
one-solid union and void checks as the Loom. Failure never mutates the source
assembly. Claims of support describe contacts, not physical load capacity.
"""
from __future__ import annotations
from pathlib import Path
import json
import math

from .solid import SolidAssembly
from .grammar import grow_program
from .fire_contract import verify_plan
from .provenance_encoding import canonical_json_sha256


def _bounds(part):
    bb = part.solid.BoundingBox()
    return ((bb.xmin,bb.ymin,bb.zmin),(bb.xmax,bb.ymax,bb.zmax))


def _center(bounds):
    lo,hi = bounds
    return tuple((a+b)/2 for a,b in zip(lo,hi))


def _staged(original):
    """Independent copied witness, not mutating source even on failed CAD."""
    from .voids import VoidAssembly
    copy = SolidAssembly(overlap_ratio=original.overlap_ratio,
                         thickness_ratio=original.thickness_ratio)
    copy.parts = dict(original.parts)
    if original.voids is not None:
        copy.voids = VoidAssembly(copy)
        copy.voids.voids = dict(original.voids.voids)
    return copy


def _operations(rule, resolved, original):
    subject = resolved[rule["subject"]]
    target = resolved[rule["object"]]
    if subject not in original.parts or target not in original.parts:
        raise ValueError("Native rule endpoints must be existing material solids")
    sb = _bounds(original.parts[subject])
    tb = _bounds(original.parts[target])
    p = rule["parameters"]
    width = float(p.get("width",.35))
    depth = float(p.get("depth",.35))
    clearance = float(p.get("clearance",.25))
    prefix = "fire-" + rule["id"]
    if len(prefix) > 70:
        raise ValueError("Generated rule slot too long")
    if any(n.startswith(prefix) for n in original.parts):
        raise ValueError("Generated rule would reuse an existing CAD handle")
    desc = ("#has/fire-generated","#has/relational-construction")
    impl = rule["implementation"]
    if impl == "bridge-between":
        return [{"key":prefix+"-beam","op":"beam",
                 "parents":[subject,target],
                 "start":list(_center(sb)),"end":list(_center(tb)),
                 "width":width,"depth":depth,"slot":prefix+"-beam",
                 "has":[*desc,"#has/bridge"]}]
    if impl == "bearing-column":
        slo,shi = sb
        tlo,thi = tb
        if tlo[2] < slo[2]:
            raise ValueError("Bearing target must rise above its support")
        overlap_x = min(shi[0],thi[0])-max(slo[0],tlo[0])
        overlap_y = min(shi[1],thi[1])-max(slo[1],tlo[1])
        if min(overlap_x,overlap_y) <= 0:
            raise ValueError("Bearing volumes have no horizontal overlap")
        # Give the native bearing a visible shoulder beyond the upper mass
        # while retaining positive overlap with both existing bodies. A
        # buried member would pass contact but change no architectural form.
        # The joint audit still decides whether this placement actually holds.
        x = min(shi[0],thi[0]) + min(width,overlap_x)*.25
        y = min(shi[1],thi[1]) + min(depth,overlap_y)*.25
        start_z = (slo[2]+shi[2])/2
        end_z = (tlo[2]+thi[2])/2
        if end_z <= start_z+.01:
            raise ValueError("Bearing requires positive vertical span")
        return [{"key":prefix+"-column","op":"beam","parents":[subject,target],
                 "start":[x,y,start_z],"end":[x,y,end_z],
                 "width":min(width,overlap_x),"depth":min(depth,overlap_y),
                 "slot":prefix+"-column",
                 "has":[*desc,"#has/column-contact"]}]
    if impl == "ring-around":
        tlo,thi = tb
        slo,shi = sb
        cx,cy,_ = _center(tb)
        dx=(thi[0]-tlo[0])/2 + clearance
        dy=(thi[1]-tlo[1])/2 + clearance
        z=shi[2] - min(.1, (shi[2]-slo[2])*.05)
        if min(dx,dy)<=0:
            raise ValueError("Encirclement requires positive target dimensions")
        # Four material members arranged around the target in horizontal
        # section. Native audit rejects any segment not physically grounded.
        components=[
            ("north",(cx,cy+dy,z),(2*(dx+width),depth,width)),
            ("south",(cx,cy-dy,z),(2*(dx+width),depth,width)),
            ("east",(cx+dx,cy,z),(width,2*(dy+depth),width)),
            ("west",(cx-dx,cy,z),(width,2*(dy+depth),width)),
        ]
        return [{"key":prefix+"-"+label,"op":"box","parents":[subject],
                 "center":list(center),"size":list(size),"role":"secondary",
                 "slot":prefix+"-"+label,
                 "has":[*desc,"#has/encircling-member"]}
                for label,center,size in components]
    if impl == "study-only":
        return []
    raise ValueError("Unregistered Fire implementation")


def audition_plan(plan, native_assembly, *, location, max_parts=96,
                  max_added_volume_ratio=.75):
    """Audition each proposal *independently*; failed attempts change nothing.

    This is a native-gated proposal, not a new OODA-HA controller nor an
    Operator lineage promotion. Reject before expensive CAD where possible.
    """
    p = verify_plan(plan)
    if location != p["location"]:
        raise ValueError("Fire plan and native location disagree")
    if not (type(max_parts) is int and 1 <= max_parts <= 512):
        raise ValueError("Bounded native part budget required")
    if not (math.isfinite(max_added_volume_ratio)
            and 0 < max_added_volume_ratio <= 2):
        raise ValueError("Added-volume budget must be finite and positive")
    original_audit=native_assembly.audit(join=True)
    if not original_audit["valid"]:
        raise ValueError("Fire may not start from a failed native assembly")
    old_volume=original_audit["union_volume"]
    outputs=[]
    for alternative in p["alternatives"]:
        record={"id":alternative["id"],"relation":alternative["relation"],
                "implementation":alternative["implementation"],
                "state":"rejected","reason":None,
                "source_witness_id":p["source_witness_id"],
                "native_audit":None}
        try:
            if alternative["implementation"] == "study-only":
                record.update(state="study-only",reason="Unimplemented artistic hypothesis; no CAD produced")
            else:
                operations=_operations(alternative,p["resolved"],native_assembly)
                if len(native_assembly.parts)+len(operations)>max_parts:
                    raise ValueError("Native proposal exceeds part budget")
                draft=_staged(native_assembly)
                staged=grow_program(operations,{},assembly=draft)
                receipt=staged.audit(join=True)
                record["native_audit"]=receipt
                if not receipt["valid"] or receipt.get("union_solids")!=1:
                    raise ValueError("Native CAD/void audit rejected the construction")
                added=max(0.,receipt["union_volume"]-old_volume)
                if added <= max(1e-7,old_volume*1e-6):
                    raise ValueError("Capability was active but made no native material change")
                if added > old_volume*max_added_volume_ratio:
                    raise ValueError("Native construction exceeds relative-volume budget")
                witness=staged.relation_witness(location=location)
                record.update(state="native-admitted",reason=None,
                              added_volume=added,part_delta=len(staged.parts)-len(native_assembly.parts),
                              witness_id=witness.witness_id,
                              witness=witness.to_dict(),
                              rule_steps=operations,
                              claim="native BRep contact/union only; not engineered load safety")
        except (ValueError,KeyError,RuntimeError) as exc:
            record["reason"]=str(exc)[:450]
        record["receipt_sha256"]=canonical_json_sha256(record)
        outputs.append(record)
    return {
        "schema":"projection-loom/fire-native-audition",
        "plan_sha256":p["sha256"],"original_witness_id":p["source_witness_id"],
        "authority":"native-audited proposals, not Operator-approved lineage",
        "results":outputs,
        "source_unchanged":list(native_assembly.parts),
    }


def fire_audition(project, recipe, proposal, *, identity_ledger=None,
                  genome=None, score_size=(64,96)):
    """Compile Fire proposal against native Loom source and run bounded alternatives."""
    from .capability_stack import CapabilityCompositor
    from .fire_contract import resolve_proposal
    from .relations import PetNameLedger
    from .epochs import _hash
    import json
    source_mask=project.source_mask(score_size)
    loom=CapabilityCompositor(project,recipe,size=score_size,source_mask=source_mask)
    built=loom.grow(recipe.initial if genome is None else genome)
    witness=built.witness()
    ledger=(PetNameLedger.load(identity_ledger) if identity_ledger else None)
    plan=resolve_proposal(proposal,witness,ledger=ledger,
                          source_seed_sha256=(project.seed_entity.sha256
                                              if project.seed_entity is not None else None))
    result=audition_plan(plan,built.scene.assembly,location=project.location)
    result["source_construction_digest"]=loom.construction_digest()
    result["source_recipe_sha256"]=recipe.sha256
    result["source_genome_sha256"]=_hash(built.genome)
    result["source_genome"]=built.genome
    result["source_seed_sha256"]=(project.seed_entity.sha256
                                  if project.seed_entity is not None else None)
    result["plan"]=plan
    result["sha256"]=canonical_json_sha256(result)
    return result
