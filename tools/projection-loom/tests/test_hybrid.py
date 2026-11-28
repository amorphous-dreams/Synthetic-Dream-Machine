"""Hybrid scene tests never confer BRep validity on an independent polygon layer."""
import importlib.util
import json
from pathlib import Path
import numpy as np
import pytest
import trimesh

from projection_loom.hybrid import HybridLocation, faceted_crystal_mesh
from projection_loom.solid import SolidAssembly, box
from projection_loom.cameras import Camera
from projection_loom.render import silhouette

ROOT = Path(__file__).resolve().parents[1]


def minimal():
    a=SolidAssembly().add('block',box((0,0,0),(4,4,4)),role='foundation')
    return HybridLocation('a-name-in-the-void',a,pet_name='Box with Other Things')


def test_hybrid_validates_cad_and_polygon_separately(tmp_path):
    m=faceted_crystal_mesh([(-6,0,0,.5,.6),(-3,0,0,1.7,1.5),(2,0,0,2,2)],sides=8)
    assert m.is_volume and m.is_watertight and len(m.faces)>0
    scene=minimal().add_mesh('~unnamed-facet',m,genotype={'faces':len(m.faces)})
    scene.attach('joint','~unnamed-facet','block',16,(2,0,2),tolerance=.1)
    report=scene.audit()
    assert report['cad_valid']
    assert report['composite_valid_for_render']
    assert not report['composite_cad_union_verified']
    assert report['attachments'][0]['cad_point_to_brep']==0
    out=scene.export(tmp_path,{'front':Camera(azimuth=0,elevation=0,fit='bounds')},size=(72,96))
    assert out['mesh_layers']['~unnamed-facet']['source']=='procedural'
    assert (tmp_path/'cad_body.step').stat().st_size>1000
    assert (tmp_path/'~unnamed-facet.obj').is_file()
    assert (tmp_path/'composite_render.obj').is_file()
    assert (tmp_path/'controls/front_silhouette.png').is_file()
    assert out['epistemic_boundary'].startswith('Composite render')


def test_mesh_anchor_fails_with_wrong_spatial_relation():
    scene=minimal()
    mesh=trimesh.creation.box(extents=(1,1,1));mesh.apply_translation([11,0,0])
    scene.add_mesh('faraway',mesh)
    scene.attach('unjoined','faraway','block',0,(0,0,0),tolerance=.01)
    report=scene.audit()
    assert report['cad_valid']
    assert not report['composite_valid_for_render']
    assert report['attachments'][0]['mesh_to_cad_anchor']>10
    with pytest.raises(ValueError,match='rejected'):
        scene.render_mesh()


def test_mesh_that_does_not_close_remains_surface_only():
    open_face=trimesh.Trimesh(vertices=[[0,0,0],[1,0,0],[0,1,0]],faces=[[0,1,2]],process=False)
    closed_required=minimal().add_mesh('open',open_face)
    assert not closed_required.audit()['composite_valid_for_render']
    permitted=minimal().add_mesh('open',open_face,requires_volume=False)
    report=permitted.audit()
    assert report['composite_valid_for_render']
    assert report['layers'][0]['watertight'] is False
    assert report['layers'][0]['scope']=='polygon-surface-only'


def test_external_mesh_requires_source_digest():
    m=trimesh.creation.icosphere()
    with pytest.raises(ValueError,match='SHA-256'):
        minimal().add_mesh('external',m,source='external')
    assert minimal().add_mesh('external',m,source='external',source_sha256='a'*64).audit()['layers'][0]['valid']


def test_nonuniform_deformation_invalidates_anchor():
    m=trimesh.creation.box(extents=[4,4,4])
    scene=minimal().add_mesh('mesh',m)
    scene.attach('matching','mesh','block',0,tuple(m.vertices[0]),tolerance=.01)
    assert scene.audit()['composite_valid_for_render']
    m2=m.copy();m2.apply_translation([.5,0,0])
    altered=minimal().add_mesh('mesh',m2)
    altered.attach('mismatch','mesh','block',0,tuple(m.vertices[0]),tolerance=.01)
    assert not altered.audit()['composite_valid_for_render']


def test_necrospire_crystal_facets_and_cad_fortress_share_anchor(tmp_path):
    script=ROOT/'examples/necrospire/hybrid/hybrid_demo.py'
    spec=importlib.util.spec_from_file_location('crystal_demo',script)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    project,scene=module.grow_hybrid(perturb=.17)
    report=scene.audit()
    assert report['cad_valid'] and report['composite_valid_for_render']
    assert report['cad']['parts']==7 and report['cad']['voids']['valid']
    assert scene.pet_name.startswith('Necrospire')
    assert report['layers'][0]['positive_volume']
    assert report['attachments'][0]['mesh_to_cad_anchor']<1e-5
    cad=scene.assembly.tessellate(union=True)
    combined=scene.render_mesh()
    assert len(combined.faces)>len(cad.faces)
    assert len(combined.parts)>len(cad.parts)
    assert np.isfinite(combined.vertices).all()
    # Same CAD body remains the structural witness when the crystal changes.
    _,other=module.grow_hybrid(perturb=.04)
    assert other.audit()['cad']['union_volume']==pytest.approx(report['cad']['union_volume'])
    assert not np.array_equal(other.layers['~polymesh-obsidian']['mesh'].vertices,
                              scene.layers['~polymesh-obsidian']['mesh'].vertices)
