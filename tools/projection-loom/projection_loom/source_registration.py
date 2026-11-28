"""Audited pinhole camera from independently recorded local3d survey landmarks.

A low reprojection residual verifies internal landmark consistency. It does
not independently certify survey accuracy, real-world metric dimensions,
occupancy, load, or a source image's asserted scene interpretation.
"""
from __future__ import annotations
from hashlib import sha256
from pathlib import Path
import json
import math
import cv2
import numpy as np
from PIL import Image
from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/measured-perspective-registration"
ANCHOR_SCHEMA = "projection-loom/independent-world-landmarks"


def _within(root, reference):
    if not isinstance(reference, str) or not reference:
        raise ValueError("Invalid control evidence path")
    path = (Path(root) / reference).resolve(strict=True)
    if not path.is_file() or not path.is_relative_to(Path(root).resolve()):
        raise ValueError("Registered evidence escapes the source boundary")
    return path


def _numeric(value, shape, label):
    raw = np.asarray(value)
    if raw.shape != shape or not np.issubdtype(raw.dtype, np.number):
        raise ValueError(f"{label} dimensions invalid")
    array = np.asarray(raw, dtype=np.float64)
    if not np.isfinite(array).all():
        raise ValueError(f"{label} requires finite values")
    return array


def fit_registration(image, calibration):
    image, calibration = Path(image).resolve(strict=True), Path(calibration).resolve(strict=True)
    reg = json.loads(calibration.read_text(encoding="utf8"))
    if (not isinstance(reg, dict) or
            set(reg) != {"schema", "image_sha256", "anchor_file", "intrinsics",
                         "measurements", "max_rms_px"} or reg["schema"] != SCHEMA):
        raise ValueError("Missing measured camera registration contract")
    image_sha = sha256(image.read_bytes()).hexdigest()
    if reg["image_sha256"] != image_sha:
        raise ValueError("Camera registration refers to other image bytes")
    with Image.open(image) as im:
        width, height = im.size
    if not 16 <= width <= 8192 or not 16 <= height <= 8192:
        raise ValueError("Image is outside registered dimension limits")
    anchor_path = _within(calibration.parent, reg["anchor_file"])
    controls = json.loads(anchor_path.read_text(encoding="utf8"))
    if (not isinstance(controls, dict) or
            set(controls) != {"schema", "kind", "frame", "units", "landmarks"}
            or controls["schema"] != ANCHOR_SCHEMA or controls["kind"] != "survey_control"
            or controls["frame"] != "local3d" or controls["units"] != "model_unit"):
        raise ValueError("Independent 3D model-unit survey control required")
    points = controls["landmarks"]
    if not isinstance(points, list) or not 6 <= len(points) <= 128:
        raise ValueError("Six to 128 unique 3D controls required")
    sites = {}
    for item in points:
        if (not isinstance(item, dict) or set(item) != {"id", "world"}
                or not isinstance(item["id"], str) or not item["id"] or item["id"] in sites):
            raise ValueError("Duplicated or missing independent landmark ID")
        sites[item["id"]] = _numeric(item["world"], (3,), "world landmark")
    observations = reg["measurements"]
    if not isinstance(observations, list) or not 6 <= len(observations) <= 128:
        raise ValueError("Six to 128 measured pixel correspondences required")
    world, pixels, ids = [], [], []
    for item in observations:
        if not isinstance(item, dict) or set(item) != {"id", "pixel"} or item["id"] not in sites:
            raise ValueError("Pixel observation lacks attributed independent world control")
        coordinate = _numeric(item["pixel"], (2,), "pixel landmark")
        if not 0 <= coordinate[0] < width or not 0 <= coordinate[1] < height:
            raise ValueError("Control observation lies outside image")
        ids.append(item["id"])
        world.append(sites[item["id"]])
        pixels.append(coordinate)
    if len(set(ids)) != len(ids):
        raise ValueError("Repeated image control correspondence")
    world, pixels = np.asarray(world), np.asarray(pixels)
    if np.linalg.matrix_rank(world - world.mean(axis=0), tol=1e-7) < 3:
        raise ValueError("Registration requires noncoplanar 3D controls")
    if np.linalg.matrix_rank(pixels - pixels.mean(axis=0), tol=1e-7) < 2:
        raise ValueError("Registration requires independent 2D pixels")
    K = _numeric(reg["intrinsics"], (3, 3), "camera intrinsic matrix")
    if (K[0, 0] <= 0 or K[1, 1] <= 0 or
            K[0, 1] != 0 or K[1, 0] != 0 or list(K[2]) != [0., 0., 1.]
            or not 0 <= K[0, 2] < width or not 0 <= K[1, 2] < height):
        raise ValueError("Only explicit positive pinhole intrinsics are supported")
    limit = reg["max_rms_px"]
    if type(limit) not in (float, int) or not math.isfinite(limit) or not .05 <= limit <= 3:
        raise ValueError("Bounded explicit RMS error threshold required")
    ok, rvec, tvec = cv2.solvePnP(world, pixels, K, None,
                                 flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        raise ValueError("PnP camera solve did not converge")
    projections, _ = cv2.projectPoints(world, rvec, tvec, K, None)
    errors = np.linalg.norm(projections.reshape((-1, 2)) - pixels, axis=1)
    rms, worst = float(np.sqrt(np.mean(errors**2))), float(errors.max())
    rotation, _ = cv2.Rodrigues(rvec)
    depth = (world @ rotation.T + tvec.reshape((1, 3)))[:, 2]
    if np.any(depth <= .01):
        raise ValueError("Survey controls behind camera")
    if rms > limit or worst > 2 * limit:
        raise ValueError("Measured camera residual exceeds declared bound")
    report = {"schema": SCHEMA, "image_sha256": image_sha,
              "calibration_sha256": sha256(calibration.read_bytes()).hexdigest(),
              "anchor_sha256": sha256(anchor_path.read_bytes()).hexdigest(),
              "control_file": str(anchor_path),
              "camera": {"intrinsics": K.tolist(), "rotation": rotation.tolist(),
                         "translation": tvec.reshape((3,)).tolist(),
                         "size": [width, height]},
              "observed_rms_px": rms, "observed_max_px": worst,
              "max_rms_px": float(limit), "controls": ids,
              "authority": "landmark-consistent; survey-not-independently-certified"}
    return {**report, "sha256": canonical_json_sha256(report)}


def registered_silhouette(mesh, registration, *, size=None):
    """Project native triangles using the measured camera, not a synthetic ortho."""
    camera = registration["camera"]
    width, height = map(int, camera["size"] if size is None else size)
    if not 16 <= width <= 8192 or not 16 <= height <= 8192:
        raise ValueError("Registered output dimensions out of bounds")
    k = _numeric(camera["intrinsics"], (3, 3), "intrinsics").copy()
    k[0] *= width / camera["size"][0]
    k[1] *= height / camera["size"][1]
    rot = _numeric(camera["rotation"], (3, 3), "camera rotation")
    t = _numeric(camera["translation"], (3,), "camera translation")
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if vertices.ndim != 2 or vertices.shape[1] != 3 or not np.isfinite(vertices).all():
        raise ValueError("Native mesh vertices invalid")
    depth = (vertices @ rot.T + t)[:, 2]
    rvec, _ = cv2.Rodrigues(rot)
    xy, _ = cv2.projectPoints(vertices, rvec, t, k, None)
    xy = xy.reshape((-1, 2))
    if not np.isfinite(xy).all():
        raise ValueError("Native camera projection not finite")
    mask = np.zeros((height, width), dtype=np.uint8)
    for face in faces:
        if len(face) != 3 or np.any(face < 0) or np.any(face >= len(vertices)):
            raise ValueError("Invalid native mesh indices")
        if np.any(depth[face] <= .01):
            continue  # never draw behind-camera triangles across a source image
        polygon = np.clip(np.rint(xy[face]), -100000, 100000).astype(np.int32)
        cv2.fillConvexPoly(mask, polygon, 255, lineType=cv2.LINE_8)
    return mask
