"""RED-first: fair detail seats, one OODA-HA helm, durable breeding Aftermath."""
import json
from pathlib import Path

import pytest

from projection_loom.epochs import Proposal
from projection_loom.selection import allocate_detail_seats
from projection_loom.campaign import FAMILY_FOCUSES, LineageArchive, make_brood
from projection_loom.fractal_ooda_ha import run_ooda_epochs, OODAJournal
from projection_loom.pipeline import Project
from projection_loom.capability_stack import CapabilityRecipe

EXAMPLES = Path(__file__).resolve().parents[1] / 'examples/necrospire'


def family_candidates():
    rows = []
    for family in FAMILY_FOCUSES:
        for method in ('local','sobol','topology'):
            rows.append(Proposal(f'{family}-{method}', f'family:{family}:{method}',
                                 {'x': .0 if method=='local' else .95}))
    return rows


def test_detail_budget_reserves_each_family_and_rotates_exploratory_methods():
    names = list(FAMILY_FOCUSES)
    chosen = []
    for generation in range(3):
        sample = allocate_detail_seats(family_candidates(), max_detail=12,
                                       emitter_turn=generation,
                                       preview=lambda genome: genome['x'])
        assert len(sample) == 12
        assert {x.emitter.split(':')[1] for x in sample} == set(names)
        assert all(sum(x.emitter.split(':')[1] == family for x in sample) == 2
                   for family in names)
        chosen.extend(x for x in sample if x.emitter.endswith(':sobol'))
    assert len(chosen) > 0  # not crowded out by high preview distances
    assert {x.emitter.split(':')[1] for x in chosen} == set(names)
    limited = allocate_detail_seats(family_candidates(),max_detail=3,emitter_turn=0)
    shifted = allocate_detail_seats(family_candidates(),max_detail=3,emitter_turn=3)
    assert {x.emitter.split(':')[1] for x in limited} != {
        x.emitter.split(':')[1] for x in shifted}


def test_campaign_rejects_incompatible_source_or_budget(tmp_path):
    project=Project.load(EXAMPLES/'project.json')
    recipe=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe.json')
    with pytest.raises(ValueError, match='breeding|loci|recipe'):
        run_ooda_epochs(project,tmp_path/'bad',recipe=recipe,breeding=True,
                        passes=1,offspring_per_family=3,exact_budget=12,
                        detail_budget=6,score_size=(64,96))


@pytest.mark.slow

def test_single_helm_breeding_reentry_and_scoped_gallery(tmp_path):
    project=Project.load(EXAMPLES/'project_breeding.json')
    recipe=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe_breeding.json')
    output=tmp_path/'brood'
    opts=dict(passes=1, breeding=True, offspring_per_family=1,
              exact_budget=6, detail_budget=6, seed=41, score_size=(64,96),
              finalists=3,autonomy=1.,max_loops=700)
    result=run_ooda_epochs(project,output,recipe=recipe,**opts)
    assert result['status']=='completed'
    archive=LineageArchive(output/'lineage_archive.json', identity={
        k:result['archive_identity'][k] for k in result['archive_identity']})
    assert archive.generation_count==1
    assert result['archive_generation_count']==1
    assert len(archive.data['members'])>=1
    assert (output/'finalists'/'gallery.json').is_file()
    assert (output/'lineage_gallery'/'gallery.json').is_file()
    journal=OODAJournal(output/'session.json')
    assert journal.data['loops']['location']['phase']=='closed'
    assert journal.data['loops']['location/final-gallery']['phase']=='closed'
    assert all(x['evidence_state']=='provisional' for x in archive.elites())
    original=(output/'lineage_archive.json').read_bytes()
    resumed=run_ooda_epochs(project,output,recipe=recipe,**opts)
    assert resumed['status']=='completed'
    assert original==(output/'lineage_archive.json').read_bytes()
    assert resumed['run_id']==result['run_id']
