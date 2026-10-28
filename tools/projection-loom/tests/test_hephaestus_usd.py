"""Actual OpenUSD stage + STEP import/export portability witnesses."""
import json
import shutil
import pytest

from projection_loom.scene_usd import package_scene, validate_scene


def declared():
    def node(name, width):
        return {"entity_id": name, "growth_program": {"nodes": [
            {"key": "root", "op": "foundation", "size": [width, width, 2]},
            {"key": "dais", "op": "spawn", "parent": "root",
             "face": "up", "size": [1.5, 1.5, 1.0]}]}}
    return {"schema": "projection-loom/scene-declaration",
            "location": "independent-village",
            "meters_per_unit": 1.0,
            "assemblies": [node("terrace-a", 5), node("terrace-b", 6)]}


def test_real_native_usd_step_bundle_roundtrip(tmp_path):
    from pxr import Usd, UsdGeom
    package = tmp_path / "bundle"
    manifest = package_scene(declared(), package)
    assert manifest["schema"] == "projection-loom/portable-scene-bundle"
    assert len(manifest["bodies"]) == 2
    assert manifest["engineering_load_certification"] is False
    assert validate_scene(package)["valid"]
    stage = Usd.Stage.Open(str(package / "scene.usda"))
    assert UsdGeom.GetStageUpAxis(stage) == UsdGeom.Tokens.z
    assert len([p for p in stage.Traverse() if p.IsA(UsdGeom.Mesh)]) == 2
    assert stage.GetRootLayer().subLayerPaths == ["presentation.usda", "generated.usda"]
    relocated = tmp_path / "portable-copy"
    shutil.copytree(package, relocated)
    assert validate_scene(relocated)["valid"]


def test_usd_and_step_asset_tamper_refused(tmp_path):
    folder = tmp_path / "s"
    package_scene(declared(), folder)
    path = folder / "generated.usda"
    path.write_text(path.read_text() + "\n# malicious manipulation\n")
    with pytest.raises(ValueError, match="digest mismatch"):
        validate_scene(folder)


def test_source_frame_and_entity_collisions_refused(tmp_path):
    data = declared()
    data["meters_per_unit"] = 0
    with pytest.raises(ValueError, match="meters-per-model-unit"):
        package_scene(data, tmp_path / "bad")
    data = declared()
    data["assemblies"][1]["entity_id"] = "terrace_a"
    with pytest.raises(ValueError, match="prim path"):
        package_scene(data, tmp_path / "collision")
    data = declared()
    data["assemblies"][1]["entity_id"] = data["assemblies"][0]["entity_id"]
    with pytest.raises(ValueError, match="Ambiguous"):
        package_scene(data, tmp_path / "duplicates")


def test_cli_scene_package_and_validate(tmp_path):
    from projection_loom.cli import main
    declaration = tmp_path / "source.json"
    declaration.write_text(json.dumps(declared()))
    out = tmp_path / "scene"
    main(["scene-package", "--declaration", str(declaration), "--out", str(out)])
    assert main(["scene-validate", "--bundle", str(out)])["valid"]

def test_native_cache_reuses_verified_unchanged_step_and_usd(tmp_path):
    from copy import deepcopy
    original = declared()
    before = tmp_path / "before"
    package_scene(original, before)
    after = deepcopy(original)
    after["assemblies"][0]["translation"] = [8, 0, 0]
    output = package_scene(after, tmp_path / "after",
                           reuse_bundle=before, previous_document=original)
    assert output["cache"]["reused_entities"] == ["terrace-b"]
    assert output["cache"]["native_rebuilt_entities"] == ["terrace-a"]
    assert output["cache"]["actual_native_cache_reuse"] == 1
    assert validate_scene(tmp_path / "after")["valid"]
    assert (before / "native/001_terrace_b.step").read_bytes() == (
        tmp_path / "after" / "native/001_terrace_b.step").read_bytes()
    with pytest.raises(ValueError, match="provenance or coordinate units disagree"):
        package_scene(after, tmp_path / "bad",
                      reuse_bundle=before, previous_document=after)


def test_native_cache_rejects_tampered_prior_bundle(tmp_path):
    original = declared()
    before = tmp_path / "before"
    package_scene(original, before)
    step = before / "native/000_terrace_a.step"
    with step.open("ab") as stream:
        stream.write(b"tampered")
    with pytest.raises(ValueError, match="digest mismatch"):
        package_scene(original, tmp_path / "after",
                      reuse_bundle=before, previous_document=original)



def test_manifest_digest_rewrite_cannot_add_unwitnessed_step_or_stage(tmp_path):
    from projection_loom.provenance_encoding import canonical_json_sha256
    root = tmp_path / "bundle"
    package_scene(declared(), root)
    path = root / "manifest.json"
    original = json.loads(path.read_text())

    def forged(patch):
        manifest = json.loads(json.dumps(original))
        patch(manifest)
        payload = {k: value for k, value in manifest.items() if k != "sha256"}
        manifest["sha256"] = canonical_json_sha256(payload)
        path.write_text(json.dumps(manifest))
    forged(lambda doc: doc["bodies"][0].update(
        step_path="../../not-witnessed.step"))
    with pytest.raises(ValueError, match="STEP must live|inventory"):
        validate_scene(root)
    forged(lambda doc: doc.update(stage="invisible.usda"))
    with pytest.raises(ValueError, match="Unexpected root stage path"):
        validate_scene(root)
    forged(lambda doc: doc["bodies"].append(
        json.loads(json.dumps(doc["bodies"][0]))))
    with pytest.raises(ValueError, match="Duplicate semantic body"):
        validate_scene(root)


def test_manifest_refuses_untracked_openusd_sublayer(tmp_path):
    from projection_loom.provenance_encoding import canonical_json_sha256
    from hashlib import sha256
    root = tmp_path / "bundle"
    package_scene(declared(), root)
    stage_path = root / "scene.usda"
    stage_path.write_text(
        stage_path.read_text().replace(
            '@presentation.usda@, @generated.usda@',
            '@presentation.usda@, @generated.usda@, @../outside.usda@'))
    data = json.loads((root / "manifest.json").read_text())
    data["assets"]["scene.usda"] = sha256(stage_path.read_bytes()).hexdigest()
    payload = {k: v for k, v in data.items() if k != "sha256"}
    data["sha256"] = canonical_json_sha256(payload)
    (root / "manifest.json").write_text(json.dumps(data))
    # If the format changes, the test should fail rather than silently pass.
    assert "@../outside.usda@" in stage_path.read_text()
    with pytest.raises(ValueError, match="Unaccounted OpenUSD sublayer"):
        validate_scene(root)
