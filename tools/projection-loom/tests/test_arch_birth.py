"""Architectural Birth: inherited intent, actual admitted geometry, distinct evidence."""
from pathlib import Path
import math
import pytest

from projection_loom.birth_relations import LOCI, describe_birth, observe_birth, birth_traits
from projection_loom.pipeline import Project
from projection_loom.campaign import FAMILY_FOCUSES, make_brood
from projection_loom.capability_stack import CapabilityCompositor


HERE=Path(__file__).resolve().parents[1]/"examples/necrospire"


def _fixture():
    import sys
    sys.path.insert(0,str(HERE))
    try:
        from birth_fixture import draft_birth_pair
        return draft_birth_pair()
    finally:
        sys.path.remove(str(HERE))


def test_birth_recipe_preserves_one_original_image_seed_and_adds_owned_loci():
    conf,recipe=_fixture()
    project=Project.load(HERE/"project_alpha.json")
    assert recipe.seed_entity_sha256==project.seed_entity.sha256
    assert recipe.source_hashes["image"] and len(recipe.source_hashes["image"])==64
    assert set(conf["bounds"])==set(recipe.cad_keys)
    assert set(LOCI).issubset(FAMILY_FOCUSES["terraces"])
    assert all(recipe.initial[k]==initial for k,(_,initial) in LOCI.items())
    recipe.verify_genome(recipe.initial)


@pytest.mark.parametrize("cell,relation",[(.2,"bears"),(1.5,"bridges"),(2.8,"skirts")])
def test_bounded_relation_cells_are_deterministic_and_proposal_only(cell,relation):
    p={k:value for k,(_,value) in LOCI.items()}
    p["arch.birth.enable"]=1.0
    p["arch.birth.mode"]=cell
    a=describe_birth(p)
    b=describe_birth(dict(reversed(list(p.items()))))
    assert a==b and a["relation"]==relation
    assert a["state"]=="proposed"
    with pytest.raises(ValueError,match="unbounded"):
        describe_birth({**p,"arch.birth.width":math.inf})
    with pytest.raises(ValueError,match="every declared"):
        describe_birth({"arch.birth.mode":1.0})


def test_birth_source_seed_is_unchanged_and_native_bearing_is_observed():
    project=Project.load(HERE/"project_alpha.json")
    source=project.grow()
    baseline=source.audit(join=True)
    p={**project.initial,**{k:v for k,(_,v) in LOCI.items()},
       "arch.birth.enable":1.0}
    born=project.builder(p)
    audit=born.audit(join=True)
    assert audit["valid"] and audit["union_solids"]==1
    assert len(born.parts)==len(source.parts)+1
    assert source.audit(join=True)==baseline
    observation=observe_birth(born,p)
    assert observation["proposal"]["relation"]=="bears"
    assert len(observation["generated_parts"])==1
    assert "architecture:relation:bears" in birth_traits(born,p)
    assert observation["truth_scope"].startswith("AABB")


def test_offspring_inherit_birth_loci_through_existing_family_scheduler():
    conf,recipe=_fixture()
    class Empty:
        data={"members":{},"generations":{}}
        @staticmethod
        def component_parents(*a,**k):return []
    proposals=make_brood(recipe.bounds,recipe.initial,Empty(),
             seed=41,generation=1,offspring_per_family=3)
    assert len(proposals)==18
    terrace=[p for p in proposals if p.emitter.startswith("family:terraces:")]
    assert len(terrace)==3
    assert all(set(p.genome)==set(recipe.bounds) for p in terrace)
    assert all(p.ancestry.get("architectural_birth") for p in terrace)
    assert any(describe_birth(p.genome)["state"]=="proposed" for p in terrace)
    assert all(p.ancestry["architectural_birth"]==describe_birth(p.genome)
               for p in proposals)
    assert terrace[-1].ancestry["mode"]=="topology"
    assert terrace[-1].genome["arch.birth.enable"]>=.5


def test_unproposed_birth_recipe_keeps_source_geometry_unchanged():
    project=Project.load(HERE/"project_alpha.json")
    p={**project.initial,**{k:v for k,(_,v) in LOCI.items()}}
    source=project.grow()
    born=project.builder(p)
    assert len(source.parts)==len(born.parts)
    assert source.audit(join=True)["union_volume"]==born.audit(join=True)["union_volume"]


def test_compound_native_refusal_is_rejected_not_an_engine_error(tmp_path):
    from projection_loom.epochs import NativeConstructionRejected, WideEpoch, Proposal
    native={"valid":False,"union_valid":False,"union_solids":2,
            "reason":"disconnected source-bound construction"}
    epoch=WideEpoch(location="test-place",source_digests={"seed":"b"*64},
                    construction_digest="source-builder",objectives=("silhouette",),
                    score_state="provisional",checkpoint=tmp_path/"epoch.json",
                    max_exact=1,max_detail=1,seed=13)
    proposal=Proposal("candidate-1","family:terraces:topology",{"x":.3})
    def rejected(_):
        raise NativeConstructionRejected(native)
    result=epoch.run([proposal],grow=rejected,
                     score=lambda g,a:{"silhouette":0.})
    assert result["results"]["candidate-1"]["state"]=="rejected"
    assert result["results"]["candidate-1"]["audit"]==native
    assert result["results"]["candidate-1"]["reason"]=="CAD or void gate"
