"""Locally authored modular-concrete trial, not nosycat's CC0 geometry.

Built to exercise OpenSCAD STL evidence versus a distinct CadQuery grammar.
Its model units are arbitrary: no surveyed architectural scale is inferred.
"""
from projection_loom import SolidAssembly, box

def grow(p):
    offset=p['cantilever_offset']; high=p['tower_height']; slab=p['slab_length']
    a=SolidAssembly(overlap_ratio=.003,thickness_ratio=.01)
    a.add('massive grounded podium',box((0,0,4),(26,16,8)),role='foundation',has=('concrete','plinth'))
    a.add_box('modular center block',(2.8,0,10.65),(19,13,6.1),parents=('massive grounded podium',),has=('repeating-bays',),slot='core')
    a.add_box('asymmetric tower',(-5.5,-.7,13.7+high*.47),(14,11,high),parents=('modular center block',),has=('tower','cantilever'),slot='tower')
    a.add_box('eastern cantilever',(offset,0,11.5),(slab,9,2.8),parents=('modular center block',),role='secondary',has=('bridge','cantilever'),slot='cantilever')
    a.add_void('public entry',box((0,-7.6,3.1),(3.0,3.2,5.8)),kind='doorway',exterior=True,has=('entrance',),host='massive grounded podium')
    a.add_void('lobby',box((0,-4.8,3.3),(5.1,4.0,4.5)),kind='room',connects=('public entry',),has=('interior',),host='massive grounded podium')
    return a
