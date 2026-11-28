"""Portable OpenUSD candidate alternatives that keep native evidence independent.

Variant selection is scene presentation, not a new causal frontier or a
quality-diversity operator decision. Source bundles and STEP proofs remain
separate, verified, relatively referenced and transferable as one package.
"""
from __future__ import annotations

from pathlib import Path
import json
import re
import shutil

from .provenance_encoding import canonical_json_sha256
from .scene_usd import validate_scene

_LABEL = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,47}$")


def _read_bundle(directory):
    validate_scene(directory)
    return json.loads((Path(directory) / "manifest.json").read_text(encoding="utf8"))


def build_variants(specification, destination):
    """Compose a portable USD variant set over separately witnessed bundles."""
    from pxr import Sdf, Usd, UsdGeom

    if set(specification) != {"schema", "default", "variants"} or (
            specification["schema"] != "projection-loom/scene-variant-input"):
        raise ValueError("Variant input must declare default and independent source bundles")
    variants = specification["variants"]
    if not isinstance(variants, list) or not 2 <= len(variants) <= 12:
        raise ValueError("Candidate comparison requires 2-12 independent variants")
    names = [v.get("name") for v in variants if isinstance(v, dict)]
    if (len(names) != len(variants) or len(set(names)) != len(names)
            or any(not isinstance(x, str) or not _LABEL.fullmatch(x) for x in names)
            or specification["default"] not in names):
        raise ValueError("Invalid or repeated variant labels")
    candidates = []
    observed_units = None
    observed_location = None
    for variant in variants:
        if not isinstance(variant, dict) or set(variant) != {"name", "bundle"}:
            raise ValueError("Each variant requires one name and one witnessed bundle")
        bundle = Path(variant["bundle"]).resolve()
        evidence = _read_bundle(bundle)
        if observed_units is None:
            observed_units = evidence["meters_per_unit"]
            observed_location = evidence["location"]
        if (evidence["meters_per_unit"] != observed_units
                or evidence["location"] != observed_location):
            raise ValueError("Candidate USD stages have incompatible units or locations")
        candidates.append((variant["name"], bundle, evidence))
    out = Path(destination)
    if out.exists():
        raise ValueError("Comparison output must be a new immutable location")
    out.mkdir(parents=True)
    variant_root = out / "candidates"
    variant_root.mkdir()
    for label, bundle, _ in candidates:
        shutil.copytree(bundle, variant_root / label)
    stage = Usd.Stage.CreateNew(str(out / "comparison.usda"))
    parent = UsdGeom.Xform.Define(stage, "/Candidate").GetPrim()
    stage.SetDefaultPrim(parent)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
    UsdGeom.SetStageMetersPerUnit(stage, float(observed_units))
    variants_set = parent.GetVariantSets().AddVariantSet("candidate")
    for label, _, _ in candidates:
        variants_set.AddVariant(label)
        variants_set.SetVariantSelection(label)
        with variants_set.GetVariantEditContext():
            parent.GetReferences().AddReference(
                f"./candidates/{label}/scene.usda", "/Loom")
    variants_set.SetVariantSelection(specification["default"])
    stage.GetRootLayer().Save()
    evidence = {
        "schema": "projection-loom/scene-variant-comparison",
        "location": observed_location, "meters_per_unit": observed_units,
        "stage": "comparison.usda", "default": specification["default"],
        "variants": [{"name": name, "bundle_sha256": b["sha256"],
                      "body_count": len(b["bodies"])}
                     for name, _, b in candidates],
        "operator_promotion": False, "causal_merge": False}
    report = {**evidence, "sha256": canonical_json_sha256(evidence)}
    (out / "comparison.json").write_text(json.dumps(report, indent=2,
                                                 sort_keys=True) + "\n",
                                         encoding="utf8")
    validate_variants(out)
    return report


def validate_variants(directory):
    """Check each distinct native evidence island and actual USD composition."""
    from pxr import Usd, UsdGeom

    root = Path(directory)
    report = json.loads((root / "comparison.json").read_text(encoding="utf8"))
    claim = {k: v for k, v in report.items() if k != "sha256"}
    if report.get("sha256") != canonical_json_sha256(claim):
        raise ValueError("Candidate comparison digest mismatch")
    stage = Usd.Stage.Open(str(root / report["stage"]))
    if stage is None:
        raise ValueError("OpenUSD comparison stage cannot reopen")
    if UsdGeom.GetStageUpAxis(stage) != UsdGeom.Tokens.z:
        raise ValueError("Variant stage up-axis is unsupported")
    if UsdGeom.GetStageMetersPerUnit(stage) != report["meters_per_unit"]:
        raise ValueError("Variant scene units changed")
    prim = stage.GetPrimAtPath("/Candidate")
    if not prim:
        raise ValueError("Missing variant composition root")
    set_ = prim.GetVariantSets().GetVariantSet("candidate")
    if set(set_.GetVariantNames()) != {v["name"] for v in report["variants"]}:
        raise ValueError("Candidate variant selection does not match receipt")
    for record in report["variants"]:
        bundle = root / "candidates" / record["name"]
        receipt = _read_bundle(bundle)
        if receipt["sha256"] != record["bundle_sha256"]:
            raise ValueError("Candidate underlying native evidence changed")
        if not set_.SetVariantSelection(record["name"]):
            raise ValueError("Cannot select authored USD candidate alternative")
        meshes = [p for p in stage.Traverse()
                  if p.IsA(UsdGeom.Mesh)]
        if len(meshes) != record["body_count"]:
            raise ValueError("Candidate variant lost or gained geometric representations")
    if not set_.SetVariantSelection(report["default"]):
        raise ValueError("Default variant cannot be restored")
    return {"valid": True, "variants": len(report["variants"]),
            "default": report["default"], "operator_promotion": False}
