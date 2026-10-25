"""One pet-named source entity, two corroborating channels, many bounded consumers."""
from pathlib import Path
import json
import numpy as np
import pytest

from projection_loom.pipeline import Project
from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor
from projection_loom.relations import PetNameLedger
from projection_loom.seed_entity import SeedEntity

ROOT=Path(__file__).resolve().parents[1]/"examples/necrospire"


def test_oblique_seed_is_one_named_entity_with_two_verified_channels():
    project=Project.load(ROOT/"project_alpha.json")
    seed=project.seed_entity
    assert seed.pet_name=="Necrospire's First Glimpse"
    assert seed.slot=="oblique-seed"
    assert seed.location==project.location
    assert set(seed.source_digests())=={"seed:entity","seed:appearance","seed:silhouette"}
    assert seed.rgba.shape==(1536,1024,4)
    assert seed.alpha.shape==(1536,1024)
    assert np.array_equal(seed.rgba[:,:,3],seed.alpha)
    assert np.array_equal(project.source_mask((64,96)),seed.mask((64,96)))
    observation=seed.cue((64,96))
    assert 0<observation["silhouette_pixels"]<6144
    assert observation["appearance_edge_pixels"]>0
    assert observation["authority"].endswith("one provisional artwork")


def test_seed_rejects_divergent_sources_and_escaped_paths(tmp_path):
    source=ROOT/"seed_oblique.json"
    data=json.loads(source.read_text())
    files={}
    for channel, record in data["witnesses"].items():
        path=ROOT/record["path"]
        (tmp_path/path.name).write_bytes(path.read_bytes())
        files[channel]=tmp_path/path.name
    staged=tmp_path/"seed.json"
    staged.write_text(json.dumps(data))
    assert SeedEntity.load(staged).sha256
    data["witnesses"]["silhouette"]["path"]="../outside.png"
    staged.write_text(json.dumps(data))
    with pytest.raises(ValueError,match="paths"):
        SeedEntity.load(staged)
    data=json.loads(source.read_text())
    alpha=bytearray(files["silhouette"].read_bytes())
    alpha[-1]^=1
    files["silhouette"].write_bytes(alpha)
    staged.write_text(json.dumps(data))
    with pytest.raises(ValueError,match="digest"):
        SeedEntity.load(staged)


def test_seed_is_a_pet_named_relational_ancestor_not_a_second_location():
    project=Project.load(ROOT/"project_alpha.json")
    recipe=CapabilityRecipe.load(ROOT/"hybrid/recipe_alpha.json")
    assert recipe.seed_entity_sha256==project.seed_entity.sha256
    assert recipe.source_hashes["seed:entity"]==project.seed_entity.sha256
    assert recipe.steps[0].operator=="seed-cue"
    source_steps=[x for x in recipe.steps if x.operator=="cad-polymesh"]
    assert source_steps and all("seed.oblique" in x.depends_on for x in source_steps)
    compositor=CapabilityCompositor(project,recipe,size=(64,96),
        source_mask=project.source_mask((64,96)))
    built=compositor.grow(recipe.initial)
    assert built.steps[0]["output"]["seed_entity_sha256"]==project.seed_entity.sha256
    witness=built.witness()
    handle="@seed/"+project.seed_entity.slot
    assert witness.nodes[handle].slot==project.seed_entity.slot
    named=PetNameLedger(location=project.location)
    named.pet_name(project.seed_entity.pet_name,handle,witness,
                   has=project.seed_entity.witness_has())
    assert named.resolve(built.witness())[0]["status"]=="matched"
    assert named.soft_loss(witness)==0.
    lineage=built.recipe.lineage(built.genome,compositor.registry)
    assert lineage["seed_entity_sha256"]==project.seed_entity.sha256


def test_seed_cue_never_grants_cad_or_survey_authority():
    project=Project.load(ROOT/"project_alpha.json")
    recipe=CapabilityRecipe.load(ROOT/"hybrid/recipe_alpha.json")
    builder=CapabilityCompositor(project,recipe,size=(64,96),
                               source_mask=project.source_mask((64,96)))
    result=builder.grow(recipe.initial)
    receipt=result.steps[0]["output"]
    assert receipt["authority"].endswith("one provisional pet-named source entity")
    assert not result.audit["composite_cad_union_verified"]
    assert result.manifest(builder.registry)["source_seed"]["pet_name"]==project.seed_entity.pet_name
    # A second recipe may not secretly claim a different content-addressed seed.
    mutated=recipe.to_dict()
    mutated.pop("sha256")
    mutated["seed_entity_sha256"]="0"*64
    other=CapabilityRecipe(**mutated)
    with pytest.raises(ValueError,match="seed identity"):
        CapabilityCompositor(project,other,size=(64,96))
