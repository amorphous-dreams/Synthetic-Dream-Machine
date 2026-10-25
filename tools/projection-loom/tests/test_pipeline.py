from pathlib import Path
import json
import numpy as np
from PIL import Image
from projection_loom.pipeline import Project
from projection_loom.evolution import Evolution
from projection_loom.render import render_controls

PROJECT=Path(__file__).parents[1]/'examples'/'observatory.json'


def test_true_orthographic_projection():
    p=Project.load(PROJECT)
    mesh=p.grow().tessellate()
    fronts=render_controls(mesh,p.cameras['front'],size=(128,192),style={'linework_mode':'semantic','supersample':1,'work_width':128})
    sides=render_controls(mesh,p.cameras['side'],size=(128,192),style={'linework_mode':'semantic','supersample':1,'work_width':128})
    assert fronts['silhouette'].size==(128,192)
    assert np.array(fronts['silhouette']).sum()>100
    assert not np.array_equal(np.array(fronts['silhouette']),np.array(sides['silhouette']))


def test_lineage_generation_preserves_solid_and_void_gates():
    p=Project.load(PROJECT)
    evo=Evolution(p,size=(64,96),seed=22)
    winners=evo.evolve(burst=4,survivors=2,offspring=1,rounds=1,lit_rounds=0)
    assert len(winners)>0 and evo.eval_count>=3
    for winner in winners:
        assert p.grow(winner['genome']).audit(join=True)['valid']


def test_genome_file_holds_no_triangle_mesh(tmp_path):
    p=Project.load(PROJECT)
    a=p.grow()
    summary=p.export(a,tmp_path,p.initial,size=(64,96))
    stored=json.loads((tmp_path/'genome.json').read_text())
    assert stored['schema']=='projection-loom/genome'
    assert 'vertices' not in stored and 'faces' not in stored
    assert summary['contacts']['valid']
    assert (tmp_path/'solid.step').stat().st_size>1000
    assert (tmp_path/'fused.obj').stat().st_size>1000
    assert len(list((tmp_path/'controls').glob('*.png')))==4*len(p.cameras)
