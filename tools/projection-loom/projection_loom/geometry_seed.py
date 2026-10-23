"""Direct mesh re-entry and constrained deformation of inherited geometry.

An imported mesh stays the reference surface for subsequent shape search. The
control parameters deform its existing vertices in the project's coordinate
frame; no source-specific procedural rig is required.
"""
from pathlib import Path
import numpy as np
from .geometry import Mesh

DEFORMATION_BOUNDS = {
    'scale_x': (0.85, 1.15),
    'scale_y': (0.85, 1.15),
    'scale_z': (0.90, 1.10),
    'shear_xz': (-0.10, 0.10),
    'shear_yz': (-0.10, 0.10),
    'twist_z': (-0.15, 0.15),
    'bend_x': (-0.12, 0.12),
    'bend_y': (-0.12, 0.12),
    'upper_spread_x': (-0.15, 0.15),
    'upper_spread_y': (-0.15, 0.15),
    'waist_x': (-0.10, 0.10),
    'waist_y': (-0.10, 0.10),
}

IDENTITY = {name: (1.0 if name.startswith('scale_') else 0.0) for name in DEFORMATION_BOUNDS}


def seeded_builder(mesh: Mesh):
    """Return a project builder that deforms a held copy of an imported mesh."""
    if not isinstance(mesh, Mesh):
        raise TypeError('Expected Mesh')
    master = np.asarray(mesh.vertices, dtype=np.float64).copy()
    origin = (master.max(axis=0) + master.min(axis=0)) / 2
    span = np.maximum(master.max(axis=0) - master.min(axis=0), 1e-6)
    center = master - origin
    height = np.clip((master[:, 2] - master[:, 2].min()) / span[2], 0, 1)

    def build(params, detail_level=0):
        p = {**IDENTITY, **params}
        xyz = center.copy()
        # Each deformation uses dimensionless parameters measured against the
        # original asset bounds. The lowest end of the object's long axis is a
        # stable bend/twist anchor; the original world origin is preserved.
        bulge = np.sin(np.pi * height)
        upper = np.clip((height - .66) / .34, 0, 1)
        upper = upper * upper * (3 - 2 * upper)
        xyz[:, 0] *= p['scale_x'] * (1 + p['waist_x'] * bulge + p['upper_spread_x'] * upper)
        xyz[:, 1] *= p['scale_y'] * (1 + p['waist_y'] * bulge + p['upper_spread_y'] * upper)
        xyz[:, 2] *= p['scale_z']
        twist = p['twist_z'] * height
        cos_t = np.cos(twist)
        sin_t = np.sin(twist)
        xnew = xyz[:, 0] * cos_t - xyz[:, 1] * sin_t
        ynew = xyz[:, 0] * sin_t + xyz[:, 1] * cos_t
        xyz[:, 0] = xnew + span[0] * (p['shear_xz'] * height + p['bend_x'] * height**2)
        xyz[:, 1] = ynew + span[1] * (p['shear_yz'] * height + p['bend_y'] * height**2)
        xyz += origin
        return Mesh(xyz.astype(np.float32), mesh.faces.copy(),
                    mesh.materials.copy(), mesh.edges.copy(),
                    [dict(x) for x in mesh.parts])

    return build


def imported_geometry(path):
    """Accept portable NPZ checkpoints or common interchange mesh formats."""
    return Mesh.from_file(Path(path))
