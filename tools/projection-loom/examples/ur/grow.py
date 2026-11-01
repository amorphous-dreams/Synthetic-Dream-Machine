"""Small, interpretive modern reconstruction of the Great Ziggurat of Ur.

Input evidence: published rough lower platform 62.5x43x11 m, second stage
36x26x5.7 m, and excavated triple-stair approach (see provenance manifest).
The uppermost temple, its dimensions, ramp profile, and facade details are
modern hypotheses. Nothing here claims a measured archaeological solid.
"""
from projection_loom import SolidAssembly, box, beam


def grow(p):
    length, width = p['base_length'], p['base_width']
    h1, h2, stair_w = p['base_height'], p['stage_height'], p['stair_width']
    a = SolidAssembly(overlap_ratio=.002, thickness_ratio=.008)
    a.add('Ur lower mass', box((0, 0, h1 / 2), (length, width, h1), taper=.045),
          role='foundation', has=('terrace', 'ziggurat', 'mudbrick-core'), slot='lower-stage')
    # Roof of first stage at h1; deliberate embed secures contact to parent.
    a.add_box('Ur upper platform', (0, 2.0, h1 + h2 / 2 - .35),
              (36., 26., h2 + .7), parents=('Ur lower mass',), taper=.07,
              has=('second-terrace',), slot='middle-stage')
    a.add_box('Ur high platform', (0, 2.7, h1 + h2 + 1.45),
              (16., 12., 3.8), parents=('Ur upper platform',), taper=.08,
              has=('summit-stage',), slot='upper-stage')
    # Temple interpretation is optional, and expressly speculative.
    if p['summit_shrine'] >= .5:
        a.add_box('Speculative moon shrine', (0, 3., h1 + h2 + 4.55),
                  (8.1, 6.5, 4.3), parents=('Ur high platform',), taper=.025,
                  has=('speculative-temple',), slot='conjectural-temple')
    # A physically overlapping processional spine, wider than the 1st stage entrance.
    front = -width * .5
    a.add('Central ceremonial stair core',
          beam((0., front - 10.5, 1.25), (0., front + 1.75, h1 + .15),
               stair_w, 2.15), parents=('Ur lower mass',), role='primary',
          has=('stair', 'processional-ascent'), slot='central-stair')
    # Side stairs rise diagonally along the north-facing facade and
    # overlap the base. Profiles deliberately simplify the excavated ramps.
    for sign, direction in ((-1., 'west'),(1., 'east')):
        a.add(f'{direction} approach core',
              beam((sign * (length * .37), front - 4.0, 1.2),
                   (sign * 5.0, front + 1.7, h1 + .06), stair_w * .65, 1.9),
              parents=('Ur lower mass',), role='secondary',
              has=('stair', 'flanking-ascent'), slot=f'{direction}-approach')
    return a
