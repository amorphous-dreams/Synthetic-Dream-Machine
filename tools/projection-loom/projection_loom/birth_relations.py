"""Heritable but bounded architectural grafts for source-held Necrospire CAD.

The recipe chooses a typed relation, not Python, anonymous mesh data, face
indexes, unreviewed new references or an independent breeding controller.
Only the native SolidAssembly and its void audit may admit offspring.
"""
from __future__ import annotations

import math

LOCI = {
    "arch.birth.enable": ((0.0, 1.0), 0.0),
    "arch.birth.mode": ((0.0, 3.0), 0.25),
    "arch.birth.width": ((0.35, 1.25), 0.60),
    "arch.birth.depth": ((0.35, 1.25), 0.60),
    "arch.birth.clearance": ((0.1, 0.8), 0.25),
    "arch.birth.setback": ((0.0, 0.20), 0.05),
}

FAMILIES = (
    ("bears", "bearing-column", "lower terrace", "central keep"),
    ("bridges", "bridge-between", "western gallery", "front lower terrace"),
    ("skirts", "skirting-court", "lower terrace", "central keep"),
)


def describe_birth(genome):
    """Describe an inherited proposal; none for recipes without birth loci."""
    present=set(LOCI) & set(genome)
    if not present:
        return None
    if present!=set(LOCI):
        raise ValueError("Architectural birth needs every declared relation locus")
    numbers={}
    for key,(bounds,_) in LOCI.items():
        value=genome[key]
        if (isinstance(value,bool) or not isinstance(value,(int,float)) or
                not math.isfinite(float(value)) or not bounds[0]<=value<=bounds[1]):
            raise ValueError("Architectural birth locus is unbounded: "+key)
        numbers[key]=float(value)
    active=numbers["arch.birth.enable"]>=.5
    index=min(2,int(numbers["arch.birth.mode"]))
    relation,implementation,subject,target=FAMILIES[index]
    return {
        "schema":"projection-loom/heritable-relation-proposal",
        "state":"proposed" if active else "inactive",
        "relation":relation,
        "implementation":implementation,
        "subject_handle":subject,
        "object_handle":target,
        "mode_cell":index,
        "parameters":{
            "width":numbers["arch.birth.width"],
            "depth":numbers["arch.birth.depth"],
            "clearance":numbers["arch.birth.clearance"],
            "setback":numbers["arch.birth.setback"],
        },
        "authority":"bounded source-derived proposal, not native admission or Operator promotion",
    }


def apply_birth(assembly, genome):
    """Compile one proposal through the existing Fire construction vocabulary."""
    record=describe_birth(genome)
    if record is None or record["state"]=="inactive":
        return record
    from .fire_geometry import _operations
    from .grammar import grow_program
    support=record["subject_handle"]
    target=record["object_handle"]
    if support==target or support not in assembly.parts or target not in assembly.parts:
        raise ValueError("Architectural birth source endpoints are not available")
    instruction={
        "id":"inherited-graft",
        "subject":"support",
        "object":"target",
        "relation":record["relation"],
        "implementation":record["implementation"],
        "parameters":record["parameters"],
    }
    operations=_operations(instruction,{"support":support,"target":target},assembly)
    if not 1<=len(operations)<=4:
        raise ValueError("Architectural birth exceeded its construction budget")
    grow_program(operations,{},assembly=assembly)
    return record


def observe_birth(assembly, genome):
    """Recognize observed geometry independently from inherited intent.

    Only call this after a native admission. Simple AABB relationships are
    modest spatial evidence, not a human accessibility or load certificate.
    """
    proposal=describe_birth(genome)
    if proposal is None:
        return None
    names=tuple(sorted(name for name in assembly.parts
                       if name.startswith("fire-inherited-graft-")))
    expected=proposal["state"]=="proposed"
    if bool(names)!=expected:
        raise ValueError("Native birth construction differs from proposed state")
    features=[]
    if names:
        support=assembly.parts[proposal["subject_handle"]].solid.BoundingBox()
        for name in names:
            bound=assembly.parts[name].solid.BoundingBox()
            if bound.xmin<support.xmin-.05 or bound.xmax>support.xmax+.05:
                features.append("observed:birth-extends-x")
            if bound.ymin<support.ymin-.05 or bound.ymax>support.ymax+.05:
                features.append("observed:birth-extends-y")
            if bound.zmax>support.zmax+.05:
                features.append("observed:birth-rises-above-support")
    features=sorted(set(features))
    return {"source":"native part bounding boxes after full CAD admission",
            "proposal":proposal,"generated_parts":list(names),
            "observed_relations":features,
            "truth_scope":"AABB spatial comparisons; no human route or mechanical certification"}


def birth_traits(assembly, genome):
    """Feed observed architecture into existing phenotype niches, not a helm."""
    witness=observe_birth(assembly,genome)
    if witness is None:
        return ()
    proposal=witness["proposal"]
    if proposal["state"]=="inactive":
        return ("architecture:birth-inactive",)
    return tuple(sorted([
        "architecture:relation:"+proposal["relation"],
        "architecture:mode-cell:"+str(proposal["mode_cell"]),
        *witness["observed_relations"],
    ]))
