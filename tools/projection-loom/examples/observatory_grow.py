"""Subject-neutral tower and side-gallery demonstration."""
from projection_loom import SolidAssembly, box


def grow(parameters):
    h=parameters['tower_height']; reach=parameters['gallery_reach']
    a=SolidAssembly()
    a.add('pedestal',box((0,0,0),(2.5,2.5,3.8)),role='foundation',material=0)
    a.add_box('upper tower',(0,0,2.65),(1.65,1.65,2.1*h),parents=['pedestal'],material=1)
    a.add_box('terrace',(1.0*reach,0,1.45),(1.9*reach,1.6,.38),parents=['pedestal'],material=1)
    a.add_box('roof cap',(0,0,3.62*h),(1.86,1.86,.36),parents=['upper tower'],material=1)
    a.add_beam('terrace diagonal',(.50,0,.85),(1.46*reach,0,1.47),.24,.24,
               parents=['pedestal','terrace'],material=2)
    return a
