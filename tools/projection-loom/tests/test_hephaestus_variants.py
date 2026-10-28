"""OpenUSD variant composition uses real verified native bundles."""
import shutil
import pytest

from projection_loom.scene_usd import package_scene
from projection_loom.scene_variants import build_variants, validate_variants


def declaration(width):
    return {"schema": "projection-loom/scene-declaration",
            "location": "same-independent-place", "meters_per_unit": 1.0,
            "assemblies": [{"entity_id": "terrace", "growth_program": {"nodes": [
                {"key": "root", "op": "foundation", "size": [width, width, 2]},
                {"key": "roof", "op": "spawn", "parent": "root",
                 "face": "up", "size": [1.3, 1.3, 1]}]}}]}


def inputs(a, b):
    return {"schema": "projection-loom/scene-variant-input",
            "default": "A", "variants": [
                {"name": "A", "bundle": str(a)},
                {"name": "B", "bundle": str(b)}]}


def test_real_variants_are_portable_and_not_evolutionary_winners(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    package_scene(declaration(5), a)
    package_scene(declaration(7), b)
    compare = tmp_path / "comparison"
    result = build_variants(inputs(a, b), compare)
    assert result["operator_promotion"] is False
    assert result["causal_merge"] is False
    assert validate_variants(compare) == {
        "valid": True, "variants": 2, "default": "A",
        "operator_promotion": False}
    copied = tmp_path / "portable"
    shutil.copytree(compare, copied)
    assert validate_variants(copied)["valid"]


def test_variants_refuse_unit_conflict_or_tampering(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    package_scene(declaration(5), a)
    altered = declaration(7)
    altered["meters_per_unit"] = 0.01
    package_scene(altered, b)
    with pytest.raises(ValueError, match="incompatible units"):
        build_variants(inputs(a, b), tmp_path / "bad")
    shutil.rmtree(b)
    package_scene(declaration(7), b)
    compare = tmp_path / "good"
    build_variants(inputs(a, b), compare)
    f = compare / "candidates" / "A" / "generated.usda"
    f.write_text(f.read_text() + "\n# tampered")
    with pytest.raises(ValueError, match="digest mismatch"):
        validate_variants(compare)
