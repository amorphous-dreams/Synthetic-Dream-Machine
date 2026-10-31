"""Experiment Zero frame semantics, finite budgets and fixed comparable views."""
from dataclasses import replace
import numpy as np
import pytest

from projection_loom.cameras import Camera
from projection_loom.exploration import (
    ExplorationBudget, overscan_camera, core_crop, audit_envelope,
    measure_exploration, stable_orthographic_cameras)


class TriMesh:
    def __init__(self, vertices, faces=None):
        self.vertices = np.asarray(vertices, dtype=float)
        self.faces = np.asarray(faces if faces is not None else [(0, 1, 2)], dtype=int)


def camera():
    return Camera(azimuth=42, elevation=17, fit="fixed", pixel_scale=10.,
                  world_anchor=(0., 0., 0.), pixel_center=(51., 70.),
                  reference_size=(100, 150))


def mesh():
    return TriMesh([(-.4, 0., 0.), (.4, 0., 0.), (0., 0., .5)])


def test_same_physical_scale_and_exact_center_crop():
    c = camera()
    outer = overscan_camera(c, 2)
    xyz = mesh().vertices
    inner_xy = c.project(xyz, (100, 150))[0]
    outer_xy = outer.project(xyz, (200, 300))[0]
    assert np.allclose(outer_xy - inner_xy, [50, 75])
    assert outer.pixel_scale == c.pixel_scale
    assert outer.reference_size == (200, 300)
    image = np.arange(8 * 12).reshape(8, 12)
    assert np.array_equal(core_crop(image, (6, 4), 2), image[2:6, 3:9])


def test_budget_depth_mesh_and_overscan_guards():
    c, seed = camera(), mesh()
    budget = ExplorationBudget(score_size=(64, 96))
    assert audit_envelope(seed, c, seed, budget)["faces"] == 1
    too_deep = TriMesh(seed.vertices + np.array([0, -80, 0]))
    with pytest.raises(ValueError, match="depth|envelope"):
        audit_envelope(too_deep, c, seed, budget)
    too_many_faces = TriMesh(seed.vertices, faces=[(0, 1, 2)] * 101)
    with pytest.raises(ValueError, match="triangle"):
        audit_envelope(too_many_faces, c, seed, replace(budget, max_faces=100))
    with pytest.raises(ValueError, match="Overscan"):
        overscan_camera(c, 3)


def test_orthographic_views_are_seed_frozen():
    class Project:
        reference_view = "oblique"
        cameras = {"oblique": camera(), "side": Camera(azimuth=90, fit="bounds")}
    cams = stable_orthographic_cameras(Project, mesh(), (64, 96))
    assert cams["oblique"] == Project.cameras["oblique"]
    assert cams["side"].fit == "fixed"
    assert cams["side"].reference_size == (64, 96)


def test_exploration_receipt_separates_cores_from_overscan():
    seed = mesh()
    result = measure_exploration(seed, camera(), seed, ExplorationBudget())
    assert result["core_occupied"] > 0
    assert result["extra_occupied"] >= 0
    assert result["native_geometry"]["faces"] == 1
