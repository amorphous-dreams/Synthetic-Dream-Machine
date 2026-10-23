"""Subject-neutral emergent architecture: new branches remain nameless."""
from projection_loom import SolidAssembly, box


def grow(parameters):
    a = SolidAssembly(overlap_ratio=.003)
    a.add('foundation', box((0,0,0),(6,6,3)), role='foundation',
          has=('shelter','threshold'))
    a.add_box('tower', (0,0,1.70), (2.7,2.7,1.7), parents=('foundation',),
              has=('watch','verticality'))
    # The genome may or may not grow either of these nameless subtrees.
    # Stable slots identify construction rules, not permanent pet-names.
    if parameters['surprise'] > .27:
        west = a.spawn(box((2.7,0,1.3),(2.2,.65,.6)),parents=('foundation',),
                       has=('bridge','crossing'),slot='west-emergence')
        a.spawn(box((3.4,0,1.66),(.75,.7,.5)),parents=(west,),
                has=('refuge','platform'),slot='west-offshoot')
    if parameters['surprise'] > .64:
        a.spawn(box((-2.65,0,.9),(1.85,1.1,.7)),parents=('foundation',),
                has=('gallery','lookout'),slot='east-emergence')
    a.spawn_void(box((0,-2.85,.0),(.75,1.25,.8)),kind='doorway',exterior=True,
                 host='foundation',has=('portal','outside-route'),slot='threshold-void')
    return a
