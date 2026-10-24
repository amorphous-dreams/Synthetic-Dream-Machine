"""Current invariants for the production CAD, evidence, and void pipeline."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
import pytest

from projection_loom.cameras import Camera
from projection_loom.calibration import freeze_display_camera
from projection_loom.geometry import Mesh
from projection_loom.render import silhouette
from projection_loom.solid import SolidAssembly, box
from projection_loom.pipeline import Project
from projection_loom.evolution import Evolution

ROOT = Path(__file__).resolve().parents[1]
SIZE = (128, 128)


def tunnel_assembly():
    a = SolidAssembly()
    a.add('monolith', box((0, 0, 0), (4, 4, 4)), role='foundation')
    a.add_void('throughway', box((0, 0, 0), (1.2, 6, 2)), kind='doorway', exterior=True)
    return a


def test_verified_fused_material_and_views_show_identical_tunnel(tmp_path):
    a = tunnel_assembly()
    report = a.audit(join=True)
    assert report['valid'] and report['voids']['valid']
    assert report['voids']['material_solids'] == 1
    fixed = Camera(fit='fixed', pixel_scale=23, reference_size=SIZE,
                   pixel_center=(64, 64))
    uncut = a.tessellate(union=False)
    carved = a.tessellate(union=True)
    uncut_mask = silhouette(uncut, fixed, SIZE)
    carved_mask = silhouette(carved, fixed, SIZE)
    assert uncut_mask[64, 64] == 255
    assert carved_mask[64, 64] == 0
    assert carved_mask[64, 90] == 255

    p = Project(file=tmp_path/'test.json', builder_file=tmp_path/'none.py',
                builder=lambda genome: a, cameras={'front': fixed}, initial={}, bounds={},
                reference=None, reference_view='front', light_angles=(-70, 35),
                render_style={'linework_mode': 'semantic', 'supersample': 1,
                              'work_width': 96})
    result = p.export(a, tmp_path/'export', {}, size=SIZE)
    exported = np.asarray(Image.open(result['controls']['front']['silhouette']))
    assert exported[64, 64] == 0
    assert exported[64, 90] == 255
    assert (tmp_path/'export/solid.step').stat().st_size > 1000
    transport = np.load(tmp_path/'export/render_mesh.npz')
    mesh = Mesh(transport['vertices'], transport['faces'],
                transport['materials'], transport['edges'])
    assert silhouette(mesh, fixed, SIZE)[64, 64] == 0


def test_material_cache_is_invalidated_by_authored_void():
    a = SolidAssembly().add('mass', box((0,0,0),(4,4,4)), role='foundation')
    before = a.material_solid().Volume()
    a.add_void('shaft', box((0,0,0),(1,1,5)), kind='shaft', exterior=True)
    after = a.material_solid().Volume()
    assert after < before
    assert a.material_solid().Volume() == after


def test_external_reference_rejects_candidate_fitting_camera(tmp_path):
    (tmp_path/'grow.py').write_text('def grow(params):\n    return None\n')
    Image.fromarray(np.zeros((32,32),dtype=np.uint8)).save(tmp_path/'reference.png')
    cfg = {'schema': 'projection-loom/solid-project/v2',
           'builder':'grow.py:grow',
           'cameras':{'oblique':{'fit':'bounds','azimuth':30}},
           'initial':{'width':1.0}, 'bounds':{'width':[.8,1.2]},
           'reference':'reference.png', 'reference_view':'oblique'}
    file = tmp_path/'project.json'
    file.write_text(json.dumps(cfg))
    with pytest.raises(ValueError, match='must be fixed'):
        Project.load(file)
    cfg['cameras']['oblique'] = Camera(fit='fixed', pixel_scale=12,
        pixel_center=(16,16), reference_size=(32,32)).to_dict()
    file.write_text(json.dumps(cfg))
    assert Project.load(file).cameras['oblique'].fit == 'fixed'


def test_unrefenced_evolution_freezes_source_camera_independently():
    p = Project.load(ROOT/'examples/observatory.json')
    e = Evolution(p, size=(128, 128), seed=4)
    assert p.cameras['oblique'].fit == 'bounds'
    assert e.reference_camera.fit == 'fixed'
    base = p.grow().tessellate(union=True)
    scaled = Mesh(base.vertices*1.3, base.faces, base.materials,
                  base.edges, base.parts)
    auto_original = silhouette(base, p.cameras['oblique'], (128,128))
    auto_scaled = silhouette(scaled, p.cameras['oblique'], (128,128))
    fixed_original = silhouette(base, e.reference_camera, (128,128))
    fixed_scaled = silhouette(scaled, e.reference_camera, (128,128))
    assert np.array_equal(auto_original, auto_scaled)
    assert not np.array_equal(fixed_original, fixed_scaled)


def test_full_union_gate_runs_for_void_free_evolution(monkeypatch):
    p = Project.load(ROOT/'examples/observatory.json')
    e = Evolution(p, size=(64,96), seed=5)
    class RefusingAssembly:
        voids = None
        def audit(self, *, join):
            assert join is True, 'A joint-only audit may not admit a candidate'
            return {'valid': False, 'failed': ['nonfusible union']}
    monkeypatch.setattr(p, 'grow', lambda genome: RefusingAssembly())
    score = e.evaluate(e.as_vector(p.initial))
    assert score >= 2
    assert not e.records[-1]['valid']


def test_current_project_exports_no_unvalidated_partial_solid(tmp_path):
    p = Project.load(ROOT/'examples/observatory.json')
    a = p.grow()
    result = p.export(a, tmp_path, p.initial, size=(64,96))
    assert result['contacts']['valid']
    assert result['contacts']['union_solids'] == 1
    assert result['geometry'] == 'solid.step'
    assert len(result['controls']) == len(p.cameras)
