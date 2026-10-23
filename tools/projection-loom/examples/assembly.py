"""A parametric assembly used for basic renderer and optimizer exercises."""
from projection_loom import Assembly


def build(parameters,detail_level=1):
    width=float(parameters['width'])
    height=float(parameters['height'])
    reach=float(parameters['reach'])
    a=Assembly()
    a.prism('pedestal',(0,0,-2.4),(1.7*width,1.3*width,2.5),material=0,taper=.05)
    a.prism('working deck',(0,0,.05),(2.5*width,1.6*width,.24),material=1)
    a.prism('upper column',(0,0,.2),(1.0*width,.9*width,1.5*height),material=1,taper=.05)
    a.prism('side gallery',(.85*reach,0,.48),(.95*reach,.5,.16),material=1)
    a.beam('gallery support',(.25,0,-.35),(1.15*reach,0,.52),.13,.13,material=2)
    if detail_level:
        a.prism('top plate',(0,0,1.5*height),(.95*width,.95*width,.18),material=1)
        a.prism('course',(0,-.46,.5),(.99*width,.09,.08),material=2)
    return a.mesh()
