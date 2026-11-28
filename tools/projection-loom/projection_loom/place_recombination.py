"""Explicit region recombination of two independently source-preserving places.

YIN recombination admits only complete generated relation fragments from each
parent. It does not fuse native solids, transfer a parent's STEP success or
reinterpret the operator's artistic judgment.
"""
from __future__ import annotations
from .place_genome import PlaceGenome,unique_walkway_chain
from .place_source_seal import seal_constructive_growth
from .spatial_intent import SpatialIntent
from .provenance_encoding import canonical_json_sha256


def _handles(relation):
    if hasattr(relation,"deck"):
        return {relation.source,relation.deck,relation.destination}
    if hasattr(relation,"steps"):
        return {relation.source,*relation.steps,relation.destination}
    return {relation.lower,relation.column,relation.upper}


def _closed_relations(original,parent,selected,field):
    original_ids={b.entity_id for b in original.bodies}
    baseline=set(getattr(original,field))
    result=[]
    for rel in getattr(parent,field):
        if rel in baseline:
            continue
        generated=_handles(rel)-original_ids
        if not generated:
            raise ValueError("Region recombination cannot silently inherit an unselected original-only relation")
        if generated & selected and not generated<=selected:
            raise ValueError("Selected region would sever a parent native relationship")
        if generated<=selected:
            result.append(rel)
    return result


def recombine_place_regions(original,left,right,spatial,*,left_generated,right_generated):
    if not all(isinstance(x,PlaceGenome) for x in (original,left,right)):
        raise ValueError("Recombination requires original and two typed parent places")
    if not isinstance(spatial,SpatialIntent):
        raise ValueError("Recombination requires the original attributed spatial goals")
    a=seal_constructive_growth(original,left)
    b=seal_constructive_growth(original,right)
    def choice(rows,available):
        if (not isinstance(rows,(tuple,list)) or not rows
                or any(not isinstance(x,str) for x in rows)
                or list(rows)!=sorted(set(rows)) or not set(rows)<=set(available)):
            raise ValueError("Region selection must name sorted distinct generated bodies from its parent")
        return set(rows)
    la=choice(left_generated,a["generated_body_ids"])
    rb=choice(right_generated,b["generated_body_ids"])
    if la & rb:
        raise ValueError("Both parent regions cannot overwrite the same generated body")
    chosen={body.entity_id:body for body in original.bodies}
    for parent,names in ((left,la),(right,rb)):
        for body in parent.bodies:
            if body.entity_id in names:
                chosen[body.entity_id]=body
    relations={}
    for field,key in (("walkways",lambda r:(r.source,r.deck,r.destination)),
                      ("ascents",lambda r:(r.source,r.steps,r.destination)),
                      ("bearings",lambda r:(r.lower,r.column,r.upper))):
        raw=list(getattr(original,field))
        raw+=_closed_relations(original,left,la,field)
        raw+=_closed_relations(original,right,rb,field)
        if len(set(raw))!=len(raw):
            raise ValueError("Recombined native relations conflict or duplicate one another")
        relations[field]=tuple(sorted(raw,key=key))
    child=PlaceGenome(tuple(sorted(chosen.values(),key=lambda x:x.entity_id)),
                      relations["walkways"],relations["ascents"],relations["bearings"])
    # No two conflicting inherited routes may silently become one chosen route.
    for goal in spatial.goals:
        if goal.kind=="connect":
            unique_walkway_chain(child,goal.subject,goal.object)
    seal=seal_constructive_growth(original,child)
    body={"schema":"projection-loom/source-bound-region-recombination",
          "original_genome_sha256":original.identity,
          "left_parent_sha256":left.identity,
          "right_parent_sha256":right.identity,
          "spatial_intent_sha256":spatial.identity,
          "selected_left_generated":sorted(la),
          "selected_right_generated":sorted(rb),
          "child_genome_sha256":child.identity,
          "child_genome":child.to_dict(),
          "source_preserving_growth":seal,
          "native_reaudition_required":True,
          "automatic_operator_choice":False,
          "automatic_promotion":False,"physical_safety_certification":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_place_recombination(original,left,right,spatial,record):
    if not isinstance(record,dict) or record!=recombine_place_regions(
            original,left,right,spatial,
            left_generated=record["selected_left_generated"],
            right_generated=record["selected_right_generated"]):
        raise ValueError("Recombined region no longer follows original sources and explicit choices")
    return True
