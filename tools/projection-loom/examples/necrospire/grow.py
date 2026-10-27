"""Necrospire seed: independent solid construction, source paintings used only as reference."""
from projection_loom import SolidAssembly, box, faceted_loft
from projection_loom.massing_relations import layout as primary_massing_layout

def grow(p):
    shaft=p['shaft_width'];length=p['shaft_length'];fort=p['fortress_width'];tower=p['tower_height'];reach=p['gallery_reach'];gate=p['gate_width']
    # Alpha breeding loci default exactly to the authored original seed.
    asym=p.get('shaft_asymmetry',0.)
    rough=p.get('shaft_jaggedness',.05)
    overhang=p.get('terrace_overhang',1.32)
    terrace_offset=p.get('terrace_offset',0.)
    crown_offset=p.get('crown_offset',0.)
    crown_taper=p.get('crown_taper',0.)
    keep_taper=p.get('keep_taper',0.)
    parapet_fraction=p.get('parapet_fraction',.68)
    segmentation=p.get('spire_segmentation',0.)
    layout=primary_massing_layout(p,fortress_width=fort,tower_height=tower)
    tx,ty=layout['terrace']; kx,ky=layout['keep']; ux,uy=layout['crown']
    a=SolidAssembly(overlap_ratio=.005,thickness_ratio=.015)
    sections=[(-length,0,0,.08,.10),(-.75*length,-.1,0,shaft*.41,shaft*.48),(-.3*length,.14,0,shaft*.51,shaft*.65),(-1.4,0,0,shaft*.66,shaft*.72),(1.2,0,0,shaft*.7,shaft*.68)]
    sections=[(z,cx + asym*weight,cy,rx,ry) for (z,cx,cy,rx,ry),weight in
              zip(sections,(0.,-.5,.7,-.6,.5))]
    if segmentation>=.5:
        z=-.52*length
        sections.insert(2,(z,asym*.24,0.,shaft*.49,shaft*.56))
    a.add('obsidian needle',faceted_loft(sections,sides=8,jaggedness=rough),role='foundation',material=0)
    a.add_box('lower terrace',(tx,ty,1.3),(fort*overhang,fort*1.15,1.35),parents=['obsidian needle'],material=1,slot='lower-terrace')
    a.add_box('central keep',(kx,ky,2.6+tower*.27),(fort*.75,fort*.72,2.7+tower*.55),parents=['lower terrace'],material=1,taper=keep_taper,slot='central-keep')
    a.add_box('upper keep',(ux,uy,3.2+tower*.72),(fort*.54,fort*.53,1.2+tower*.66),parents=['central keep'],material=1,taper=crown_taper)
    a.add_box('parapet',(ux,uy,3.35+tower*1.20),(fort*parapet_fraction,fort*.64,.52),parents=['upper keep'],material=2)
    a.add_box('front lower terrace',(tx-fort*.53,ty-fort*.41,1.48),(fort*.47,fort*.40,.55),parents=['lower terrace'],material=1)
    a.add_box('western gallery',(tx-fort*.50*reach,ty,1.6),(fort*.53*reach,fort*.23,.45),parents=['lower terrace'],material=2)
    if segmentation>=.65:
        # A discrete attached CAD buttress changes the observed crown outline;
        # it must pass the exact parent-contact and fused void audits.
        a.add_box('northern crown buttress',(ux+fort*.25,uy+fort*.17,3.2+tower*.61),
                  (fort*.20,fort*.21,.80+tower*.3),parents=['upper keep'],material=2)
    # Independent inherited watchtowers grow from the same native terrace.
    for name,center,size in layout['towers']:
        a.add_box(name,center,size,parents=['lower terrace'],material=1,
                  slot=name.replace(' ','-'))
    # Upper fortified interior, its outward gate and a room-to-room passage are all first-class genome features.
    # Interior is under the upper keep and inside central keep. Keep conservative, with positive roof/walls.
    room_w=min(1.45,fort*.42)
    a.add_void('great-hall',box((kx,ky,2.48),(room_w,room_w,1.13)),kind='room',connects=('guarded-gate','upper-shaft'))
    a.add_void('guarded-gate',box((kx,ky-fort*.45,2.42),(gate,fort*.81,1.00)),kind='doorway',connects=('great-hall',),exterior=True)
    a.add_void('upper-shaft',box((kx,ky,3.2),(min(gate*.7,.62),min(gate*.7,.62),1.6)),kind='shaft',connects=('great-hall',))
    # Alpha grammar choices extend the same native assembly, never create a
    # secondary geometry authority. Source artwork is not a genotype.
    if 'grammar.gallery' in p and 'grammar.buttress' in p:
        from projection_loom.grammar import grow_program
        grammar=[
            {'key':'east gallery','op':'box','parents':['lower terrace'],
             'center':[tx+fort*.72,ty,1.6],
             'size':[{'param':'grammar.gallery_span','factor':1.0},1.25,.64],
             'role':'secondary','has':['#has/gallery','#has/extension'],
             'slot':'east-gallery',
             'when':{'param':'grammar.gallery','min':.5}},
            {'key':'crown brace','op':'box','parents':['upper keep'],
             'center':[ux+fort*.31,uy,3.2+tower*.72],
             'size':[{'param':'grammar.brace_span'},.92,1.4],
             'role':'secondary','has':['#has/brace','#has/fortification'],
             'slot':'crown-brace',
             'when':{'param':'grammar.buttress','min':.5}},
        ]
        grow_program(grammar,p,assembly=a)
    # Opt-in architecture is inherited in a separately authored source-bound
    # birth recipe. Old original source genomes lack these loci and remain
    # geometrically unchanged; failures are genuine native rejections.
    if "arch.birth.enable" in p:
        from projection_loom.birth_relations import apply_birth
        apply_birth(a,p)
    return a
