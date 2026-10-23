"""Native checkpoint and interchange-mesh re-entry contracts."""
import json
from pathlib import Path
import numpy as np
import pytest
from PIL import Image

from projection_loom.evolution import Project, produce
from projection_loom.geometry import Mesh
from projection_loom.geometry_seed import IDENTITY
from projection_loom.render import silhouette

EXAMPLE = Path(__file__).resolve().parents[1] / 'examples'


def _project_with_geometry(tmp_path, mesh_path):
    spec = json.loads((EXAMPLE / 'project.json').read_text())
    spec.pop('builder')
    spec.pop('bounds')
    spec.pop('initial')
    spec['geometry'] = str(mesh_path)
    name = tmp_path / 'project.json'
    name.write_text(json.dumps(spec))
    return name


def test_native_mesh_reentry_preserves_identity_and_structure(tmp_path):
    original = Project.load(EXAMPLE / 'project.json').build({'width':1.13, 'height':.92, 'reach':1.07})
    source=original.save(tmp_path / 'prior-geometry.npz',
                         {'width':1.13,'height':.92,'reach':1.07})
    reloaded=Mesh.from_file(source)
    assert np.allclose(original.vertices,reloaded.vertices)
    assert reloaded.parts == original.parts
    project = Project.load(EXAMPLE / 'project.json').with_geometry_seed(source)
    assert project.geometry_source == str(source.resolve())
    replay = project.build(dict(IDENTITY))
    assert np.allclose(original.vertices,replay.vertices,rtol=1e-6,atol=1e-6)
    assert np.array_equal(replay.materials, original.materials)
    assert np.array_equal(replay.edges, original.edges)


def test_interchange_geometry_seed_and_bounded_evolution(tmp_path):
    source_project=Project.load(EXAMPLE / 'project.json')
    mesh=source_project.build({'width':1.07,'height':1.12,'reach':.96})
    source=mesh.export_obj(tmp_path / 'sculpture.obj')
    project_path=_project_with_geometry(tmp_path, source)
    project=Project.load(project_path)
    assert project.geometry_source == str(source.resolve())
    replay=project.build(dict(IDENTITY))
    assert len(replay.faces)>0 and len(replay.edges)>0
    target=tmp_path / 'reference.png'
    Image.fromarray(silhouette(mesh,source_project.cameras['reference'],(64,96)),'L').save(target)
    run=produce(project_path,tmp_path/'search', feedback=[f'reference={target}'],
                cycles=1,burst=2,survivors=2,offspring=1,
                resolution=(64,96),export_size=(128,192),rng_seed=26)
    assert run['geometry_mode']=='deformation'
    assert run['geometry_source']==str(source.resolve())
    assert run['final_loss']<=run['baseline_loss']+1e-8
    assert (tmp_path/'search'/'mesh.npz').exists()


def test_reexported_mesh_can_seed_next_generation(tmp_path):
    seed_project=Project.load(EXAMPLE/'project.json')
    held=seed_project.build(seed_project.initial)
    path=held.save(tmp_path/'base.npz', seed_project.initial)
    ref=tmp_path/'ref.png'
    Image.fromarray(silhouette(held,seed_project.cameras['reference'],(64,96)),'L').save(ref)
    first=produce(EXAMPLE/'project.json',tmp_path/'first',
                  feedback=[f'reference={ref}'],seed_geometry=path,cycles=1,
                  burst=2,survivors=2,offspring=1,resolution=(64,96),
                  export_size=(128,192),rng_seed=10)
    second=produce(EXAMPLE/'project.json',tmp_path/'second',
                   feedback=[f'reference={ref}'],
                   seed_geometry=tmp_path/'first'/'mesh.npz',cycles=1,
                   burst=2,survivors=2,offspring=1,resolution=(64,96),
                   export_size=(128,192),rng_seed=10)
    assert second['geometry_mode']=='deformation'
    assert second['geometry_source'].endswith('/first/mesh.npz')
    assert (tmp_path/'second'/'mesh.obj').is_file()


def test_seed_geometry_is_mutually_exclusive_with_parametric_seed(tmp_path):
    with pytest.raises(ValueError, match='parametric restart'):
        produce(EXAMPLE/'project.json',tmp_path/'x',seed=tmp_path/'params.json',
                seed_geometry=tmp_path/'shape.obj')


def test_geometry_format_validation(tmp_path):
    path=tmp_path/'shape.xyz'
    path.write_text('not-a-mesh')
    with pytest.raises(ValueError, match='Geometry format'):
        Mesh.from_file(path)
