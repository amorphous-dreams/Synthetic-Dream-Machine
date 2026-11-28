"""Projection Loom: known-answer orthographic calibration with honest null gates.

Calibration is independent of candidate geometry.  A 3D landmark fixture with
known coordinates identifies the camera.  Separate holdout points challenge it.
A painted Necrospire silhouette alone is not a known 3D-2D calibration target.
"""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares
from .cameras import Camera


@dataclass(frozen=True)
class CalibrationResult:
    camera: Camera
    train_rmse: float
    holdout_rmse: float
    affine_orthogonality_error: float
    affine_scale_anisotropy: float
    view_alignment_deg: float | None
    accepted: bool
    rejected_reason: str | None
    train_count: int
    holdout_count: int

    def as_dict(self):
        return dict(camera=self.camera.to_dict(), train_rmse=self.train_rmse,
                    holdout_rmse=self.holdout_rmse,
                    affine_orthogonality_error=self.affine_orthogonality_error,
                    affine_scale_anisotropy=self.affine_scale_anisotropy,
                    view_alignment_deg=self.view_alignment_deg,
                    accepted=self.accepted, rejected_reason=self.rejected_reason,
                    train_count=self.train_count, holdout_count=self.holdout_count)


def _landmark_quality(xyz, xy):
    if len(xyz) < 6:
        raise ValueError('At least six 3D-2D landmarks required')
    if not np.isfinite(xyz).all() or not np.isfinite(xy).all():
        raise ValueError('Non-finite landmarks')
    rank_xyz = np.linalg.matrix_rank(xyz - xyz.mean(axis=0), tol=1e-7)
    rank_xy = np.linalg.matrix_rank(xy - xy.mean(axis=0), tol=1e-7)
    if rank_xyz != 3 or rank_xy != 2:
        raise ValueError('Degenerate landmark set: insufficient independent axes')


def camera_rmse(camera, xyz, xy, size):
    predicted = camera.project(xyz, size)[0]
    return float(np.sqrt(np.mean(np.sum((predicted - xy)**2, axis=1))))


def calibrate_orthographic(xyz, image_points, *, size=(256, 384), train_indices=None,
                           holdout_indices=None, expected_outward=None,
                           max_view_deviation_deg=30.0, max_holdout_rmse=1.0):
    """Fit an actual scaled ORTHOGRAPHIC camera; no unconstrained affine cheating.

    Two of the three image projection axes must be orthogonal and equally scaled.
    If a known outward view is supplied, its hemisphere/chirality is enforced.
    The independent holdout points are not used to estimate the parameters.
    """
    xyz = np.asarray(xyz, dtype=np.float64)
    xy = np.asarray(image_points, dtype=np.float64)
    if xyz.ndim != 2 or xyz.shape[1] != 3 or xy.shape != (len(xyz), 2):
        raise ValueError('Landmarks must be Nx3 and Nx2')
    if train_indices is None or holdout_indices is None:
        raise ValueError('Separate training and holdout landmark indices required')
    tr = np.asarray(train_indices, dtype=int)
    ho = np.asarray(holdout_indices, dtype=int)
    if len(set(tr)) != len(tr) or len(set(ho)) != len(ho) or len(set(tr) & set(ho)):
        raise ValueError('Holdout leakage or duplicated landmark index')
    if len(ho) < 3 or len(tr) < 6 or min(np.r_[tr, ho]) < 0 or max(np.r_[tr, ho]) >= len(xyz):
        raise ValueError('Insufficient or out-of-range train/holdout indices')
    _landmark_quality(xyz[tr], xy[tr])
    design = np.column_stack([xyz[tr], np.ones(len(tr))])
    coefficients = np.linalg.lstsq(design, xy[tr], rcond=None)[0]
    # Image y is inverted, so the second spatial row is -pixel_y.
    raw_basis = np.stack((coefficients[:3, 0], -coefficients[:3, 1]), axis=0)
    u, singular, vh = np.linalg.svd(raw_basis, full_matrices=False)
    if min(singular) < 1e-7:
        raise ValueError('Scale or 3D projection is degenerate')
    frame = u @ vh
    right, up = frame
    outward = np.cross(right, up)
    angle_e = math.asin(float(np.clip(outward[2], -1, 1)))
    angle_a = math.atan2(float(outward[0]), float(-outward[1]))
    base_right = np.array((math.cos(angle_a), math.sin(angle_a), 0.))
    base_up = np.cross(outward, base_right)
    angle_r = math.atan2(float(np.dot(right, base_up)), float(np.dot(right, base_right)))
    scale = float(np.mean(singular))
    # The regression intercept is the pixel location of world XYZ=(0,0,0).
    guess = np.array([math.degrees(angle_a), math.degrees(angle_e), math.degrees(angle_r),
                      math.log(scale), coefficients[3,0], coefficients[3,1]])

    def camera_of(x):
        return Camera(azimuth=float(x[0]), elevation=float(x[1]), roll=float(x[2]),
                      fit='fixed', pixel_scale=float(np.exp(x[3])), world_anchor=(0,0,0),
                      pixel_center=(float(x[4]), float(x[5])), reference_size=tuple(size))

    def residual(x):
        cam = camera_of(x)
        return (cam.project(xyz[tr], size)[0] - xy[tr]).ravel()

    fit = least_squares(residual, guess, max_nfev=220, ftol=1e-12, xtol=1e-12,
                        gtol=1e-12)
    cam = camera_of(fit.x)
    train_rmse = camera_rmse(cam, xyz[tr], xy[tr], size)
    holdout_rmse = camera_rmse(cam, xyz[ho], xy[ho], size)
    col0, col1 = raw_basis
    orthogonality = float(abs(np.dot(col0, col1) / (np.linalg.norm(col0)*np.linalg.norm(col1))))
    anisotropy = float((max(singular)-min(singular))/np.mean(singular))
    deviation = None
    if expected_outward is not None:
        expected = np.asarray(expected_outward, dtype=np.float64)
        if expected.shape != (3,) or not np.isfinite(expected).all() or np.linalg.norm(expected) < 1e-10:
            raise ValueError('Malformed outward-view prior')
        expected /= np.linalg.norm(expected)
        deviation = math.degrees(math.acos(float(np.clip(cam.basis()[2] @ expected, -1, 1))))
    accepted = bool(holdout_rmse <= max_holdout_rmse and
                    (deviation is None or deviation <= max_view_deviation_deg))
    reason = None if accepted else ('wrong-facing or reflected view' if deviation is not None and
                                   deviation > max_view_deviation_deg else 'holdout reprojection error')
    return CalibrationResult(cam, train_rmse, holdout_rmse, orthogonality, anisotropy,
                             deviation, accepted, reason, len(tr), len(ho))


def reference_evidence_diagnostic(alpha, rgb=None, threshold=96):
    """Reject missing silhouettes; report color/edge nulls without inventing evidence."""
    a = np.asarray(alpha)
    if a.ndim != 2 or not a.size or not np.isfinite(a).all():
        raise ValueError('Alpha mask must be finite HxW')
    occupied = a > threshold
    ratio = float(occupied.mean())
    if not occupied.any():
        return {'status':'null-empty','coverage':ratio,'edge_signal':False}
    if occupied.all():
        return {'status':'null-full-frame','coverage':ratio,'edge_signal':False}
    if rgb is None:
        return {'status':'usable-silhouette','coverage':ratio,'edge_signal':None}
    color = np.asarray(rgb, dtype=np.float64)
    if color.shape != a.shape + (3,) or not np.isfinite(color).all():
        raise ValueError('RGB must align with alpha HxWx3')
    # Premultiply by alpha so arbitrary transparent RGB cannot affect evidence.
    safe_color = color * (a[...,None].astype(float)/255.)
    yy, xx = np.gradient(safe_color.mean(axis=2))
    internal = occupied.copy()
    from scipy.ndimage import binary_erosion
    internal &= binary_erosion(occupied, iterations=2)
    internal_signal = np.hypot(xx, yy)[internal]
    signal = bool(len(internal_signal) and float(np.percentile(internal_signal, 90)) > 0.05)
    return {'status':'usable-silhouette','coverage':ratio,'edge_signal':signal,
            'interior_gradient_p90':float(np.percentile(internal_signal, 90)) if len(internal_signal) else 0.}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def ensure_fixed_evidence_camera(camera):
    if camera.fit != 'fixed' or camera.pixel_scale is None or camera.reference_size is None:
        raise ValueError('Fitness camera must be fixed; independent registration verification remains required')
    return True


def freeze_display_camera(auto_camera, vertices, size):
    """Snapshot *presentation* auto-fit as a fixed viewport; NOT source calibration.

    This is an anti-rubber-camera convenience tool.  It does not establish that
    the chosen angle or scale aligns with any real reference illustration.
    """
    if auto_camera.fit not in ('bounds', 'height'):
        raise ValueError('Expected presentation camera with bounds or height fit')
    xyz = np.asarray(vertices, dtype=float)
    _, _, scale = auto_camera.project(xyz, size)
    right, up, _ = auto_camera.basis()
    u = xyz @ right
    v = xyz @ up
    u_center = (u.min()+u.max())/2
    v_center = (v.min()+v.max())/2
    center = (size[0]/2 - u_center*scale, size[1]/2 + v_center*scale)
    return Camera(azimuth=auto_camera.azimuth, elevation=auto_camera.elevation,
                  roll=auto_camera.roll, fit='fixed', pixel_scale=scale,
                  world_anchor=(0,0,0), pixel_center=tuple(center),
                  reference_size=tuple(size))
