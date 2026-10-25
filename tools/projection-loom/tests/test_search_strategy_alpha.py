"""Alpha search-contract tests: source-bound coevolution without a second helm."""
import numpy as np
import pytest
from projection_loom.campaign import FAMILY_FOCUSES, LineageArchive, make_brood, visual_descriptor
from projection_loom.search_strategy import (
    SurrogatePreview, regional_loss, diversity_parents, pareto_front, searchability_census
)

def test_all_declared_loci_reachable_and_joining_switch_reproduces(tmp_path):
    from pathlib import Path
    from projection_loom.capability_stack import CapabilityRecipe
    recipe=CapabilityRecipe.load(Path(__file__).resolve().parents[1]/
                                 "examples/necrospire/hybrid/recipe_breeding.json")
    archive=LineageArchive(tmp_path/"lineages.json",identity={"experiment":recipe.sha256})
    a=make_brood(recipe.bounds,recipe.initial,archive,seed=41,generation=1,offspring_per_family=12)
    b=make_brood(recipe.bounds,recipe.initial,archive,seed=41,generation=1,offspring_per_family=12)
    assert a==b and len(a)==72
    assert len({p.id for p in a})==72
    assert set().union(*map(set,FAMILY_FOCUSES.values()))==set(recipe.bounds)
    assert all(p.ancestry["family"] in FAMILY_FOCUSES for p in a)
    assert all(p.ancestry["entity"] in ("Crystal","Joining","Fortress") for p in a)
    join=[p for p in a if p.ancestry["family"]=="terraces"]
    assert any(p.genome["join.enable"]>=.5 for p in join)
    assert any(p.genome["join.enable"]<.5 for p in join)
    assert archive.census(recipe.bounds,activations=["join.enable"])["unreachable_loci"]==[]

def test_descriptor_has_profile_center_and_real_hole_observation():
    mask=np.zeros((64,96),dtype=bool)
    mask[8:50,20:70]=True
    mask[23:32,33:45]=False
    trait=visual_descriptor(mask)
    assert trait["holes"]==1
    assert len(trait["region_centers"])==6
    assert len(trait["region_coverage"])==6
    assert "|center:" in trait["niche"] and "|holes:" in trait["niche"]
    assert visual_descriptor(mask.copy())==trait

def test_regional_fitness_bounded_and_localized():
    a=np.zeros((60,40),dtype=bool)
    a[2:12,10:25]=True
    b=a.copy()
    b[2:12,10:25]=False
    assert regional_loss(a,b,"crown")>0
    assert regional_loss(a,b,"needle")==0.
    with pytest.raises(ValueError):
        regional_loss(a,b,"unknown")

def test_pareto_and_diversity_choose_multiple_niches():
    def row(i,loss,niche,mask,prior):
        return {"id":i,"combined_loss":loss,"losses":{"silhouette":loss,"prior":prior},
                "mask_sha256":mask,"niche":niche,"specialist_loss":loss}
    rows=[row("a",.1,"n1","m1",.8),row("b",.2,"n2","m2",.1),
          row("c",.3,"n2","m3",.9)]
    assert {r["id"] for r in pareto_front(rows)}=={"a","b"}
    selected=diversity_parents(rows,limit=2)
    assert {r["niche"] for r in selected}=={"n1","n2"}

def test_surrogate_only_orders_candidates_and_reports_low_data():
    class Archive:
        data={"members":{"x":{"id":"1","genome":{"x":.1},
                              "losses":{"silhouette":.3}}}}
    model=SurrogatePreview({"x":(0.,1.)},Archive())
    assert model.predict({"x":.4})["predicted_loss"] is None
    assert np.isfinite(model.priority({"x":.4}))
    with pytest.raises(ValueError):
        model.predict({"x":float("nan")})

def test_component_specialists_assemble_in_shared_source_identity(tmp_path):
    from pathlib import Path
    from projection_loom.capability_stack import CapabilityRecipe
    recipe=CapabilityRecipe.load(Path(__file__).resolve().parents[1]/
                                 "examples/necrospire/hybrid/recipe_breeding.json")
    archive=LineageArchive(tmp_path/"archive.json",identity={"recipe":recipe.sha256})
    child=make_brood(recipe.bounds,recipe.initial,archive,seed=41,
                     generation=1,offspring_per_family=3)[0]
    assert child.parent=="original-seed"
    assert child.ancestry["collaborators"]=={}
    import hashlib
    phenotype="visual:"+hashlib.sha256(b"first-mask").hexdigest()
    p=child
    run={"run_id":"run-1","proposals":{p.id:{
        "id":p.id,"emitter":p.emitter,"genome":p.genome,"parent":p.parent,"ancestry":p.ancestry}},
        "results":{p.id:{"state":"scored","combined_loss":.3,
            "losses":{"silhouette":.2,"prior":.02,"regional":.08},
            "phenotype":[phenotype,"visual-niche:region-A"],
            "witness_id":"w","evidence_state":"provisional"}}}
    assert archive.assimilate(1,run)["scored"]==1
    inherited=make_brood(recipe.bounds,recipe.initial,archive,seed=41,
                         generation=2,offspring_per_family=3)
    needle=[p for p in inherited if p.ancestry["family"]=="needle"]
    assert any(p.parent.startswith("0001/") for p in needle)
    assert all(p.ancestry["generation"]==2 for p in inherited)


def test_emitter_performance_and_credit_preserve_unseen_methods():
    from projection_loom.search_strategy import emitter_performance, adaptive_priorities
    from projection_loom.epochs import Proposal
    class Archive:
        data={"members":{"r1":{"id":"r1","family":"needle",
            "emitter":"family:needle:sobol","combined_loss":.3,
            "mask_sha256":"different","losses":{"silhouette":.3}}}}
    scores=emitter_performance(Archive())
    assert scores["family:needle:sobol"]["improvements"]==1
    proposals=[
        Proposal("one","family:needle:sobol",{"x":.1}),
        Proposal("two","family:needle:topology",{"x":.8})]
    bonuses=adaptive_priorities(proposals,Archive())
    assert set(bonuses)=={"one","two"}
    assert bonuses["two"]<0 and all(np.isfinite(v) for v in bonuses.values())


def test_multiscale_contour_observes_structural_difference():
    from projection_loom.search_strategy import multiscale_source_loss
    source=np.zeros((64,64),dtype=bool)
    source[10:40,12:36]=True
    same=multiscale_source_loss(source,source)
    assert same['macro']==0 and same['contour']==0
    changed=source.copy()
    changed[20:40,16:36]=False
    values=multiscale_source_loss(source,changed)
    assert values['macro']>0 and values['contour']>0
    assert all(0<=v<=1 for v in values.values())
    with pytest.raises(ValueError):
        multiscale_source_loss(source,np.zeros((64,64),dtype=float))

def test_surplus_scoring_seats_adapt_but_preserve_family_fairness():
    from projection_loom.selection import allocate_detail_seats
    from projection_loom.epochs import Proposal
    rows=[Proposal(f'{f}-{m}-{k}',f'family:{f}:{m}',{'x':float(k)})
        for f in ('needle','crown')
        for m in ('sobol','local','topology') for k in range(3)]
    rewards={'family:needle:local':{'exploration_value':1.,'scored':2},
             'family:crown:topology':{'exploration_value':1.,'scored':2}}
    selected=allocate_detail_seats(rows,max_detail=10,emitter_turn=0,
                                   emitter_performance=rewards)
    assert len(selected)==10
    assert {p.emitter.split(':')[1] for p in selected}=={'needle','crown'}
    assert all(any(p.emitter==f'family:{f}:{m}' for p in selected)
               for f in ('needle','crown') for m in ('local','sobol','topology'))
