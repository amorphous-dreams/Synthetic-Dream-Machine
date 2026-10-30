"""Before-native architectural proposal preview, rehydrated from typed source.

Describes ONLY what an attributable intent would construct. Not a source
survey, structural approval, native witness or independently chosen art.
"""
from __future__ import annotations
from .intent_seed import IntentContract
from .place_genome import PlaceGenome,propose_from_spatial_intent
from .spatial_intent import SpatialIntent
from .provenance_encoding import canonical_json_sha256


def preview_place_intent(intent,spatial,genome):
    if not isinstance(intent,IntentContract) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Preview requires attributed typed spatial goal and intent contract")
    if not isinstance(genome,PlaceGenome):
        raise ValueError("Preview requires an original native location genome")
    spatial.bind(intent)
    constructed=propose_from_spatial_intent(genome,spatial)
    original={row.entity_id:row for row in genome.bodies}
    proposed={row.entity_id:row for row in constructed.bodies}
    if (not set(original)<=set(proposed)
            or any(proposed[name]!=row for name,row in original.items())):
        raise ValueError("Intent constructor must never rewrite original native bodies")
    additions=[{"entity_id":name,
                "growth_program_sha256":proposed[name].program.identity,
                "placement":list(proposed[name].translation)}
               for name in sorted(set(proposed)-set(original))]
    def added(current,previous):
        old={canonical_json_sha256(x.to_dict()) for x in previous}
        if not old<={canonical_json_sha256(x.to_dict()) for x in current}:
            raise ValueError("New intent cannot silently erase originally authored relations")
        return [x.to_dict() for x in current if canonical_json_sha256(x.to_dict()) not in old]
    relations={"walkways":added(constructed.walkways,genome.walkways),
               "ascents":added(constructed.ascents,genome.ascents),
               "bearings":added(constructed.bearings,genome.bearings)}
    goals=[{"kind":g.kind,"subject":g.subject,"object":g.object,
            "status":"native-audition-required"} for g in spatial.goals]
    body={"schema":"projection-loom/intent-construction-preview",
          "location":intent.location,"intent_sha256":intent.identity,
          "spatial_intent_sha256":spatial.identity,
          "original_genome_sha256":genome.identity,
          "proposed_genome_sha256":constructed.identity,
          "original_body_count":len(original),
          "proposed_body_count":len(proposed),
          "preserved_original_bodies":sorted(original),
          "added_native_bodies":additions,"added_relations":relations,
          "goal_hypotheses":goals,
          "source_survey_certification":False,
          "native_audition_completed":False,
          "physical_safety_certification":False,
          "automatic_artist_winner":False,
          "automatic_promotion":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_place_intent_preview(intent,spatial,genome,receipt):
    if not isinstance(receipt,dict) or preview_place_intent(intent,spatial,genome)!=receipt:
        raise ValueError("Artistic intent preview no longer matches the original attributed construction")
    return True
