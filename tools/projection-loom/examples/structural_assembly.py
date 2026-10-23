"""Construction grammar: supported tower, terrace, and explicit diagonal brace."""
from projection_loom import ConstructionGrammar


def build(parameters,detail_level=1):
    g=ConstructionGrammar()
    g.foundation('foundation',(0,0,-1.9),(1.6,1.45,1.9),material=0)
    g.attach_prism('keep','foundation',
                   (float(parameters['tower_width']),.88,1.7),
                   axis='z',sign=1,overlap=.21,material=1,role='primary')
    g.attach_prism('gallery','keep',
                   (float(parameters['gallery_reach']),.85,.29),
                   axis='x',sign=1,overlap=.26,material=1,role='secondary')
    if detail_level:
        g.attach_prism('crown','keep',(.65,.72,.26),axis='z',sign=1,
                       overlap=.29,material=2,role='detail')
    return g.model()
