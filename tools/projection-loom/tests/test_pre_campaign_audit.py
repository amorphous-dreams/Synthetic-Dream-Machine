"""RED-first pre-campaign audit economics and activation visibility.

The fixed audit budget is not proof that every constructive switch was tried.
A source-bound run must account separately for proposal, exact audition, native
admission, and provisional source-view scoring without weakening the CAD gate.
"""
import hashlib

from projection_loom.campaign import LineageArchive, make_brood
from projection_loom.capability_stack import CapabilityRecipe
from projection_loom.selection import schedule_candidates


def _recipe():
    from pathlib import Path
    return CapabilityRecipe.load(Path(__file__).resolve().parents[1] /
                                 "examples/necrospire/hybrid/recipe_alpha.json")


def test_exact_seats_interleave_families_and_cover_topology_across_two_generations(tmp_path):
    from projection_loom.campaign import FAMILY_FOCUSES
    r=_recipe()
    archive=LineageArchive(tmp_path/"archive.json",identity={"recipe":r.sha256})
    observed=set()
    for generation in (1,2):
        brood=make_brood(r.bounds,r.initial,archive,seed=41,
                         generation=generation,offspring_per_family=3)
        scheduled=schedule_candidates(brood,preview=lambda genome:0.,
                     max_exact=12,emitter_turn=generation-1)
        assert len(scheduled)==12
        assert {p.emitter.split(":")[1] for p in scheduled}==set(FAMILY_FOCUSES)
        assert len({p.emitter for p in scheduled})==12
        observed.update(p.emitter for p in scheduled)
    assert {f"family:{family}:{mode}"
            for family in FAMILY_FOCUSES
            for mode in ("sobol","local","topology")}==observed


def test_activation_funnel_separates_proposed_audited_valid_and_scored(tmp_path):
    r=_recipe()
    archive=LineageArchive(tmp_path/"archive.json",identity={"recipe":r.sha256})
    def proposal(name,active):
        g=dict(r.initial)
        g["join.enable"]=.85 if active else .15
        return {"emitter":"family:terraces:topology","genome":g,
                "parent":"original-seed"}
    good_audit={"valid":True,"union_valid":True,"union_solids":1}
    def scored(name,loss):
        return {"state":"scored","combined_loss":loss,
                "losses":{"silhouette":loss},
                "phenotype":["visual:"+hashlib.sha256(name.encode()).hexdigest(),
                             "visual-niche:tile-"+name],
                "witness_id":"native-"+name,"evidence_state":"provisional",
                "audit":dict(good_audit)}
    checkpoint={"run_id":"epoch-funnel","proposals":{
        "active-scored":proposal("active-scored",True),
        "active-rejected":proposal("active-rejected",True),
        "active-audited":proposal("active-audited",True),
        "active-deferred":proposal("active-deferred",True),
        "inactive-scored":proposal("inactive-scored",False)},
        "results":{
            "active-scored":scored("active-scored",.32),
            "active-rejected":{"state":"rejected","reason":"CAD contact",
                "audit":{"valid":False,"union_valid":False,"union_solids":2}},
            "active-audited":{"state":"audited","reason":"detail budget",
                "audit":dict(good_audit)},
            "active-deferred":{"state":"deferred","reason":"exact budget"},
            "inactive-scored":scored("inactive-scored",.30)}}
    report=archive.assimilate(1,checkpoint,activations=("join.enable",))
    assert report["scored"]==2 and report["rejected"]==1
    funnel=archive.census(r.bounds,activations=("join.enable",))["activation_funnel"]["join.enable"]
    assert funnel["proposed"]=={"active":4,"inactive":1}
    assert funnel["exact_attempted"]=={"active":3,"inactive":1}
    assert funnel["native_valid"]=={"active":2,"inactive":1}
    assert funnel["scored"]=={"active":1,"inactive":1}
    assert funnel["rejected"]=={"active":1,"inactive":0}
    assert funnel["deferred"]=={"active":1,"inactive":0}
    assert archive.assimilate(1,checkpoint,activations=("join.enable",))==report
    again=LineageArchive(tmp_path/"archive.json",identity={"recipe":r.sha256})
    assert again.census(r.bounds,activations=("join.enable",))["activation_funnel"]["join.enable"]==funnel


def test_conditional_topology_mutates_one_switch_at_a_time(tmp_path):
    r=_recipe()
    archive=LineageArchive(tmp_path/"archive.json",identity={"recipe":r.sha256})
    generations=[]
    for generation in (1,2):
        broth=make_brood(r.bounds,r.initial,archive,seed=41,
                         generation=generation,offspring_per_family=3)
        topology=next(p for p in broth if p.emitter=="family:terraces:topology")
        switches=[key for key in ("join.enable","grammar.gallery")
                  if (topology.genome[key]>=.5)!=(r.initial[key]>=.5)]
        assert len(switches)==1
        generations.extend(switches)
    assert set(generations)=={"join.enable","grammar.gallery"}
