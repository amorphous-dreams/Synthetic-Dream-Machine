"""RED-first pre-campaign search controls: exposure, evidence funnel, model sufficiency.

Quality-diversity and cheap predictions never supersede native CAD/void gates.
"""
from pathlib import Path

import numpy as np
import pytest

from projection_loom.epochs import Proposal
from projection_loom.campaign import activation_funnel
from projection_loom.selection import schedule_candidates
from projection_loom.search_strategy import (
    SurrogatePreview, infer_locus_interactions,
)


def test_budget_block_rotation_auditions_all_eighteen_emitters_in_two_generations():
    rows=[Proposal(f"{family}-{method}", f"family:{family}:{method}",
                   {"x":float(i)})
          for i,family in enumerate(("needle","crystal","fractured",
                                     "terraces","crown","keep"))
          for method in ("sobol","local","topology")]
    observed=set()
    for generation in range(2):
        selected=schedule_candidates(rows,max_exact=12,emitter_turn=generation,
                                     preview=lambda genome: -genome["x"])
        assert len(selected)==12
        assert len({p.emitter for p in selected})==12
        observed.update(p.emitter for p in selected)
        assert selected==schedule_candidates(list(reversed(rows)),
            max_exact=12,emitter_turn=generation,
            preview=lambda genome: -genome["x"])
    assert observed=={p.emitter for p in rows}
    assert "family:terraces:topology" in observed


def test_activation_funnel_counts_opportunities_separately_from_native_success():
    checkpoint={"proposals":{
        "a":{"genome":{"join.enable":.8},"emitter":"family:terraces:topology"},
        "b":{"genome":{"join.enable":.1},"emitter":"family:needle:sobol"},
        "c":{"genome":{"join.enable":.9},"emitter":"family:terraces:local"},
        "d":{"genome":{"join.enable":.7},"emitter":"family:terraces:sobol"}},
        "results":{"a":{"state":"audited","audit":{"valid":True}},
                   "b":{"state":"scored","audit":{"valid":True}},
                   "c":{"state":"rejected","audit":{"valid":False}},
                   "d":{"state":"deferred"}}}
    checkpoint["results"]["a"]["audit"].update(union_valid=True,union_solids=1)
    checkpoint["results"]["b"]["audit"].update(union_valid=True,union_solids=1)
    report=activation_funnel(checkpoint["proposals"],checkpoint["results"],
                             ("join.enable",))["join.enable"]
    assert report["proposed"]=={"active":3,"inactive":1}
    assert report["exact_attempted"]=={"active":2,"inactive":1}
    assert report["native_valid"]=={"active":1,"inactive":1}
    assert report["scored"]=={"active":0,"inactive":1}
    assert report["audited"]=={"active":1,"inactive":0}
    assert report["rejected"]=={"active":1,"inactive":0}


def test_observational_interaction_inference_refuses_underdetermined_25_locus_archives():
    rng=np.random.default_rng(17)
    bounds={f"locus-{j}":(0.,1.) for j in range(25)}
    rows={}
    for i in range(28):
        genome={key:float(rng.random()) for key in bounds}
        rows[str(i)]={"id":f"0001/sample-{i}","genome":genome,
                      "losses":{"silhouette":float(rng.random())}}
    class Archive:
        data={"members":rows}
    assert infer_locus_interactions(bounds,Archive(),min_samples=24,
                                    threshold=.001)==[]


def test_surrogate_never_extrapolates_across_unobserved_activation_states():
    bounds={"join.enable":(0.,1.),"shaft_width":(0.,1.)}
    rows={}
    for i in range(26):
        rows[str(i)]={"id":f"0001/member-{i:03d}",
                      "genome":{"join.enable":.1,"shaft_width":i/25.},
                      "losses":{"silhouette":.1+i*.001}}
    class Archive:
        data={"members":rows}
    predictor=SurrogatePreview(bounds,Archive(),activation_loci=("join.enable",))
    off=predictor.predict({"join.enable":.1,"shaft_width":.5})
    assert off["predicted_loss"] is not None
    on=predictor.predict({"join.enable":.9,"shaft_width":.5})
    assert on["predicted_loss"] is None
    assert on["neighbors"]==0
    assert np.isfinite(predictor.priority({"join.enable":.9,"shaft_width":.5}))


@pytest.mark.slow
def test_directed_joining_surface_passes_native_composition_without_selection_lottery():
    from projection_loom.pipeline import Project
    from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor
    examples=Path(__file__).resolve().parents[1]/"examples/necrospire"
    project=Project.load(examples/"project_breeding.json")
    recipe=CapabilityRecipe.load(examples/"hybrid/recipe_breeding.json")
    comp=CapabilityCompositor(project,recipe,size=(64,96),
                              source_mask=project.source_mask((64,96)))
    genome=dict(recipe.initial,**{"join.enable":.8})
    build=comp.grow(genome)
    states={row["id"]:row["state"] for row in build.steps}
    assert states["join.mesh"]=="complete"
    assert states["join.socket"]=="complete"
    assert build.audit["cad_valid"]
    assert build.audit["composite_valid_for_render"]
    assert build.audit["composite_cad_union_verified"] is False


def test_activation_cohort_uses_physical_switch_threshold_not_normalized_midpoint():
    # The constructive activation is value >= 0.5, irrespective of the
    # source-bound locus interval. A normalized midpoint can mean 0.8 here.
    bounds={"join.enable":(.2,1.2),"shaft_width":(0.,1.)}
    rows={}
    for i in range(26):
        rows[str(i)]={"id":f"0001/off-{i:03d}",
                      "genome":{"join.enable":.4,"shaft_width":i/25.},
                      "losses":{"silhouette":.18+i*.001}}
    class Archive:
        data={"members":rows}
    predictor=SurrogatePreview(bounds,Archive(),activation_loci=("join.enable",))
    assert predictor.predict({"join.enable":.4,"shaft_width":.5})["predicted_loss"] is None or predictor.ready
    active=predictor.predict({"join.enable":.6,"shaft_width":.5})
    assert active["predicted_loss"] is None
    assert active["neighbors"]==0
