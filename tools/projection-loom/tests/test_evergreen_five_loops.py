"""Five widening OODA-HA passes; guard evergreen contracts and native authority.

The tests start as RED contracts. No historic archive is opened for writing.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from projection_loom.campaign import visual_descriptor
from projection_loom.feature_evidence import FeatureEvidence
from projection_loom.genetic_transfer import (
    build_transfer_seed, bundle_transfers, verify_transfer_bundle,
)


def _seed(*, focus=("x",), donor=None):
    return build_transfer_seed(
        {"x": (0.0, 10.0)}, {"x": (-2.0, 2.0)},
        family="needle", donor_id="gen-3/needle",
        source_recipe_sha256="a" * 64, target_recipe_sha256="b" * 64,
        donor_genome=donor or {"x": 8.0},
        focus=focus, authorized=True,
    )


def test_pulse_tiny_mask_never_emits_nan_or_inf():
    for height in (1, 2, 5, 6):
        pixels=np.zeros((height, 7), dtype=bool)
        pixels[0, 3]=True
        trait=visual_descriptor(pixels)
        assert len(trait["region_coverage"])==6
        assert all(np.isfinite(v) for v in trait["region_coverage"])
        assert all(v>=0 for v in trait["region_coverage"])
        assert trait["region_coverage"][0]>0
    empty=visual_descriptor(np.zeros((1, 4),dtype=bool))
    assert empty["niche"]=="empty"
    assert empty["region_coverage"]==[0.0]*6


def test_pulse_rejects_malformed_transfer_identifiers_duplicate_or_nonfinite_loci():
    with pytest.raises(ValueError,match="focus|duplicate"):
        _seed(focus=("x", "x"))
    with pytest.raises(ValueError,match="locus|focus"):
        _seed(focus=("x", "unknown"))
    with pytest.raises(ValueError,match="finite|bounds"):
        _seed(donor={"x":float("nan")})
    with pytest.raises(ValueError,match="digest|sha"):
        build_transfer_seed({"x":(0,10)},{"x":(0,1)},family="needle",
            donor_id="donor",source_recipe_sha256="invalid",
            target_recipe_sha256="b"*64,donor_genome={"x":.5},
            focus=("x",),authorized=True)
    bundle=bundle_transfers([_seed()],target_recipe_sha256="b"*64)
    forged=json.loads(json.dumps(bundle))
    forged["seeds"][0]["loci"]["x"]=True
    forged.pop("sha256")
    from projection_loom.provenance_encoding import canonical_json_sha256
    forged["sha256"]=canonical_json_sha256(forged)
    with pytest.raises(ValueError,match="locus|finite|bounded"):
        verify_transfer_bundle(forged,target_recipe_sha256="b"*64,
            target_bounds={"x":(-2,2)},family_focus={"needle":("x",)})


def test_pulse_feature_manifest_refuses_symlink_escape_even_when_digest_matches(tmp_path):
    outside=tmp_path/"outside.png"
    Image.fromarray(np.full((12,16),255,dtype=np.uint8),"L").save(outside)
    folder=tmp_path/"evidence"
    folder.mkdir()
    (folder/"region.png").symlink_to(outside)
    manifest=folder/"feature.json"
    manifest.write_text(json.dumps({
        "schema":"projection-loom/feature-evidence/v1",
        "source_sha256":"a"*64,"evidence_state":"operator-annotated",
        "regions":{"Fortress":{"path":"region.png",
                 "sha256":hashlib.sha256(outside.read_bytes()).hexdigest()}}
    }))
    with pytest.raises(ValueError,match="outside|escape|symlink"):
        FeatureEvidence.load(manifest,source_sha256="a"*64,score_size=(16,12))


def test_beat_grammar_failed_program_is_atomic_on_existing_audited_assembly():
    from projection_loom.grammar import grow_program
    from projection_loom.solid import SolidAssembly
    body=SolidAssembly()
    body.add_box("root",(0,0,0),(4,4,4),parents=())
    assert body.audit(join=True)["valid"]
    cached=body._verified_audit
    valid={"key":"wing","op":"box","parents":["root"],
           "center":[1.6,0,0],"size":[2,1,1]}
    invalid={"key":"broken","op":"box","parents":["wing"],
             "center":[0,0,0],"size":[-2,1,1]}
    with pytest.raises(ValueError):
        grow_program([valid,invalid],{},assembly=body)
    assert list(body.parts)==["root"]
    assert body._verified_audit is cached
    assert body.voids is None
    assert grow_program([valid],{},assembly=body) is body
    assert list(body.parts)==["root","wing"]
    assert body._verified_audit is None
    assert body.audit(join=True)["valid"]


def test_beat_failed_grammar_void_does_not_pollute_existing_void_receipt():
    from projection_loom.grammar import grow_program
    from projection_loom.solid import SolidAssembly, box
    body=SolidAssembly()
    body.add_box("root",(0,0,0),(4,4,4),parents=())
    body.add_void("entry",box((0,-2,0),(1,3,2)),kind="doorway",exterior=True)
    assert body.audit(join=True)["valid"]
    retained=body.voids.voids.copy()
    proposed={"key":"alcove","op":"void-box","host":"root",
              "center":[0,0,0],"size":[.6,.6,.6],"kind":"recess"}
    with pytest.raises(ValueError, match="Unsupported"):
        grow_program([proposed,{"key":"wrong","op":"untrusted"}],
                     {},assembly=body)
    assert body.voids.voids==retained
    assert body.voids.positive is body


def test_measure_distinct_authorized_donors_enter_repeated_family_slots():
    from projection_loom.capability_stack import CapabilityRecipe
    from projection_loom.campaign import LineageArchive, make_brood
    example=Path(__file__).resolve().parents[1] / "examples/necrospire/hybrid"
    recipe=CapabilityRecipe.load(example/"recipe_breeding.json")
    source={"shaft_width":(0.0,10.0)}
    seeds=[build_transfer_seed(source,recipe.bounds,family="needle",
        donor_id=f"other-location/donor-{i}",source_recipe_sha256="a"*64,
        target_recipe_sha256=recipe.sha256,donor_genome={"shaft_width":v},
        focus=("shaft_width",),authorized=True) for i,v in enumerate((2.0,8.0))]
    class History:
        data={"members":{}}
        def component_parents(self,family,limit=3,*,before_generation=None):
            if family!="needle":
                return []
            return [{"id":"0001/needle-001-001","genome":dict(recipe.initial),
                     "component_genome":{"shaft_width":recipe.initial["shaft_width"]}}]
    a=make_brood(recipe.bounds,recipe.initial,History(),seed=41,
                 generation=2,offspring_per_family=6,transfer_seeds=seeds)
    adopted=[p for p in a if p.ancestry["family"]=="needle" and p.ancestry.get("transfer")]
    assert [p.ancestry["transfer"]["donor_id"] for p in adopted]==[
        "other-location/donor-0","other-location/donor-1"]
    assert [p.genome["shaft_width"] for p in adopted]==pytest.approx([2.92,3.58])
    assert all(p.ancestry["component_parent"].startswith("0001/") for p in adopted)
    assert all(p.parent.startswith("transfer:") for p in adopted)
    b=make_brood(recipe.bounds,recipe.initial,History(),seed=41,
                 generation=2,offspring_per_family=6,transfer_seeds=seeds)
    assert a==b


def test_measure_topology_emitter_crosses_new_discrete_grammar_switches(tmp_path):
    from projection_loom.capability_stack import CapabilityRecipe
    from projection_loom.campaign import LineageArchive, make_brood
    recipe=CapabilityRecipe.load(Path(__file__).resolve().parents[1]/
                        "examples/necrospire/hybrid/recipe_alpha.json")
    archive=LineageArchive(tmp_path/"lineages.json",identity={"recipe":recipe.sha256})
    rows=make_brood(recipe.bounds,recipe.initial,archive,seed=41,
                   generation=1,offspring_per_family=3)
    for family, switch in (("terraces","grammar.gallery"),("crown","grammar.buttress")):
        topology=next(p for p in rows if p.emitter==f"family:{family}:topology")
        assert topology.genome[switch]>=.5, (family,switch,topology.genome[switch])
