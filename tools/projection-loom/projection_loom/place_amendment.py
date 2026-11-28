"""Explicit, attributed permission to change a reviewed place's next intent.

An accepted native place selects ancestry, not a future design philosophy.
Changing the authored aim or spatial constraints requires a separate operator
amendment, checked against the original campaign's immutable preregistration.
"""
from __future__ import annotations
from .intent_seed import IntentContract
from .spatial_intent import SpatialIntent
from .provenance_encoding import canonical_json_sha256


def author_place_amendment(prior,intent,spatial,*,actor,reason):
    if (not isinstance(prior,dict) or prior.get("schema")!="projection-loom/place-preregistration"
            or not isinstance(intent,IntentContract) or not isinstance(spatial,SpatialIntent)):
        raise ValueError("Changed place intent requires original preregistration and typed goals")
    spatial.bind(intent)
    if not isinstance(actor,str) or not actor.strip() or not isinstance(reason,str) or not reason.strip():
        raise ValueError("Place change-of-direction requires an attributable actor and stated reason")
    if intent.location!=prior["location"]:
        raise ValueError("Place intent amendment cannot retarget a different original location")
    if (prior["intent_sha256"],prior["spatial_intent_sha256"])==(
            intent.identity,spatial.identity):
        raise ValueError("Unchanged place intent does not require an amendment")
    body={"schema":"projection-loom/place-intent-amendment",
          "prior_run_id":prior["run_id"],
          "prior_pre_registration_sha256":canonical_json_sha256(prior),
          "prior_intent_sha256":prior["intent_sha256"],
          "prior_spatial_intent_sha256":prior["spatial_intent_sha256"],
          "new_intent_sha256":intent.identity,
          "new_spatial_intent_sha256":spatial.identity,
          "location":intent.location,"actor":actor,"reason":reason,
          "automatic_artistic_promotion":False,
          "claim_scope":"operator-attributed-amended-study-not-canon"}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_place_amendment(amendment,prior,intent,spatial):
    if not isinstance(amendment,dict):
        raise ValueError("Changed native place requires an explicit intent amendment")
    expected=author_place_amendment(
        prior,intent,spatial,actor=amendment.get("actor"),
        reason=amendment.get("reason"))
    if amendment!=expected:
        raise ValueError("Intent amendment diverges from prior campaign or new authored purpose")
    return True
