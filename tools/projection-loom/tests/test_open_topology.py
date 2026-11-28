"""Typed construction mutations and safe nameless graph transactions."""
import pytest
from projection_loom.grammar import grow_program
from projection_loom.rewriting import apply_rewrite
from projection_loom.location_stack import LocationStack, Element, Relation, Frame, Source


def specimen():
    return [
        {'key':'root','op':'root-box','center':[0,0,0],'size':[4,4,4],
         'has':['foundation','fortress']},
        {'key':'gallery','op':'box','parents':['root'],'center':[1.9,0,1],
         'size':[2,1,1],'anonymous':True,'has':['bridge','gallery'],
         'slot':'growing-gallery','when':{'param':'branch','min':.5}},
        {'key':'portal','op':'void-box','host':'root','center':[0,-2,0],
         'size':[1,3,2],'kind':'doorway','exterior':True,'has':['entry']}
    ]


def test_open_topology_grows_real_cad_and_void():
    a=grow_program(specimen(),{'branch':1.})
    assert a.audit(join=True)['valid']
    w=a.relation_witness(location='test')
    gallery=next(v for v in w.nodes.values() if '#has/bridge' in v.has)
    assert gallery.anonymous and gallery.slot=='growing-gallery'
    assert 'portal' in w.nodes


def test_continuous_and_discrete_genome_mutate():
    steps=specimen()
    steps[1]['size']=[{'param':'span','offset':1.5},1,1]
    short=grow_program(steps,{'branch':0.,'span':.5})
    long=grow_program(steps,{'branch':1.,'span':.8})
    assert short.audit(join=True)['valid'] and long.audit(join=True)['valid']
    assert len(short.parts)==1 and len(long.parts)==2
    assert long.parts[next(reversed(long.parts))].solid.Volume()==pytest.approx(2.3)


def test_grammar_rejects_orphans_and_invalid_material():
    steps=specimen()
    steps[1]['parents']=['nonexistent']
    with pytest.raises(KeyError):grow_program(steps,{'branch':1})
    steps=specimen();steps[1]['center']=[50,50,50]
    assert not grow_program(steps,{'branch':1}).audit(join=True)['valid']
    steps=specimen();steps[1]['size']=[float('nan'),1,1]
    with pytest.raises(ValueError,match='finite'):grow_program(steps,{'branch':1})


def test_rewrite_emerges_unnamed_hypothesis_and_keeps_original():
    original=LocationStack('test','Pet-named ruin')
    original.add_element(Element('site','unresolved_form'))
    new,receipt=apply_rewrite(original,'arch-branch',[
        {'op':'spawn','handle':'~arch','contained_by':'site','capabilities':['#has/bridge']},
        {'op':'spawn','handle':'~void','contained_by':'~arch','capabilities':['#has/portal']},
        {'op':'relate','subject':'~arch','verb':'opens_into','object':'~void'}])
    assert original.pet_name==new.pet_name and len(original.elements)==1
    assert len(new.elements)==3 and new.audit()['valid']
    assert receipt.before!=receipt.after


def test_rewrite_no_dangling_or_unwitnessed_fact():
    site=LocationStack('site')
    site.add_element(Element('root','unresolved_form'))
    site.add_element(Element('branch','unresolved_form'))
    site.relate(Relation('root','contains','branch'))
    with pytest.raises(ValueError,match='Dangling'):
        apply_rewrite(site,'remove',[{'op':'release','handle':'branch'}])
    removed,_=apply_rewrite(site,'remove',[{'op':'release','handle':'branch','detach':True}])
    assert len(removed.elements)==1 and len(site.elements)==2
    with pytest.raises(ValueError,match='manufacture source'):
        apply_rewrite(site,'fake',[{'op':'spawn','handle':'fake','epistemic':'source'}])
    with pytest.raises(ValueError,match='cycle'):
        apply_rewrite(site,'cycle',[{'op':'relate','subject':'branch','verb':'contains','object':'root'}])


def test_rewrites_cannot_mutate_attested_source(tmp_path):
    image=tmp_path/'witness.png'
    image.write_bytes(b'original immutable source')
    scene=LocationStack('image-site').add_frame(Frame('pixels','pixel','px'))
    scene.add_source(Source.from_file('witness','single_image',image,'pixels'))
    scene.add_element(Element('observed-facade','image_plane',('witness',),
                              epistemic='source'))
    with pytest.raises(ValueError,match='Source and inferred'):
        apply_rewrite(scene,'erase',[{'op':'release','handle':'observed-facade',
                                       'detach':True}])
    with pytest.raises(ValueError,match='source-attested'):
        apply_rewrite(scene,'falsify',[{'op':'has','handle':'observed-facade',
                                          'capabilities':['door']}])
    assert scene.audit()['valid'] and scene.elements['observed-facade'].epistemic=='source'


def test_conditional_branch_regrowth_across_threshold():
    expected=[]
    for branch in (0.0,0.49,0.50,0.9,1.0):
        body=grow_program(specimen(),{'branch':branch})
        assert body.audit(join=True)['valid']
        expected.append(sum('#has/bridge' in p.has for p in body.parts.values()))
    assert expected==[0,0,1,1,1]
