"""Author a separate full-resolution Experiment Zero primary-massing recipe."""
from __future__ import annotations
import json
from pathlib import Path
from birth_fixture import draft_birth_pair
from projection_loom.capability_stack import CapabilityRecipe
from projection_loom.massing_relations import LOCI

HERE=Path(__file__).resolve().parent

def draft_massing_pair():
    project, parent=draft_birth_pair()
    for key,(bounds,initial) in LOCI.items():
        if key in parent.bounds or key in project["bounds"]:
            raise ValueError("Massing locus collides with parent recipe")
        project["bounds"][key]=list(bounds)
        project["initial"][key]=initial
    recipe=CapabilityRecipe(
        location=parent.location,pet_name=parent.pet_name,steps=parent.steps,
        bounds={**parent.bounds,**{k:x[0] for k,x in LOCI.items()}},
        initial={**parent.initial,**{k:x[1] for k,x in LOCI.items()}},
        cad_keys=[*parent.cad_keys,*LOCI],
        source_hashes=parent.source_hashes,provenance=parent.provenance,
        seed_entity_sha256=parent.seed_entity_sha256)
    if set(project["bounds"])!=set(recipe.cad_keys):
        raise ValueError("Every CAD gene must belong to the source-bound recipe")
    return project,recipe

def write_massing_pair():
    a=HERE/"project_massing.json"
    b=HERE/"hybrid/recipe_massing.json"
    if a.exists() or b.exists():
        raise ValueError("Experiment outputs must be new, not overwritten")
    project,recipe=draft_massing_pair()
    with a.open("x",encoding="utf8") as f:json.dump(project,f,indent=2);f.write("\n")
    with b.open("x",encoding="utf8") as f:json.dump(recipe.to_dict(),f,indent=2);f.write("\n")
    return str(a),str(b)

if __name__=="__main__":print(*write_massing_pair())
