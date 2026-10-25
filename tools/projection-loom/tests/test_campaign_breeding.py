"""RED-first: six source-bound families with new CAD expression and deterministic breeding."""
from pathlib import Path
import pytest
from projection_loom.campaign import LineageArchive, make_brood, FAMILY_FOCUSES
from projection_loom.pipeline import Project
from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor

EXAMPLES=Path(__file__).resolve().parents[1]/'examples/necrospire'


def breeding():
    project=Project.load(EXAMPLES/'project_breeding.json')
    recipe=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe_breeding.json')
    return project, recipe


def test_breeding_recipe_is_a_new_source_bound_identity():
    project,recipe=breeding()
    old=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe.json')
    assert recipe.sha256!=old.sha256
    assert recipe.version==2
    assert recipe.source_hashes==old.source_hashes
    assert set(project.initial)==set(recipe.cad_keys)
    assert set(project.initial)>set(Project.load(EXAMPLES/'project.json').initial)
    assert len(FAMILY_FOCUSES)==6
    compositor=CapabilityCompositor(project,recipe,size=(64,96),
        source_mask=project.source_mask((64,96)))
    assert compositor.construction_digest()


def test_brood_is_reproducible_fair_and_keeps_anonymous_parentage(tmp_path):
    project,recipe=breeding()
    archive=LineageArchive(tmp_path/'a.json',identity={'experiment':recipe.sha256})
    a=make_brood(recipe.bounds,recipe.initial,archive,seed=41,generation=1,
                 offspring_per_family=6)
    b=make_brood(recipe.bounds,recipe.initial,archive,seed=41,generation=1,
                 offspring_per_family=6)
    assert a==b
    assert len(a)==36 and len({p.id for p in a})==36
    modes={p.emitter.split(':')[2] for p in a}
    assert modes=={'sobol','local','topology'}
    assert {p.emitter.split(':')[1] for p in a}==set(FAMILY_FOCUSES)
    assert all(p.parent=='original-seed' for p in a)
    assert all(set(p.genome)==set(recipe.bounds) for p in a)
    assert all(lo<=p.genome[k]<=hi for p in a for k,(lo,hi) in recipe.bounds.items())
    assert a!=make_brood(recipe.bounds,recipe.initial,archive,seed=42,
                         generation=1,offspring_per_family=6)


@pytest.mark.parametrize('variation',[
    {'shaft_asymmetry':.32,'shaft_jaggedness':.14},
    {'terrace_overhang':1.1,'terrace_offset':.22},
    {'crown_taper':.22,'crown_offset':.24,'parapet_fraction':.54},
    {'spire_segmentation':.9,'keep_taper':.13},
])
def test_new_construction_loci_still_obey_native_cad_and_void_gates(variation):
    project,recipe=breeding()
    genome={**recipe.initial,**variation}
    assembly=project.grow(recipe.cad_genome(genome))
    audit=assembly.audit(join=True)
    assert audit['valid'] and audit['union_valid'] and audit['union_solids']==1
    assert audit['voids']['valid']
    assert any(a is not None for a in assembly.parts.values())


def test_legacy_necrospire_seed_still_constructs_without_new_genes():
    legacy=Project.load(EXAMPLES/'project.json')
    report=legacy.grow().audit(join=True)
    assert report['valid'] and report['union_solids']==1
