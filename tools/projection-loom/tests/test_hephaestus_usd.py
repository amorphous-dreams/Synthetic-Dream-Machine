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
