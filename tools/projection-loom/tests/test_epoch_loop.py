"""Verify full-epoch feedback, provenance, restarts, and geometric re-entry."""
import json
from pathlib import Path
import numpy as np
from projection_loom.cli import main
from projection_loom.epoch_loop import epoch_loop, compare_controls
from projection_loom.geometry import Mesh

EXAMPLE=Path(__file__).resolve().parents[1]/'examples'/'project.json'


def small_run(tmp_path, *, passes=2, resume=False):
    return epoch_loop(EXAMPLE, tmp_path/'epoch05', passes=passes,
        burst=4, survivors=2, offspring=1, cycles_per_epoch=1,
        rng_seed=20261022, resolution=(48,72), export_size=(96,144),
        min_feedback_similarity=.15, resume=resume)


def test_five_pass_full_feedback(tmp_path):
    result=small_run(tmp_path,passes=5)
    assert len(result['epochs'])==5
    assert (tmp_path/'epoch05'/'manifest.json').exists()
    anchor=result['anchor_mesh']
    for i, entry in enumerate(result['epochs']):
        epoch_dir=tmp_path/'epoch05'/entry['directory']
        feedback=json.loads((epoch_dir/'feedback.json').read_text())
        assert Path(entry['candidate_mesh']).is_file()
        assert set(feedback['input_controls'])=={'reference','front','side','rear','top'}
        for view in feedback['input_controls']:
            assert len(feedback['input_controls'][view])==4
            assert set(feedback['structural_lighting_feedback']['per_view'][view]) == {
                'silhouette_iou','structure_iou','lit_luma_similarity','lit_structure_luma_similarity'}
        if i==0:
            assert feedback['geometry_input']==anchor
        else:
            assert feedback['geometry_input']==result['epochs'][i-1]['accepted_mesh']
        assert feedback['quality_gate']['accepted']==entry['accepted']
    assert Path(result['epochs'][-1]['accepted_mesh']).is_file()


def test_resume_extends_run(tmp_path):
    prior=small_run(tmp_path,passes=1)
    first=prior['epochs'][0]['candidate_sha256']
    resumed=small_run(tmp_path,passes=2,resume=True)
    assert len(resumed['epochs'])==2
    assert resumed['epochs'][0]['candidate_sha256']==first
    same=small_run(tmp_path,passes=2,resume=True)
    assert len(same['epochs'])==2


def test_loop_resumes_existing_mesh(tmp_path):
    from projection_loom.evolution import Project
    project=Project.load(EXAMPLE)
    model=project.build(project.initial)
    path=model.save(tmp_path/'input_geometry.npz', project.initial)
    state=epoch_loop(EXAMPLE,tmp_path/'from_geometry',seed_geometry=path,
        passes=1,burst=4,survivors=2,offspring=1,
        resolution=(48,72),export_size=(96,144),min_feedback_similarity=.1)
    entry=state['epochs'][0]
    assert entry['accepted_mesh']
    manifest=json.loads((tmp_path/'from_geometry'/'epoch_01'/'candidate'/'manifest.json').read_text())
    assert manifest['geometry_mode']=='deformation'
    m=Mesh.from_file(entry['candidate_mesh'])
    assert len(m.vertices)==len(model.vertices)


def test_cli_epoch_loop(tmp_path):
    res=main(['epoch-loop','--project',str(EXAMPLE),'--out',str(tmp_path/'cli'),
              '--passes','1','--burst','4','--survivors','2','--offspring','1',
              '--fitness-size','48','72','--export-size','96','144'])
    assert len(res['epochs'])==1


def test_invalid_resume_settings(tmp_path):
    import pytest
    small_run(tmp_path,passes=1)
    with pytest.raises(ValueError, match='Resume configuration'):
        epoch_loop(EXAMPLE,tmp_path/'epoch05',passes=2,burst=8,survivors=2,offspring=1,
                   rng_seed=20261022,resolution=(48,72),export_size=(96,144),
                   min_feedback_similarity=.15,resume=True)


def test_parametric_handoff_keeps_builder(tmp_path):
    state=epoch_loop(EXAMPLE,tmp_path/'parametric',handoff='parametric',passes=2,
        burst=4,survivors=2,offspring=1,resolution=(48,72),export_size=(96,144),
        min_feedback_similarity=.15)
    assert len(state['epochs']) == 2
    second=json.loads((tmp_path/'parametric'/'epoch_02'/'candidate'/'manifest.json').read_text())
    assert second['geometry_mode']=='parametric'
    assert second['geometry_source'] is None


def test_empty_targets_require_anchoring(tmp_path):
    import pytest
    with pytest.raises(ValueError, match='no fixed targets'):
        epoch_loop(EXAMPLE,tmp_path/'no_anchor',passes=1,burst=4,
            survivors=2,offspring=1,resolution=(48,72),export_size=(96,144),
            auto_anchor=False)
