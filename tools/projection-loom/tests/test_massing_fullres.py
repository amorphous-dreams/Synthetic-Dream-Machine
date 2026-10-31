"""Regression contracts for early-alpha source-bound massing evolution."""
from __future__ import annotations
import sys
from pathlib import Path
from projection_loom.campaign import FAMILY_FOCUSES, make_brood
from projection_loom.massing_relations import LOCI, describe_massing
from projection_loom.search_strategy import diversity_parents

HERE=Path(__file__).resolve().parents[1]/'examples/necrospire'

def test_massing_loci_owned_by_six_existing_families():
    owned=set().union(*(set(v) for v in FAMILY_FOCUSES.values()))
    assert set(LOCI).issubset(owned)
    assert len(FAMILY_FOCUSES)==6

def test_massing_bounded_and_deterministic():
    initial={k:v[1] for k,v in LOCI.items()}
    assert describe_massing(initial)==describe_massing(dict(reversed(list(initial.items()))))
    import pytest
    with pytest.raises(ValueError,match='all declared'):
        describe_massing({'arch.massing.terrace_dx':0.1})

def test_source_bound_breeding_no_extra_controller():
    sys.path.insert(0,str(HERE))
    try:
        from massing_fixture import draft_massing_pair
        _,recipe=draft_massing_pair()
    finally:
        sys.path.remove(str(HERE))
    class Empty:
        data={'members':{},'generations':{}}
        @staticmethod
        def component_parents(*a,**kw):return []
    proposals=make_brood(recipe.bounds,recipe.initial,Empty(),seed=41,
                         generation=1,offspring_per_family=3)
    assert len(proposals)==18
    assert all(p.ancestry['primary_massing'] is not None for p in proposals)

def test_duplicate_source_mask_can_inherit_distinct_synthetic_side_views():
    a={'id':'0001/a','combined_loss':.2,'mask_sha256':'a'*64,
       'orthographic_niche_sha256':'1'*64,'niche':'same','losses':{'silhouette':.2}}
    b={**a,'id':'0001/b','combined_loss':.21,'orthographic_niche_sha256':'2'*64}
    assert len(diversity_parents([a,b],2))==2
