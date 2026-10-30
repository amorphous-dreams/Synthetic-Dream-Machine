"""Explicit Fire -> location intent adapter. Never parses an Art Sigil as code.

An operator must choose one EXACT pre-bound Fire alternative. Source witness,
entity selectors and location identities must all agree before a CAD program
can be constructed from an architectural relation. Non-implemented relations
stay studies rather than being silently approximated.
"""
from __future__ import annotations
from .fire_contract import verify_plan
from .spatial_intent import SpatialGoal, SpatialIntent
from .place_genome import PlaceGenome
from .provenance_encoding import canonical_json_sha256


def bind_fire_spatial(plan,intent,genome,*,alternative_id,source_witness_id,
                      authored_by,seed_sha256=None):
    if not isinstance(genome,PlaceGenome) or not alternative_id or not source_witness_id:
        raise ValueError("Fire location binding requires named native ground and source witness")
    verified=verify_plan(plan)
    if (verified.get("location")!=intent.location
            or verified.get("source_witness_id")!=source_witness_id
            or verified.get("seed_entity_sha256")!=seed_sha256):
        raise ValueError("Fire source location, seed or witness differs from the original")
    matching=[row for row in verified["alternatives"] if row.get("id")==alternative_id]
    if len(matching)!=1:
        raise ValueError("Fire selection must name one exact authored alternative")
    chosen=matching[0]
    relation_mapping={"bridges":("bridge-between","connect"),
                      "covers":("overhead-canopy","shelter"),
                      "ascends":("stair-flight","ascend")}
    relation=chosen.get("relation")
    pair=relation_mapping.get(relation)
    if pair is None or chosen.get("implementation")!=pair[0]:
        raise ValueError("Fire alternative lacks an implemented place-level spatial relation")
    resolved=verified["resolved"]
    if (chosen.get("subject") not in resolved or chosen.get("object") not in resolved):
        raise ValueError("Fire aliases are not unambiguously resolved")
    a,b=resolved[chosen["subject"]],resolved[chosen["object"]]
    ids={x.entity_id for x in genome.bodies}
    if a not in ids or b not in ids or a==b:
        raise ValueError("Bound Fire endpoints do not identify distinct native location bodies")
    parameters=chosen.get("parameters",{})
    if not isinstance(parameters,dict) or set(parameters)-{"width","max_step","depth","clearance","setback"}:
        raise ValueError("Fire spatial parameters must remain bounded and typed")
    spatial=SpatialIntent(intent.identity,(SpatialGoal(
        pair[1],a,b,
        min_width=parameters.get("width",.8),
        max_step=parameters.get("max_step",1.1)),),authored_by)
    return {"schema":"projection-loom/fire-spatial-binding",
            "spatial_intent":spatial.to_dict(),
            "spatial_intent_sha256":spatial.identity,
            "fire_plan_sha256":verified["sha256"],
            "selected_alternative_id":alternative_id,
            "original_source_witness_id":source_witness_id,
            "source_seed_sha256":seed_sha256,
            "claim_scope":"selected-source-bound-native-spatial-proposal-only",
            "automatic_promotion":False}


def verify_fire_spatial(binding,plan,intent,genome):
    recreated=bind_fire_spatial(plan,intent,genome,
        alternative_id=binding["selected_alternative_id"],
        source_witness_id=binding["original_source_witness_id"],
        seed_sha256=binding["source_seed_sha256"],
        authored_by=binding["spatial_intent"]["authored_by"])
    if binding!=recreated:
        raise ValueError("Fire-to-place bridge changed its source-bound selection")
    return True
