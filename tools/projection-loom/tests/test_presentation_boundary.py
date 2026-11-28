"""RED-first witness: presentation stays separate from the OODA-HA helm.

The review renderers consume scored selection policies and regrow independently
audited structures. A preview never becomes new source evidence, and the
location's gallery still closes only inside the controller's Aftermath.
"""
import json
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

from projection_loom.review import render_cad_review, render_compound_review
from projection_loom.gallery import regrow_compound_gallery
from projection_loom.capability_stack import CapabilityCompositor, CapabilityRecipe
from projection_loom.pipeline import Project
from projection_loom.relations import RelationWitness


ROOT = Path(__file__).resolve().parents[1]


def scored_run(genome, *, state='synthetic'):
    return SimpleNamespace(score_state=state, data={
        'results': {
            'winner': {'state': 'scored', 'combined_loss': .123,
                       'niche': 'structural', 'emitter': 'sobol'},
            'invalid': {'state': 'rejected', 'reason': 'CAD gate',
                        'niche': 'unscored', 'emitter': 'local'}
        },
        'proposals': {
            'winner': {'genome': genome, 'emitter': 'sobol'},
            'invalid': {'genome': genome, 'emitter': 'local'}
        },
        'archive': {'structural': {'proposal_id': 'winner'}},
    })


def test_cad_review_receipts_remain_regrown_and_non_evidentiary(tmp_path):
    project = Project.load(ROOT / 'examples/grammar/project.json')
    folder = tmp_path / 'cad' / 'epoch_001'
    options = render_cad_review(project, scored_run(project.initial), 0, folder)
    assert [o['proposal_id'] for o in options] == ['winner']
    assert options[0]['archive_elite'] is True
    assert options[0]['evidence_state'] == 'synthetic'
    assert set(options[0]).issuperset({'loss', 'emitter', 'niche',
                                       'preview', 'witness', 'genome'})
    assert json.loads((folder / 'review.json').read_text())['options'] == options
    assert 'not source evidence' in json.loads((folder / 'review.json').read_text())['authority']
    assert json.loads(Path(options[0]['genome']).read_text())['genome'] == project.initial
    assert RelationWitness.load(options[0]['witness']).nodes
    assert Image.open(options[0]['preview']).mode == 'RGBA'


def test_compound_review_preserves_recipe_and_scoped_validation(tmp_path):
    project = Project.load(ROOT / 'examples/necrospire/project.json')
    recipe = CapabilityRecipe.load(ROOT / 'examples/necrospire/hybrid/recipe.json')
    compositor = CapabilityCompositor(
        project, recipe, size=(64, 96), source_mask=project.source_mask((64, 96)))
    folder = tmp_path / 'compound' / 'epoch_001'
    options = render_compound_review(
        compositor, scored_run(recipe.initial, state='provisional'), 0, folder)
    assert [o['proposal_id'] for o in options] == ['winner']
    assert options[0]['recipe_sha256'] == recipe.sha256
    assert options[0]['evidence_state'] == 'provisional'
    assert 'provisional' in json.loads((folder / 'review.json').read_text())['authority']
    genome = json.loads(Path(options[0]['genome']).read_text())
    assert genome['recipe_sha256'] == recipe.sha256
    assert '@entity/Crystal' in RelationWitness.load(options[0]['witness']).nodes
    assert Image.open(options[0]['preview']).mode == 'RGBA'


def test_gallery_stands_as_renderer_not_second_controller():
    assert callable(regrow_compound_gallery)
    assert regrow_compound_gallery.__module__ == 'projection_loom.gallery'
