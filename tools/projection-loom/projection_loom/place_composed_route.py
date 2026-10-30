"""Operator-selected right-angle passage composed with other authored aims.

Keeps one original place and its complete SpatialIntent. A named bend
resolves exactly one diagonal crossing; the existing constructor then
grows compatible shelter, ascent or bearing proposals. No native proof,
selection or artistic promotion enters through this preparatory step.
"""
from __future__ import annotations
from .place_genome import PlaceGenome,propose_from_spatial_intent
from .place_orthogonal_route import propose_orthogonal_route
from .place_source_seal import seal_constructive_growth
from .place_obligations import plan_spatial_obligations
from .spatial_intent import SpatialIntent
from .provenance_encoding import canonical_json_sha256


def compose_operator_route(genome:PlaceGenome,spatial:SpatialIntent,*,
                           goal_index:int,turn:str,corner_id:str):
    if (not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent)
            or type(goal_index) is not int or not 0<=goal_index<len(spatial.goals)):
        raise ValueError("Composed operator route requires an original indexed spatial goal")
    goal=spatial.goals[goal_index]
    if goal.kind!="connect":
        raise ValueError("Composed operator bend must select a connect goal")
    original_plan=plan_spatial_obligations(genome,spatial)
    selected=SpatialIntent(spatial.intent_sha256,(goal,),spatial.authored_by)
    bent=propose_orthogonal_route(genome,selected,turn=turn,corner_id=corner_id)
    # The full intent consumes the selected route, never replaces it with an
    # invented direct crossing. Every other goal still faces native audit.
    grown=propose_from_spatial_intent(bent,spatial)
    source=seal_constructive_growth(genome,grown)
    body={"schema":"projection-loom/operator-composed-spatial-route",
          "original_genome_sha256":genome.identity,
          "spatial_intent_sha256":spatial.identity,
          "original_obligations_sha256":original_plan["sha256"],
          "operator_selected_goal_index":goal_index,
          "operator_selected_turn":turn,
          "operator_selected_corner":corner_id,
          "source_preserving_growth":source,
          "proposed_genome_sha256":grown.identity,
          "proposed_genome":grown.to_dict(),
          "native_audition_completed":False,
          "automatic_artistic_winner":False,
          "physical_safety_certification":False,
          "automatic_promotion":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_composed_operator_route(genome,spatial,receipt):
    if not isinstance(receipt,dict):
        raise ValueError("Composed route needs an immutable typed receipt")
    expected=compose_operator_route(genome,spatial,
        goal_index=receipt["operator_selected_goal_index"],
        turn=receipt["operator_selected_turn"],
        corner_id=receipt["operator_selected_corner"])
    if receipt!=expected:
        raise ValueError("Selected multi-goal route differs from original operator and source")
    return True
