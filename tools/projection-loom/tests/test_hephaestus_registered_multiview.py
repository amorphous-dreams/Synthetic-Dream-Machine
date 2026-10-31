"""Two independently registered source views condition the one CAD helm.

These are synthetic *test* cameras and landmarks. Passing them does not
certify a physical survey, but demonstrates that independent calibrated
views cannot be silently reduced to one arbitrary oblique observation.
"""
import json
from hashlib import sha256
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import pytest

from projection_loom.source_registration import registered_silhouette
from projection_loom.developmental import GrowthNode, GrowthProgram, compile_growth
from projection_loom.seed_adapters import image_group
from projection_loom.intent_seed import IntentContract
from projection_loom.generalized_campaign import run_cohort, source_alpha


def evidence(tmp_path):
    growth = GrowthProgram((
        GrowthNode("root", "foundation", size=(5,5,2)),
        GrowthNode("tower", "spawn", parent="root", face="up", size=(2,2,2))))
    mesh = compile_growth(growth).assembly.tessellate(union=True)
    controls = np.array([[-2,-1,0], [1,-1,.8], [2,1,0], [-1,2,1],
                         [0,0,3], [2,-2,3], [-2,1,4], [.5,2,2.4]], float)
    anchors = tmp_path / "independent-landmarks.json"
    anchors.write_text(json.dumps({
        "schema": "projection-loom/independent-world-landmarks",
        "kind": "survey_control", "frame": "local3d", "units": "model_unit",
        "landmarks": [{"id": str(i), "world": p.tolist()}
                      for i, p in enumerate(controls)]}))
    K = np.array([[560.,0,320.],[0,550.,240.],[0,0,1.]])
    views = []
    for i in range(2):
        rv = np.array([.04,-.08+i*.09,.02])
        tv = np.array([i*.3,0.,14.])
        rotation, _ = cv2.Rodrigues(rv)
        camera = {"camera": {"size": [640,480], "intrinsics": K.tolist(),
                             "rotation": rotation.tolist(), "translation": tv.tolist()}}
        alpha = registered_silhouette(mesh, camera)
        rgba = Image.new("RGBA",(640,480), (210, 160, 90, 0))
        rgba.putalpha(Image.fromarray(alpha,"L"))
        path = tmp_path / f"source-{i}.png"
        rgba.save(path)
        xy, _ = cv2.projectPoints(controls, rv, tv, K, None)
        cfile = tmp_path / f"camera-{i}.json"
        cfile.write_text(json.dumps({
            "schema": "projection-loom/measured-perspective-registration",
            "image_sha256": sha256(path.read_bytes()).hexdigest(),
            "anchor_file": "independent-landmarks.json",
            "intrinsics": K.tolist(), "measurements": [
                {"id": str(j), "pixel": xy.reshape((-1,2))[j].tolist()}
                for j in range(len(controls))],
            "max_rms_px": 1.0}))
        views.append({"rgba":path.name,"registration":"registered",
                      "calibration":cfile.name, "construction_primary":i==0})
    manifest = tmp_path/"images.json"
    manifest.write_text(json.dumps({"kind":"image-group","views":views}))
    return manifest


def test_two_calibrated_sources_produce_distinct_native_fitness_and_reaudited_finalists(tmp_path):
    adapters = image_group(evidence(tmp_path))
    assert len(adapters)==2 and all(a.registration for a in adapters)
    assert adapters[0].seed.identity != adapters[1].seed.identity
    assert source_alpha(adapters) is None
    intent = IntentContract(
        "independent-registered-place", "photographs are testimony only",
        ("native-validity","source-silhouette","structural-novelty"))
    out = tmp_path/"campaign"
    report = run_cohort(adapters,intent,out,epochs=1,offspring=1,
                        exact_budget=1,finalists=1)
    assert report["status"] == "completed"
    assert report["source_authority"] == "landmark-consistent-multiview"
    assert report["native_valid"] == 1
    epoch = json.loads((out/"epoch_000.json").read_text())
    result = epoch["candidates"][0]
    assert "fitness" in result["metrics"]
    assert len(result["observations"]["registered_source_views"]) == 2
    final = json.loads((out/"finalists"/(report["finalists"][0]["id"]+".json")).read_text())
    assert len(final["full_source"]["registered_source_views"]) == 2
    assert all("source_fit" in v for v in final["full_source"]["registered_source_views"])
    pre = json.loads((out/"pre_registration.json").read_text())
    assert len(pre["independent_source_observations"]) == 2


def test_modified_calibration_is_not_causally_replayable(tmp_path):
    adapters = image_group(evidence(tmp_path))
    entry = adapters[0]
    assert entry.registration is not None
    path = Path(entry.registration["calibration_file"])
    data = json.loads(path.read_text())
    data["max_rms_px"] = 2.0
    path.write_text(json.dumps(data))
    intent = IntentContract("held-out-multiview", "registration changed",
                            ("native-validity", "structural-novelty"))
    with pytest.raises(ValueError, match="calibration changed"):
        run_cohort(adapters, intent, tmp_path/"bad", epochs=1,
                   offspring=1, exact_budget=1, finalists=1)
