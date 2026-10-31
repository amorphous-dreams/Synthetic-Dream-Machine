"""Bounded Experiment Zero exploration: unchanged source frame inside 2x overscan.

Raster resolution does not enlarge a fixed camera's *world* view. An outer
fixed camera expands the field at identical native pixel scale and translates
the reference frame into the center. Hard limits apply to actual geometry;
visual novelty remains a measured signal, never a native validity override.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
import math

import numpy as np

from .cameras import Camera
from .calibration import freeze_display_camera
from .provenance_encoding import canonical_json_sha256
from .render import silhouette


@dataclass(frozen=True)
class ExplorationBudget:
    overscan: int = 2
    depth_multiplier: float = 2.0
    max_vertices: int = 150000
    max_faces: int = 200000
    score_size: tuple[int, int] = (64, 96)
    review_size: tuple[int, int] = (256, 384)

    def __post_init__(self):
        if type(self.overscan) is not int or self.overscan not in (1, 2):
            raise ValueError("Exploration overscan must be one or two")
        if (not math.isfinite(self.depth_multiplier)
                or not 1 <= self.depth_multiplier <= 4):
            raise ValueError("Finite depth multiplier must be 1..4")
        if (type(self.max_vertices) is not int or self.max_vertices < 100
                or type(self.max_faces) is not int or self.max_faces < 100):
            raise ValueError("Geometry budgets must be finite positive integers")
        for size in (self.score_size, self.review_size):
            if (len(size) != 2 or any(type(x) is not int or
                    not 32 <= x <= 2048 for x in size)):
                raise ValueError("Image budget must have bounded integer dimensions")
        if self.review_size[0] * self.score_size[1] != self.review_size[1] * self.score_size[0]:
            raise ValueError("Review and scoring viewports must share aspect ratio")

    def record(self):
        data = {"schema": "projection-loom/exploration-budget",
                "overscan": self.overscan,
                "depth_multiplier": float(self.depth_multiplier),
                "max_vertices": self.max_vertices, "max_faces": self.max_faces,
                "score_size": list(self.score_size),
                "review_size": list(self.review_size),
                "selection_authority": "review-only; independent native CAD/void admission"}
        data["sha256"] = canonical_json_sha256(data)
        return data


def overscan_camera(reference: Camera, factor=2):
    """Keep original pixel/world scale; extend W,H around original frame."""
    if reference.fit != "fixed" or reference.reference_size is None:
        raise ValueError("Overscan requires a fixed camera with a native reference frame")
    if type(factor) is not int or factor not in (1, 2):
        raise ValueError("Overscan factor must be one or two")
    w, h = reference.reference_size
    pixel = reference.pixel_center or (w / 2, h / 2)
    return Camera(azimuth=reference.azimuth, elevation=reference.elevation,
                  roll=reference.roll, fit="fixed", margin=reference.margin,
                  pixel_scale=reference.pixel_scale,
                  world_anchor=reference.world_anchor,
                  pixel_center=(pixel[0] + w * (factor - 1) / 2,
                                pixel[1] + h * (factor - 1) / 2),
                  reference_size=(w * factor, h * factor))


def core_crop(outer, size, factor):
    """Restore the original scoring pixels from a larger physical field."""
    w, h = size
    if outer.shape != (h * factor, w * factor):
        raise ValueError("Overscan array does not match its declared core size")
    x, y = (factor - 1) * w // 2, (factor - 1) * h // 2
    if (factor - 1) * w % 2 or (factor - 1) * h % 2:
        raise ValueError("Core dimensions must center exactly in overscan")
    return outer[y:y+h, x:x+w]


def _geometry(mesh):
    xyz = np.asarray(mesh.vertices, dtype=float)
    if xyz.ndim != 2 or xyz.shape[1] != 3 or not xyz.size or not np.isfinite(xyz).all():
        raise ValueError("Expected finite 3D mesh")
    return xyz


def audit_envelope(mesh, reference: Camera, seed_mesh, budget: ExplorationBudget):
    """Reject overly large or deep geometry BEFORE creating review buffers."""
    xyz = _geometry(mesh)
    seed = _geometry(seed_mesh)
    faces = len(mesh.faces)
    if len(xyz) > budget.max_vertices or faces > budget.max_faces:
        raise ValueError("Scene exceeds explicit vertex/triangle budget")
    outer = overscan_camera(reference, budget.overscan)
    w, h = budget.score_size
    projected, _, _ = outer.project(xyz, (w * budget.overscan, h * budget.overscan))
    if (projected[:, 0].min() < 0 or projected[:, 0].max() >= w * budget.overscan
            or projected[:, 1].min() < 0 or projected[:, 1].max() >= h * budget.overscan):
        raise ValueError("Geometry exceeds the 2D exploration envelope")
    outward = reference.basis()[2]
    anchor = np.asarray(reference.world_anchor, dtype=float)
    depths = (xyz - anchor) @ outward
    seed_depths = (seed - anchor) @ outward
    middle = (seed_depths.min() + seed_depths.max()) / 2
    radius = max(float(np.ptp(seed_depths)) / 2, .5) * budget.depth_multiplier
    if depths.min() < middle - radius or depths.max() > middle + radius:
        raise ValueError("Geometry exceeds its anchored world-depth budget")
    return {"vertices": len(xyz), "faces": faces,
            "depth_min": float(depths.min()), "depth_max": float(depths.max()),
            "depth_anchor": float(middle), "depth_radius": float(radius),
            "projected_bounds": [float(projected[:, 0].min()),
                                 float(projected[:, 1].min()),
                                 float(projected[:, 0].max()),
                                 float(projected[:, 1].max())]}


def measure_exploration(mesh, reference: Camera, seed_mesh, budget: ExplorationBudget):
    """Keep source-fitness independent of measured extra-frame morphology."""
    audit = audit_envelope(mesh, reference, seed_mesh, budget)
    w, h = budget.score_size
    outer = overscan_camera(reference, budget.overscan)
    mask = silhouette(mesh, outer,
                      (w * budget.overscan, h * budget.overscan)) > 96
    core = core_crop(mask, (w, h), budget.overscan)
    extra = mask.copy()
    x = (budget.overscan - 1) * w // 2
    y = (budget.overscan - 1) * h // 2
    extra[y:y+h, x:x+w] = False
    return {
        "schema": "projection-loom/exploration-observation",
        "budget_sha256": budget.record()["sha256"],
        "core_mask_sha256": sha256(core.astype(np.uint8).tobytes()).hexdigest(),
        "outer_mask_sha256": sha256(mask.astype(np.uint8).tobytes()).hexdigest(),
        "core_occupied": int(core.sum()), "extra_occupied": int(extra.sum()),
        "extra_fraction": float(extra.sum() / max(1, mask.sum())),
        "native_geometry": audit,
        "evidence_state": "source-frame projection and observed geometry; not survey registration"
    }


def stable_orthographic_cameras(project, seed_mesh, size):
    """Freeze all review views from the *same seed*, never each candidate."""
    seed = _geometry(seed_mesh)
    result = {}
    for name, camera in sorted(project.cameras.items()):
        if name == project.reference_view:
            result[name] = camera
        elif camera.fit == "fixed":
            result[name] = camera
        else:
            result[name] = freeze_display_camera(camera, seed, size)
    return result
