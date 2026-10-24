"""Necrospire seed: independent solid construction, source paintings used only as reference."""
from projection_loom import SolidAssembly, box, faceted_loft

def grow(p):
    shaft=p['shaft_width'];length=p['shaft_length'];fort=p['fortress_width'];tower=p['tower_height'];reach=p['gallery_reach'];gate=p['gate_width']
    a=SolidAssembly(overlap_ratio=.005,thickness_ratio=.015)
    sections=[(-length,0,0,.08,.10),(-.75*length,-.1,0,shaft*.41,shaft*.48),(-.3*length,.14,0,shaft*.51,shaft*.65),(-1.4,0,0,shaft*.66,shaft*.72),(1.2,0,0,shaft*.7,shaft*.68)]
    a.add('obsidian needle',faceted_loft(sections,sides=8,jaggedness=.05),role='foundation',material=0)
    a.add_box('lower terrace',(0,0,1.3),(fort*1.32,fort*1.15,1.35),parents=['obsidian needle'],material=1)
    a.add_box('central keep',(0,0,2.6+tower*.27),(fort*.75,fort*.72,2.7+tower*.55),parents=['lower terrace'],material=1)
    a.add_box('upper keep',(0,0,3.2+tower*.72),(fort*.54,fort*.53,1.2+tower*.66),parents=['central keep'],material=1)
    a.add_box('parapet',(0,0,3.35+tower*1.20),(fort*.68,fort*.64,.52),parents=['upper keep'],material=2)
    a.add_box('front lower terrace',(-fort*.53,-fort*.41,1.48),(fort*.47,fort*.40,.55),parents=['lower terrace'],material=1)
    a.add_box('western gallery',(-fort*.50*reach,0,1.6),(fort*.53*reach,fort*.23,.45),parents=['lower terrace'],material=2)
    # Upper fortified interior, its outward gate and a room-to-room passage are all first-class genome features.
    # Interior is under the upper keep and inside central keep. Keep conservative, with positive roof/walls.
    room_w=min(1.45,fort*.42)
    a.add_void('great-hall',box((0,0,2.48),(room_w,room_w,1.13)),kind='room',connects=('guarded-gate','upper-shaft'))
    a.add_void('guarded-gate',box((0,-fort*.45,2.42),(gate,fort*.81,1.00)),kind='doorway',connects=('great-hall',),exterior=True)
    a.add_void('upper-shaft',box((0,0,3.2),(min(gate*.7,.62),min(gate*.7,.62),1.6)),kind='shaft',connects=('great-hall',))
    return a
