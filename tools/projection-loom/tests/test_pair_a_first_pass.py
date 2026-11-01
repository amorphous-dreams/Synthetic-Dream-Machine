"""Current Pair A subject-neutral hard-reference-intake pilot contracts.

Do not confuse either locally authored synthetic control with a verified
photogrammetry mesh or the external CC0 Brutalist OpenSCAD archive.
"""
from pathlib import Path
import json, shutil
import numpy as np
import pytest
from projection_loom.pipeline import Project
from projection_loom.location_stack import LocationStack, Frame, Source
from projection_loom.surface_witness import sample_mesh, sampled_surface_distance

BASE=Path(__file__).resolve().parents[1]/'examples'


def test_ur_interpretive_stair_grammars_remain_cad_valid():
    project=Project.load(BASE/'ur/project.json')
    for present in (0.,1.):
        a=project.grow(dict(project.initial,summit_shrine=present))
        audit=a.audit(join=True)
        assert audit['valid'] and audit['union_solids']==1
        assert sum('#has/stair' in x.has for x in a.parts.values())==3
        assert ('Speculative moon shrine' in a.parts) == bool(present)


def test_ur_dims_are_hypotheses_and_source_disagreement_remains_visible():
    p=Project.load(BASE/'ur/project.json')
    data=json.loads((BASE/'ur/provenance.json').read_text())
    assert p.initial['base_length']==62.5 and p.initial['base_width']==43.
    assert 'hypotheses' in data and 'ur-modern-low-poly' in [s['id'] for s in data['sources']]
    assert any(s['status']=='conflicting-rounded-estimate' for s in data['sources'])
    assert all(s['status']!='ingested' for s in data['sources'] if s['id'].startswith('ur-modern-'))


def test_brutalist_proxy_has_a_traversable_exterior_join():
    project=Project.load(BASE/'brutalist/project.json')
    for d in (9.1,11.,12.5):
        a=project.grow(dict(project.initial,cantilever_offset=d))
        audit=a.audit(join=True)
        assert audit['valid'] and audit['voids']['valid']
        assert 'public entry' in audit['voids']['reachable']
        assert 'lobby' in audit['voids']['reachable']


def test_no_third_party_bytes_are_misattributed_to_local_proxy():
    data=json.loads((BASE/'brutalist/provenance.json').read_text())
    source=data['source_candidates'][0]
    assert source['license']=='CC0'
    assert source['status']=='linked-archive-not-ingested'
    assert 'NOT a copy' in (BASE/'brutalist/neutral_scad_probe.scad').read_text()


@pytest.mark.skipif(shutil.which('openscad') is None,reason='Optional OpenSCAD CLI unavailable')
def test_real_openscad_stl_compiles_and_enters_digest_checked_witness(tmp_path):
    import importlib.util
    module_path=BASE/'run_pair_a.py'
    spec=importlib.util.spec_from_file_location('pair_a_check',module_path)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    path=m.compile_trusted_fixture('brutalist')
    stack=LocationStack('brutalist-local-intake')
    stack.add_frame(Frame('native','local3d','model_unit'))
    stack.add_source(Source.from_file('observed-stl','cad_model',path,'native',observed_as='proposed'))
    observed=sample_mesh(stack,'observed-stl',count=80,seed=22)
    assert len(observed.as_array())==80
    assert np.isfinite(observed.as_array()).all()
    assert sampled_surface_distance(observed,observed)['sampled_bidirectional_rms']==0
    with pytest.raises(ValueError,match='Unregistered'):
        from dataclasses import replace
        other=replace(observed,frame_id='different')
        sampled_surface_distance(observed,other)
