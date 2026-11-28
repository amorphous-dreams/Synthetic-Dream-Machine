"""Subject-neutral branching architecture: tower, gallery and traversable portal."""
from projection_loom.grammar import grow_program


def grow(params):
    return grow_program([
        {'key':'foundation','op':'root-box','center':[0,0,0],
         'size':[4,4,4],'has':['foundation']},
        {'key':'tower','op':'box','parents':['foundation'],
         'center':[0,0,{'param':'height','factor':.45,'offset':1.3}],
         'size':[1.7,1.7,{'param':'height'}],
         'has':['tower'],'slot':'main-tower'},
        {'key':'gallery','op':'box','parents':['foundation'],
         'center':[1.8,0,1.2],'size':[2,1.2,.8],
         'anonymous':True,'has':['gallery','bridge'],'slot':'side-gallery',
         'when':{'param':'branch','min':.5}},
        {'key':'entrance','op':'void-box','kind':'doorway',
         'center':[0,-1.8,0],'size':[1,2,1.8],
         'host':'foundation','exterior':True,'has':['entryway']},
        {'key':'chamber','op':'void-box','kind':'room',
         'center':[0,-.05,0],'size':[1.4,1.6,1.6],
         'host':'foundation','connects':['entrance'],
         'anonymous':True,'has':['chamber']},
    ],params)
