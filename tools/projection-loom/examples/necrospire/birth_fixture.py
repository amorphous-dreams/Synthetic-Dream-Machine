"""Author a fresh opt-in architectural birth project and capability recipe.

The original alpha project/recipe and single named source seed remain intact.
Artifacts live beside the original source so relative builder/image paths
continue to resolve. No archive or pet-name is imported or promoted.
"""
from __future__ import annotations

import json
from pathlib import Path

from projection_loom.birth_relations import LOCI
from projection_loom.capability_stack import CapabilityRecipe

HERE = Path(__file__).resolve().parent


def draft_birth_pair():
    original=json.loads((HERE/"project_alpha.json").read_text(encoding="utf8"))
    recipe=CapabilityRecipe.load(HERE/"hybrid/recipe_alpha.json")
    project=json.loads(json.dumps(original))
    for key,(bounds,initial) in LOCI.items():
        if key in project["bounds"] or key in recipe.bounds:
            raise ValueError("Birth locus collides with existing source project")
        project["bounds"][key]=list(bounds)
        project["initial"][key]=initial
    bounds={**recipe.bounds,**{k:v[0] for k,v in LOCI.items()}}
    initial={**recipe.initial,**{k:v[1] for k,v in LOCI.items()}}
    cad_keys=[*recipe.cad_keys,*LOCI]
    birth_recipe=CapabilityRecipe(
        location=recipe.location,pet_name=recipe.pet_name,steps=recipe.steps,
        bounds=bounds,initial=initial,cad_keys=cad_keys,
        source_hashes=recipe.source_hashes,provenance=recipe.provenance,
        seed_entity_sha256=recipe.seed_entity_sha256)
    if set(project["bounds"])!=set(birth_recipe.cad_keys):
        raise ValueError("Birth project and capability recipe CAD loci differ")
    return project,birth_recipe


def write_birth_pair():
    project_path=HERE/"project_birth.json"
    recipe_path=HERE/"hybrid/recipe_birth.json"
    if project_path.exists() or recipe_path.exists():
        raise ValueError("Birth project and recipe need two new output paths")
    project,recipe=draft_birth_pair()
    with project_path.open("x",encoding="utf8") as f:
        json.dump(project,f,indent=2,ensure_ascii=False)
        f.write("\n")
    with recipe_path.open("x",encoding="utf8") as f:
        json.dump(recipe.to_dict(),f,indent=2,ensure_ascii=False)
        f.write("\n")
    return project_path,recipe_path


if __name__ == "__main__":
    project_path,recipe_path=write_birth_pair()
    print("Bounded one-seed birth project:",project_path)
    print("Source-bound birth recipe:",recipe_path)
