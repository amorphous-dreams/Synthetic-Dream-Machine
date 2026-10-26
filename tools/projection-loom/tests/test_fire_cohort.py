"""Fire cohort consumes sealed six-view evidence, never controls breeding."""
from pathlib import Path
import json
import pytest

from projection_loom.fire_cohort import census, write_census
from projection_loom.fire_review import VIEWS
from projection_loom.provenance_encoding import canonical_json_sha256


def seal(row):
    row.pop("sha256", None)
    row["sha256"] = canonical_json_sha256(row)
    return row


def pair(root, epoch, *, visible=True, changed_seed=False):
    folder = root / f"probe-{epoch}"
    folder.mkdir()
    (folder / "fire_native_orthos.png").write_bytes(b"native-board")
    (folder / "fire_native_differences.png").write_bytes(b"native-delta")
    from hashlib import sha256
    source = {
        "original_witness_id": "source-witness",
        "source_seed_sha256": ("b" if changed_seed else "a")*64,
        "source_recipe_sha256": "recipe",
        "source_construction_digest": "construction",
        "source_genome_sha256": "genome",
    }
    plan = seal({"schema": "projection-loom/fire-bound-plan", "alternatives": [],
                 "resolved": {"a": "a"}, "epoch": epoch})
    native = {"id": "member", "state": "native-admitted", "native_audit":
              {"valid": True, "union_solids": 1}, "witness_id": f"native-{epoch}",
              "part_delta": 1, "added_volume": 2.0}
    native["receipt_sha256"] = canonical_json_sha256(native)
    receipt = seal({"schema": "projection-loom/fire-native-audition",
                    **source, "plan_sha256": plan["sha256"], "plan": plan,
                    "results": [native]})
    native_path = root / f"probe-{epoch}.json"
    native_path.write_text(json.dumps(receipt))
    baseline = {name: {"occupied": 2, "mask_sha256": f"source-{name}"}
                for name in VIEWS}
    views = {}
    for name in VIEWS:
        delta = 1 if visible and name in ("oblique", "front") else 0
        views[name] = {"original_mask_sha256": baseline[name]["mask_sha256"],
                       "variant_mask_sha256": f"mask-{epoch}-{name}" if delta else f"source-{name}",
                       "original_occupied": 2, "variant_occupied": 2+delta,
                       "shared": 2, "appeared": delta, "disappeared": 0,
                       "changed": delta, "silhouette_iou": 2/(2+delta)}
    board = seal({
        "schema": "projection-loom/fire-orthographic-handback",
        "audition_sha256": receipt["sha256"],
        "native_source_witness_id": source["original_witness_id"],
        "source_union_volume": 80.0,
        "cameras": {name: {"frozen":name} for name in VIEWS},
        "original_views": baseline,
        "image": {"path":"fire_native_orthos.png",
                  "sha256":sha256(b"native-board").hexdigest()},
        "differences": {"path":"fire_native_differences.png",
                        "sha256":sha256(b"native-delta").hexdigest()},
        "alternatives": [{"id":"member","native_valid":True,
                          "witness_id":native["witness_id"],"native_part_delta":1,
                          "added_volume":2.0,"views":views,
                          "expressed_in_views": [v for v in VIEWS if views[v]["changed"]]}],
    })
    (folder / "summary.json").write_text(json.dumps(board))
    return native_path, folder


def test_pair_census_uses_verified_source_cameras_and_silhouette_changes(tmp_path):
    a = pair(tmp_path, 1)
    b = pair(tmp_path, 2, visible=False)
    summary = write_census([a,b], tmp_path/"census.json")
    assert summary["native_admitted"] == 2
    assert summary["unique_topology_witnesses"] == 2
    assert summary["unique_six_view_silhouettes"] == 2
    assert summary["visible_source_differences"] == 1
    assert summary["off_oblique_expression"] == 1
    assert summary["candidates"][0]["changed_pixels_all_views"] == 2
    assert summary["candidates"][1]["expressed_views"] == []
    with pytest.raises(ValueError,match="overwrite"):
        write_census([a,b], tmp_path/"census.json")


def test_cohort_refuses_source_drift_and_tampered_native_result(tmp_path):
    a=pair(tmp_path,1)
    b=pair(tmp_path,2,changed_seed=True)
    with pytest.raises(ValueError,match="mixed source"):
        census([a,b])
    receipt=json.loads(b[0].read_text())
    receipt["source_seed_sha256"]="a"*64
    seal(receipt)
    receipt["results"][0]["added_volume"]=3.0
    b[0].write_text(json.dumps(seal(receipt)))
    with pytest.raises(ValueError,match="result digest"):
        census([a,b])


def test_cohort_refuses_camera_changes_and_image_tampering(tmp_path):
    a=pair(tmp_path,1)
    b=pair(tmp_path,2)
    report=json.loads((b[1]/"summary.json").read_text())
    report["cameras"]["top"]["frozen"]="different"
    (b[1]/"summary.json").write_text(json.dumps(seal(report)))
    with pytest.raises(ValueError,match="camera"):
        census([a,b])
    report["cameras"]["top"]["frozen"]="top"
    (b[1]/"summary.json").write_text(json.dumps(seal(report)))
    (b[1]/"fire_native_orthos.png").write_bytes(b"tampered")
    with pytest.raises(ValueError,match="image digest"):
        census([a,b])


def test_cohort_rejects_fake_pixel_arithmetic(tmp_path):
    a=pair(tmp_path,1)
    b=pair(tmp_path,2)
    report=json.loads((b[1]/"summary.json").read_text())
    report["alternatives"][0]["views"]["oblique"]["changed"]=100
    (b[1]/"summary.json").write_text(json.dumps(seal(report)))
    with pytest.raises(ValueError,match="arithmetic"):
        census([a,b])


def test_topology_novelty_can_exist_without_silhouette_novelty(tmp_path):
    first=pair(tmp_path,1,visible=False)
    second=pair(tmp_path,2,visible=False)
    observed=census([first,second])
    assert observed["unique_topology_witnesses"] == 2
    assert observed["unique_six_view_silhouettes"] == 1
    assert observed["candidates"][1]["topology_duplicate_of"] is None
    assert observed["candidates"][1]["visual_duplicate_of"] == "1/member"
