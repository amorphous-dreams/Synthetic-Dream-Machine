"""Measured perspective camera registration; source truth remains independent."""
import json
from hashlib import sha256
import cv2
import numpy as np
from PIL import Image
import pytest
from projection_loom.source_registration import fit_registration, registered_silhouette
from projection_loom.developmental import GrowthNode, GrowthProgram, compile_growth


def evidence(tmp_path, *, error=0, coplanar=False):
    image = tmp_path / "view.png"
    Image.new("RGBA", (640, 480), (0, 0, 0, 255)).save(image)
    K = np.array([[560., 0, 320], [0, 550, 240], [0, 0, 1.]])
    world = np.array([[-2,-1,0], [1,-1,.8], [2,1,0], [-1,2,1],
                      [0,0,3], [2,-2,3], [-2,1,4], [.5,2,2.4]], float)
    if coplanar:
        world[:, 2] = 0
    xy, _ = cv2.projectPoints(world, np.array([.04,-.08,.02]),
                              np.array([0.,0.,14.]), K, None)
    xy = xy.reshape((-1,2))
    xy[0][0] += error
    anchors = tmp_path / "independent-control.json"
    anchors.write_text(json.dumps({
        "schema": "projection-loom/independent-world-landmarks",
        "kind": "survey_control", "frame": "local3d", "units": "model_unit",
        "landmarks": [{"id": str(i), "world": p.tolist()}
                      for i, p in enumerate(world)]}))
    calibration = tmp_path / "calibration.json"
    calibration.write_text(json.dumps({
        "schema": "projection-loom/measured-perspective-registration",
        "image_sha256": sha256(image.read_bytes()).hexdigest(),
        "anchor_file": "independent-control.json", "intrinsics": K.tolist(),
        "measurements": [{"id": str(i), "pixel": p.tolist()}
                         for i, p in enumerate(xy)],
        "max_rms_px": 1.0}))
    return image, calibration


def test_native_cad_is_projected_under_measured_non_coplanar_camera(tmp_path):
    image, calibration = evidence(tmp_path)
    fitted = fit_registration(image, calibration)
    assert fitted["observed_rms_px"] < .001
    assert fitted["observed_max_px"] < .001
    assert fitted["authority"].startswith("landmark-consistent")
    mesh = compile_growth(GrowthProgram((
        GrowthNode("root", "foundation", size=(5,5,2)),))
    ).assembly.tessellate(union=True)
    mask = registered_silhouette(mesh, fitted)
    assert mask.shape == (480,640) and mask.sum() > 0
    assert registered_silhouette(mesh, fitted, size=(160,120)).shape == (120,160)


def test_inconsistent_world_to_pixel_fit_refused(tmp_path):
    image, calibration = evidence(tmp_path, error=85)
    with pytest.raises(ValueError, match="residual exceeds"):
        fit_registration(image, calibration)


def test_coplanar_points_are_not_metric_calibration(tmp_path):
    image, calibration = evidence(tmp_path, coplanar=True)
    with pytest.raises(ValueError, match="noncoplanar"):
        fit_registration(image, calibration)


def test_source_mutation_and_unlisted_anchor_refused(tmp_path):
    image, calibration = evidence(tmp_path)
    image.write_bytes(b"not the surveyed pixels")
    with pytest.raises(ValueError, match="other image bytes"):
        fit_registration(image, calibration)
    image, calibration = evidence(tmp_path)
    record = json.loads(calibration.read_text())
    record["anchor_file"] = "../escape.json"
    calibration.write_text(json.dumps(record))
    with pytest.raises((ValueError, FileNotFoundError), match="escape|No such file"):
        fit_registration(image, calibration)
