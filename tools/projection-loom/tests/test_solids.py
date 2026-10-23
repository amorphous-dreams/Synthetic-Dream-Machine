import json
from pathlib import Path
import cadquery as cq
import pytest
from projection_loom import SolidAssembly, box, beam, faceted_loft
from projection_loom.pipeline import Project

PROJECT=Path(__file__).parents[1]/'examples'/'necrospire'/'project.json'


def test_disconnected_solid_rejected():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    a.add('float',box((5,0,0),(1,1,1)),parents=['root'])
    audit=a.audit(join=False)
    assert not audit['valid'] and len(audit['failed'])==1


def test_touch_only_rejected():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    a.add('face_contact',box((2,0,0),(2,2,2)),parents=['root'])
    assert a.audit()['failed'][0]['overlap_volume'] < 1e-7


def test_vertex_only_rejected():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    a.add('corner',box((2,2,2),(2,2,2)),parents=['root'])
    assert not a.audit()['valid']


def test_overlap_produces_real_union():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    a.add('attached',box((1.4,0,0),(2,2,2)),parents=['root'])
    report=a.audit(join=True)
    assert report['valid'] and report['union_solids']==1
    assert a.fuse().isValid()


def test_tiny_pin_contact_is_rejected():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    a.add('pin',box((1.98,0,0),(2,2,2)),parents=['root'])
    assert not a.audit()['valid']


def test_all_children_have_declared_support():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    with pytest.raises(ValueError):a.add('child',box((1,0,0),(2,2,2)))
    with pytest.raises(ValueError):a.add('child',box((1,0,0),(2,2,2)),parents=['missing'])


def test_beam_has_positive_volume_and_closed_geometry():
    shape=beam((0,0,0),(1.4,2.1,3.0),.3,.4)
    assert shape.isValid() and len(shape.Solids())==1 and shape.Volume()>0


def test_faceted_loft_has_closed_volume():
    shape=faceted_loft([(-6,0,0,.1,.1),(-2,0,0,1,1),(2,0,0,1.5,1)])
    assert shape.isValid() and len(shape.Solids())==1 and shape.Volume()>0


def test_architectural_specimen_is_fused_solid():
    p=Project.load(PROJECT)
    a=p.grow()
    audit=a.audit(join=True)
    assert audit['valid'] and audit['parts']>=25 and audit['joints']>=audit['parts']-1
    assert a.fuse().isValid()


def test_old_project_schema_retired(tmp_path):
    f=tmp_path/'old.json'
    f.write_text(json.dumps({'schema':'projection-loom/project/v1'}))
    with pytest.raises(ValueError,match='older mesh models remain archival'):
        Project.load(f)


def test_old_mesh_seed_not_accepted(tmp_path):
    p=Project.load(PROJECT)
    with pytest.raises(ValueError,match='Unknown genome locus'):
        p.grow({'scale_x':1.0})


def test_unknown_parent_rejected():
    a=SolidAssembly().add('root',box((0,0,0),(2,2,2)),role='foundation')
    with pytest.raises(ValueError):a.add('wrong',box((0,0,0),(1,1,1)),parents=('not_found',))


def test_render_transport_keeps_named_roles():
    mesh=Project.load(PROJECT).grow().tessellate()
    names={p['name'] for p in mesh.parts}
    assert 'obsidian needle' in names and 'front lower terrace' in names
    assert 'central keep' in names
