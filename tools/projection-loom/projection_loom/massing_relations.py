"""Source-frozen, heritable primary massing for Necrospire's Experiment Zero.

The proposed nodes displace entire native CAD assemblies, never pixels or baked
mesh vertices. The normal SolidAssembly and carved-void audits retain authority.
"""
from __future__ import annotations
import math

LOCI = {
    "arch.massing.terrace_dx": ((-1.1, 1.1), 0.0),
    "arch.massing.terrace_dy": ((-0.85, 0.85), 0.0),
    "arch.massing.keep_dx": ((-1.2, 1.2), 0.0),
    "arch.massing.keep_dy": ((-0.9, 0.9), 0.0),
    "arch.massing.crown_dx": ((-1.15, 1.15), 0.0),
    "arch.massing.crown_dy": ((-0.75, 0.75), 0.0),
    "arch.massing.west_tower": ((0.0, 1.0), 0.0),
    "arch.massing.east_tower": ((0.0, 1.0), 0.0),
    "arch.massing.tower_spread": ((0.3, 1.0), 0.55),
    "arch.massing.tower_stagger": ((-0.9, 0.9), 0.0),
    "arch.massing.tower_scale": ((0.9, 1.15), 1.0),
}

def describe_massing(genome):
    found = set(genome) & set(LOCI)
    if not found:
        return None
    if found != set(LOCI):
        raise ValueError("Primary massing needs all declared loci")
    values = {}
    for key, (bounds, _) in LOCI.items():
        v = genome[key]
        if (isinstance(v, bool) or not isinstance(v, (int, float))
                or not math.isfinite(float(v)) or not bounds[0] <= v <= bounds[1]):
            raise ValueError("Unbounded primary massing locus: " + key)
        values[key] = float(v)
    return {
        "schema": "projection-loom/primary-massing-proposal",
        "state": "proposed",
        "values": values,
        "tower_switches": {
            side: values["arch.massing." + side + "_tower"] >= .5
            for side in ("west", "east")
        },
        "authority": "inherited proposal; native admission and Operator selection separate",
    }

def layout(genome, *, fortress_width, tower_height):
    proposal = describe_massing(genome)
    values = proposal["values"] if proposal else {}
    def gene(name, default=0.0):
        return values.get("arch.massing." + name, default)
    tx, ty = genome.get("terrace_offset", 0.0) + gene("terrace_dx"), gene("terrace_dy")
    kx, ky = tx + gene("keep_dx"), ty + gene("keep_dy")
    ux = kx + genome.get("crown_offset", 0.0) + gene("crown_dx")
    uy = ky + gene("crown_dy")
    towers = []
    if proposal:
        spread, stagger, scale = gene("tower_spread"), gene("tower_stagger"), gene("tower_scale")
        for side, sign in (("west", -1), ("east", 1)):
            if not proposal["tower_switches"][side]:
                continue
            center = (tx + sign * fortress_width * (.28 + .17 * spread),
                      ty - sign * fortress_width * .18,
                      2.75 + tower_height * .25 + sign * stagger * .20)
            size = (fortress_width * .40, fortress_width * .37,
                    (2.7 + tower_height * .85) * scale)
            towers.append((side + " watchtower", center, size))
    return {"terrace": (tx, ty), "keep": (kx, ky), "crown": (ux, uy),
            "towers": tuple(towers)}

def massing_traits(assembly, genome):
    proposal = describe_massing(genome)
    if proposal is None:
        return ()
    traits = []
    for side in ("west", "east"):
        observed = (side + " watchtower") in assembly.parts
        if observed != proposal["tower_switches"][side]:
            raise ValueError("CAD parts contradict inherited massing proposal")
        traits.append("architecture:watchtower:" + side + ":" +
                      ("present" if observed else "absent"))
    for key in ("terrace_dx","terrace_dy","keep_dx","keep_dy","crown_dx","crown_dy"):
        v = proposal["values"]["arch.massing." + key]
        band = "positive" if v > .15 else "negative" if v < -.15 else "centered"
        traits.append("architecture:massing:" + key + ":" + band)
    return tuple(sorted(traits))
