import numpy as np
from projection_loom import Assembly,Camera
from projection_loom.render import render_controls,silhouette
from projection_loom.line_hierarchy import classify_edges,render_line_hierarchy


def architectural_assembly():
    assembly=Assembly()
    assembly.prism('base',(0,0,-.2),(2.2,1.4,1.1),material=0)
    assembly.prism('upper-tower',(0,0,.9),(.9,.85,1.5),material=1)
    assembly.prism('terrace',(.95,0,.35),(1.4,1.2,.19),material=2)
    assembly.beam('support',(.35,0,-.25),(1.45,0,.35),.13,.16,material=0)
    return assembly.mesh()


def test_coplanar_triangle_diagonal_is_not_structural_crease():
    a=Assembly().prism('simple',(0,0,0),(1,1,1)).mesh()
    e=classify_edges(a,Camera(),(300,450),min_display_length=0.5)
    faces=np.asarray(a.faces)
    top_diagonal=tuple(sorted((int(faces[2][0]),int(faces[2][2]))))
    assert top_diagonal not in {i.edge for i in e}
    assert len(e)>0


def test_semantic_layers_preserve_rgba_and_silhouette():
    m=architectural_assembly();cam=Camera(azimuth=38,elevation=16)
    size=(240,360)
    result=render_line_hierarchy(m,cam,size,style={'line_supersample':2})
    import cv2
    hard=np.asarray(silhouette(m,cam,size))>0
    within=cv2.dilate(np.uint8(hard),np.ones((5,5),np.uint8))>0
    for category in ['outline','occlusion','crease','material','detail','structure']:
        im=result[category]
        data=np.asarray(im)
        assert im.size==size and im.mode=='RGBA'
        assert np.all(data[~within,3]==0)  # no strokes away from the matte
    assert np.asarray(result['outline'])[...,3].max()>0
    assert result['stats']['classified_edges']>0


def test_roles_suppress_parts_without_erasing_main_silhouette():
    m=architectural_assembly();cam=Camera(0,0)
    e1=classify_edges(m,cam,(260,390),presentation_width=260)
    e2=classify_edges(m,cam,(260,390),role_overrides={'terrace':'suppress'},presentation_width=260)
    assert len(e2)<len(e1)
    a=render_line_hierarchy(m,cam,(260,390),style={'part_roles':{'terrace':'suppress'},'line_supersample':1})
    b=render_line_hierarchy(m,cam,(260,390),style={'line_supersample':1})
    assert np.array_equal(np.asarray(a['outline']),np.asarray(b['outline']))


def test_small_presentation_suppresses_small_structural_strokes():
    m=architectural_assembly();cam=Camera(40,14)
    full=classify_edges(m,cam,(512,768),presentation_width=512,min_display_length=6)
    quarter=classify_edges(m,cam,(512,768),presentation_width=128,min_display_length=6)
    assert len(quarter)<len(full)


def test_controls_four_pass_contract_remains_stable():
    m=architectural_assembly();cam=Camera(0,0)
    controls=render_controls(m,cam,(160,240),style={'linework_mode':'semantic','line_supersample':1,'work_width':128})
    assert set(controls)=={'silhouette','structure','lit','lit_structure'}
    assert controls['structure'].mode=='RGBA'
    assert controls['silhouette'].mode=='L'
    assert np.asarray(controls['structure'])[...,3].sum()>0


def test_semantic_renderer_deterministic():
    m=architectural_assembly();cam=Camera(0,0)
    a=render_line_hierarchy(m,cam,(160,240),style={'line_supersample':1})
    b=render_line_hierarchy(m,cam,(160,240),style={'line_supersample':1})
    assert np.array_equal(np.asarray(a['structure']),np.asarray(b['structure']))
    assert a['stats']==b['stats']
