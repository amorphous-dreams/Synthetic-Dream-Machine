"""Multiple source images remain independent; do not manufacture fused cameras."""
import json

from PIL import Image, ImageDraw
import pytest

from projection_loom.intent_seed import IntentContract
from projection_loom.seed_adapters import image_group
from projection_loom.generalized_campaign import initial_program, source_alpha, run_cohort


def build_manifest(tmp_path, *, primary=False):
    views = []
    for i in range(2):
        im = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
        ImageDraw.Draw(im).rectangle((10 + i * 5, 8, 49, 91),
                                     fill=(220, 130, 45, 255))
        im.save(tmp_path / f"view{i}.png")
        v = {"rgba": f"view{i}.png", "registration": "provisional"}
        if primary and i == 0:
            v["construction_primary"] = True
        views.append(v)
    manifest = tmp_path / "sources.json"
    manifest.write_text(json.dumps({"kind": "image-group", "views": views}))
    return manifest


def test_multiview_requires_authored_primary_if_no_constructive_producer(tmp_path):
    manifest = build_manifest(tmp_path)
    adapters = image_group(manifest)
    assert len(adapters) == 2
    assert adapters[0].seed.identity != adapters[1].seed.identity
    with pytest.raises(ValueError, match="construction primary"):
        initial_program(adapters)
    assert source_alpha(adapters) is None


def test_held_out_multiview_abstains_from_unverified_source_fit(tmp_path):
    adapters = image_group(build_manifest(tmp_path, primary=True))
    program = initial_program(adapters)
    assert program.nodes[0].key == "root"
    contract = IntentContract(
        "held-out-multi-photo", "provisional native hypothesis without camera claims",
        ("native-validity", "source-silhouette", "structural-novelty"))
    report = run_cohort(adapters, contract, tmp_path / "campaign",
                        epochs=1, offspring=1, exact_budget=1, finalists=1)
    assert report["status"] == "completed"
    assert report["source_authority"] == "withheld-uncalibrated-multiview"
    assert report["native_valid"] >= 1
    assert report["finalists"][0]["full_source"] is None
    prereg = json.loads((tmp_path / "campaign" / "pre_registration.json").read_text())
    assert len(prereg["independent_source_observations"]) == 2


def test_duplicate_visual_primary_is_refused(tmp_path):
    manifest = build_manifest(tmp_path, primary=True)
    d = json.loads(manifest.read_text())
    d["views"][1]["construction_primary"] = True
    manifest.write_text(json.dumps(d))
    with pytest.raises(ValueError, match="Only one"):
        image_group(manifest)
