"""Native CadQuery motifs translated from nosycat's pinned CC0 OpenSCAD rules.

Generated facade bands and alternating piers echo source repetitions without
importing STL as CAD, pretending an external mesh has native BRep authority, or
altering the pristine Necrospire source constructor.
"""
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

UPSTREAM_ARCHIVE_SHA256 = "8a89504f2abf355f56f4ea93c9a50fbdc60fb3664bdad019c65e6582a91ff9a3"

_SOURCE = Path(__file__).with_name("grow.py")
_spec = spec_from_file_location("necrospire_pristine_builder", _SOURCE)
_module = module_from_spec(_spec)
_spec.loader.exec_module(_module)


def grow(p):
    a = _module.grow(p)
    fort = float(p["fortress_width"])
    tower = float(p["tower_height"])
    crown = float(p["crown_offset"])
    z_center = 3.2 + tower * .72
    face_y = -fort * .25
    depth = float(p.get("brutalist.projection", .26))
    count_bands = max(2, min(6, int(round(p.get("brutalist.band_count", 4)))))
    count_piers = max(2, min(5, int(round(p.get("brutalist.pier_count", 3)))))
    if p.get("brutalist.bands", 0.) >= .5:
        for n in range(count_bands):
            offset = (n / max(1, count_bands - 1) - .5) * (1.0 + tower * .10)
            a.add_box(
                "nosycat facade band " + str(n),
                (crown, face_y, z_center + offset),
                (fort * .48, depth + .18, .11),
                parents=["upper keep"], role="secondary", material=2,
                has=("facade-band", "brutalist-modularity"),
                slot="nosycat-band-" + str(n))
    if p.get("brutalist.piers", 0.) >= .5:
        for n in range(count_piers):
            offset = (n / max(1,count_piers-1) - .5) * fort * .33
            a.add_box(
                "nosycat vertical pier " + str(n),
                (crown + offset, face_y, z_center),
                (.13, depth + .20, .9 + tower * .22),
                parents=["upper keep"], role="secondary", material=2,
                has=("vertical-pier", "brutalist-modularity"),
                slot="nosycat-pier-" + str(n))
    return a
