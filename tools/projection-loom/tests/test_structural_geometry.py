import json
import numpy as np
import pytest
from pathlib import Path
from projection_loom import Assembly,Camera,ConstructionGrammar, ArchitectureGraph
from projection_loom.solid_contacts import part_solids,audit_joint,overlap
from projection_loom.structural_render import draw_joint_diagnostics
from projection_loom.evolution import Project


def two_boxes(offset,dim=(2,2,2)):
    a=Assembly().prism('root',(0,0,0),dim)
    a.prism('child',(offset,0,0),dim)
    return a.mesh()


@pytest.mark.parametrize('offset,expected',[(0.,True),(1.,True),(2.,False),(2.5,False)])
def test_box_volume_contact_vs_face_or_gap(offset,expected):
    m=two_boxes(offset)
    s=part_solids(m)
    x=audit_joint(s,'root','child',min_ratio=.04)
    assert x['meets_threshold'] is expected
    if offset==2:
        assert x['status']=='zero_thickness'
        assert x['radius']<1e-7


def test_corner_touch_is_not_joint():
    a=Assembly().prism('root',(0,0,0),(2,2,2)).prism('child',(2,2,2),(2,2,2)).mesh()
    o=audit_joint(part_solids(a),'root','child')
    assert o['radius']==0
    assert not o['meets_threshold']


def test_open_surface_cannot_certify_hull_overlap():
    m=two_boxes(1.0)
    m.faces=m.faces[:-1]
    # Reconstruct part ranges for the test by dropping a face in the second part.
    m.parts[1]['num_faces']-=1
    m.materials=m.materials[:-1]
    item=audit_joint(part_solids(m),'root','child')
    assert item['status']=='hull_proxy_only'
    assert not item['verified']


def test_construction_grammar_places_positive_solid_joint():
    b=(ConstructionGrammar()
       .foundation('foundation',(0,0,-1),(2,2,2))
       .attach_prism('keep','foundation',(1,1,1.5),overlap=.23)
       .attach_prism('terrace','keep',(1.2,.7,.28),axis='x',sign=1,overlap=.24))
    graph=b.graph()
    r=graph.require_valid(b.model())
    assert r['valid']
    assert len(r['attachments'])==2
    assert all(x['radius']>.04 for x in r['attachments'])


def test_floating_element_needs_explicit_exception():
    m=Assembly().prism('ground',(0,0,0),(1,1,1)).prism('float',(10,0,0),(1,1,1)).mesh()
    with pytest.raises(ValueError,match='Unrooted'):
        ArchitectureGraph(['ground'],[]).validate(m)
    g=ArchitectureGraph(['ground'],[],roles={'float':'exempt'})
    assert g.audit(m)['valid']


def test_support_cycle_rejected():
    m=Assembly().prism('a',(0,0,0),(1,1,1)).prism('b',(0,0,.3),(1,1,1)).mesh()
    with pytest.raises(ValueError,match='cycle'):
        ArchitectureGraph(['a'],[{'parent':'a','child':'b'},{'parent':'b','child':'a'}]).validate(m)


def test_rooted_but_disjoint_rejected_at_gate():
    m=two_boxes(2.2)
    graph=ArchitectureGraph(['root'],[{'parent':'root','child':'child'}],policy='gate')
    assert not graph.audit(m)['valid']
    with pytest.raises(ValueError,match='Structural gate'):
        graph.require_valid(m)


def test_structure_project_and_style_integration(tmp_path):
    src=Path(__file__).parents[1]/'examples'/'assembly.py'
    (tmp_path/'rig.py').write_text(src.read_text())
    cfg={'schema':'projection-loom/project/v1','builder':'rig.py:build',
         'bounds':{'width':[.8,1.2],'height':[.8,1.2],'reach':[.8,1.2]},
         'initial':{'width':1.,'height':1.,'reach':1.},
         'cameras':{'front':{'azimuth':0}},'targets':[],
         'structure':{'roots':['pedestal'], 'policy':'report',
                      'attachments':[{'parent':'pedestal','child':'working deck'}],
                      'roles':{'pedestal':'foundation','working deck':'secondary','upper column':'exempt','side gallery':'exempt','gallery support':'exempt','top plate':'exempt','course':'exempt'}}}
    (tmp_path/'project.json').write_text(json.dumps(cfg))
    p=Project.load(tmp_path/'project.json');m=p.build(p.initial)
    r=p.audit(m)
    assert 'attachments' in r and len(r['attachments'])==1
    assert p.render_style()['part_roles']['pedestal']=='primary'
    paths=draw_joint_diagnostics(m,p.cameras,r,tmp_path/'qa',size=(160,240))
    assert Path(paths['front']).is_file()
    from PIL import Image
    assert Image.open(paths['front']).mode=='RGBA'


def test_brace_constructed_between_existing_masses():
    a=ConstructionGrammar().foundation('base',(0,0,0),(2,2,1))
    # Intentional separate anchored object may be marked as a root then explicitly braced.
    a.foundation('raised',(0,0,3),(1,1,1))
    a.brace('column','base','raised',.4,.4)
    r=a.graph(policy='report').audit(a.model())
    assert len(r['attachments'])==2
    assert r['valid']


def test_explicit_brace_operation_reenters_checkpoint_unchanged():
    from projection_loom.structural_mutations import apply_structural_operations
    base=Assembly().prism('root',(0,0,0),(1,1,1)).prism('deck',(2.5,0,1.5),(1,1,.3)).mesh()
    ops=[{'operation':'brace','name':'support','parent':'root','child':'deck',
          'width_parameter':'section','depth':.35}]
    first=apply_structural_operations(base,ops,{'section':.35})
    second=apply_structural_operations(first,ops,{'section':.35})
    assert len(first.parts)==len(second.parts)==3
    g=ArchitectureGraph(['root'],[
        {'parent':'root','child':'support'},{'parent':'support','child':'deck'}])
    assert g.audit(first)['valid']


def test_strict_structure_evolution_preserves_valid_seed(tmp_path):
    from projection_loom.evolution import produce
    from PIL import Image
    code='''from projection_loom import Assembly

def build(p,detail_level=1):
    a=Assembly().prism('base',(0,0,0),(1,1,1))
    a.prism('top',(0,0,p['height']),(1,1,1))
    return a.mesh()
'''
    (tmp_path/'rig.py').write_text(code)
    # The target is an intentionally disconnected version of the shape.
    from projection_loom.render import silhouette
    from projection_loom import Camera
    import importlib.util
    spec=importlib.util.spec_from_file_location('testcase_rig',tmp_path/'rig.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    image=silhouette(module.build({'height':2.2}),Camera(),(48,72))
    Image.fromarray(image,'L').save(tmp_path/'target.png')
    cfg={'schema':'projection-loom/project/v1','builder':'rig.py:build',
         'bounds':{'height':[.20,2.2]},'initial':{'height':.65},
         'cameras':{'front':{'azimuth':0}},
         'targets':[{'view':'front','path':'target.png','channel':'luma','weight':1.0}],
         'structure':{'policy':'gate','roots':['base'],
                      'attachments':[{'parent':'base','child':'top','min_ratio':.04}]}}
    (tmp_path/'project.json').write_text(json.dumps(cfg))
    r=produce(tmp_path/'project.json',tmp_path/'output',cycles=1,burst=2,survivors=2,
              offspring=1,resolution=(48,72),export_size=(72,108),rng_seed=123)
    assert r['structural_audit']['valid']
    assert r['parameters']['height']<1.
    assert set(r['outputs']['front'])=={'silhouette','structure','lit','lit_structure'}
    assert Path(r['diagnostics']['front']).exists()


def test_structural_gating_survives_complete_epoch_loop(tmp_path):
    from projection_loom.epoch_loop import epoch_loop
    from pathlib import Path
    example=Path(__file__).parents[1]/'examples'
    import shutil
    for name in ('structural_project.json','structural_assembly.py'):
        shutil.copy2(example/name,tmp_path/name)
    state=epoch_loop(tmp_path/'structural_project.json',tmp_path/'epochs',passes=2,
                     burst=2,survivors=2,offspring=1,cycles_per_epoch=1,
                     resolution=(48,72),export_size=(72,108),rng_seed=233)
    assert len(state['epochs'])==2
    assert all(x['accepted'] for x in state['epochs'])
    for n in (1,2):
        candidate=json.loads((tmp_path/'epochs'/f'epoch_{n:02d}'/'candidate'/'manifest.json').read_text())
        assert candidate['structural_audit']['valid']
        assert set(candidate['outputs']['front'])=={'silhouette','structure','lit','lit_structure'}


def test_exemption_preserves_decorative_linework_role():
    graph=ArchitectureGraph(['base'],[],roles={'ornament':'exempt'})
    assert graph.drawing_roles()['ornament']=='detail'
