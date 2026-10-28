"""Portable native-CAD / OpenUSD interop: auditable meshes are not BReps.

OpenUSD composes representation and operator presentation, while native
CadQuery audits/STEP remain the only exact geometry claims. Every semantic
binding is explicit; no path, hash or unnamed mesh creates a location entity.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math
from pathlib import Path
import re

from .developmental import GrowthProgram, compile_growth
from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/portable-scene-bundle"
_safe = re.compile(r"[^a-zA-Z0-9_]")


def _digest_file(path):
    return sha256(Path(path).read_bytes()).hexdigest()


def _prim_name(value):
    raw = _safe.sub("_", value)
    if not raw or not (raw[0].isalpha() or raw[0] == "_"):
        raw = "_" + raw
    return raw


def _bounds(shape):
    box = shape.BoundingBox()
    return [float(x) for x in (box.xmin, box.ymin, box.zmin,
                                box.xmax, box.ymax, box.zmax)]


def _compare_native(original, restored, *, volume_tol=1e-5, bounds_tol=2e-4):
    if (not original.isValid() or not restored.isValid()
            or len(original.Solids()) != len(restored.Solids())):
        raise ValueError("STEP re-import changed solid validity or count")
    volume = float(original.Volume())
    recovered = float(restored.Volume())
    if abs(volume - recovered) > volume_tol * max(1.0, volume):
        raise ValueError("STEP re-import changed measured native volume")
    bbox = _bounds(original)
    restored_bounds = _bounds(restored)
    if max(abs(x - y) for x, y in zip(bbox, restored_bounds)) > bounds_tol:
        raise ValueError("STEP re-import changed native bounding extent")
    return {"valid": True, "solids": len(restored.Solids()),
            "native_volume": volume, "step_volume": recovered,
            "native_bounds": bbox, "step_bounds": restored_bounds,
            "volume_tol": volume_tol, "bounds_tol": bounds_tol}


def _validate_declaration(document):
    if set(document) != {"schema", "location", "assemblies", "meters_per_unit"}:
        raise ValueError("Scene declaration requires explicit location, assemblies and units")
    if document["schema"] != "projection-loom/scene-declaration":
        raise ValueError("Unknown scene declaration")
    if not isinstance(document["location"], str) or not document["location"]:
        raise ValueError("Scene location must be named")
    m = document["meters_per_unit"]
    if type(m) not in (int, float) or not math.isfinite(m) or m <= 0:
        raise ValueError("Author must declare valid meters-per-model-unit")
    rows = document["assemblies"]
    if not isinstance(rows, list) or not rows:
        raise ValueError("At least one independently authored assembly required")
    ids = set()
    paths = set()
    for row in rows:
        if set(row) != {"entity_id", "growth_program"}:
            raise ValueError("Each assembly needs exactly a semantic ID and a native program")
        identifier = row["entity_id"]
        if not isinstance(identifier, str) or not identifier or identifier in ids:
            raise ValueError("Ambiguous or missing semantic entity ID")
        ids.add(identifier)
        path = _prim_name(identifier)
        if path in paths:
            raise ValueError("Distinct entities would collide at an authored prim path")
        paths.add(path)
        GrowthProgram.from_dict(row["growth_program"])


def package_scene(document, out):
    """Construct, audit, export and independently reopen a portable scene."""
    from pxr import Sdf, Usd, UsdGeom
    import cadquery as cq

    _validate_declaration(document)
    out = Path(out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Scene output must be empty; never overwrite old witnesses")
    out.mkdir(parents=True, exist_ok=True)
    native_dir = out / "native"
    native_dir.mkdir()
    generated = Usd.Stage.CreateNew(str(out / "generated.usda"))
    UsdGeom.Xform.Define(generated, "/Loom")
    generated.SetDefaultPrim(generated.GetPrimAtPath("/Loom"))
    used = []
    bodies = []
    for index, row in enumerate(sorted(document["assemblies"], key=lambda item: item["entity_id"])):
        entity_id = row["entity_id"]
        program = GrowthProgram.from_dict(row["growth_program"])
        built = compile_growth(program)
        audit = built.audit()
        if not audit["valid"] or not audit["union_valid"]:
            raise ValueError("Native CAD audit rejected assembly")
        solid = built.assembly.material_solid()
        mesh = built.assembly.tessellate(union=True)
        if len(mesh.vertices) < 3 or len(mesh.faces) < 1:
            raise ValueError("Accepted CAD yielded empty mesh")
        named = _prim_name(entity_id)
        prim_path = "/Loom/" + named
        usd_mesh = UsdGeom.Mesh.Define(generated, prim_path)
        usd_mesh.CreatePointsAttr([tuple(float(v) for v in p) for p in mesh.vertices])
        usd_mesh.CreateFaceVertexCountsAttr([3] * len(mesh.faces))
        usd_mesh.CreateFaceVertexIndicesAttr([int(k) for tri in mesh.faces for k in tri])
        usd_mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
        xs = [float(v[0]) for v in mesh.vertices]
        ys = [float(v[1]) for v in mesh.vertices]
        zs = [float(v[2]) for v in mesh.vertices]
        usd_mesh.CreateExtentAttr([(min(xs), min(ys), min(zs)),
                                   (max(xs), max(ys), max(zs))])
        prim = usd_mesh.GetPrim()
        prim.CreateAttribute("loom:entityId", Sdf.ValueTypeNames.String, custom=True).Set(entity_id)
        prim.CreateAttribute("loom:programSha256", Sdf.ValueTypeNames.String, custom=True).Set(program.identity)
        step_path = native_dir / f"{index:03d}_{named}.step"
        cq.exporters.export(solid, str(step_path), exportType="STEP")
        imported = cq.importers.importStep(str(step_path)).val()
        step_receipt = _compare_native(solid, imported)
        bodies.append({"entity_id": entity_id, "prim_path": prim_path,
                       "program_sha256": program.identity,
                       "geometry_scope": "accepted-CAD-tessellation",
                       "step_path": str(step_path.relative_to(out)),
                       "step_reimport": step_receipt,
                       "native_audit": {"valid": audit["valid"],
                                        "union_valid": audit["union_valid"],
                                        "parts": audit["parts"],
                                        "joints": audit["joints"]}})
        used.append(step_path)
    generated.GetRootLayer().Save()
    presentation = Usd.Stage.CreateNew(str(out / "presentation.usda"))
    UsdGeom.Xform.Define(presentation, "/Loom")
    presentation.GetRootLayer().Save()
    root = Usd.Stage.CreateNew(str(out / "scene.usda"))
    root.GetRootLayer().subLayerPaths = ["presentation.usda", "generated.usda"]
    UsdGeom.SetStageUpAxis(root, UsdGeom.Tokens.z)
    UsdGeom.SetStageMetersPerUnit(root, float(document["meters_per_unit"]))
    root.SetDefaultPrim(root.GetPrimAtPath("/Loom"))
    root.GetRootLayer().Save()
    used.extend([out / "scene.usda", out / "generated.usda", out / "presentation.usda"])
    inventory = {str(p.relative_to(out)): _digest_file(p) for p in sorted(used)}
    report = {"schema": SCHEMA, "location": document["location"],
              "declaration_sha256": canonical_json_sha256(document),
              "stage": "scene.usda", "meters_per_unit": float(document["meters_per_unit"]),
              "up_axis": "Z", "source_pose_authority": "none",
              "engineering_load_certification": False, "operator_promotion": False,
              "bodies": bodies, "assets": inventory}
    manifest = {**report, "sha256": canonical_json_sha256(report)}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2,
                                                 sort_keys=True, allow_nan=False) + "\n",
                                       encoding="utf8")
    validate_scene(out)
    return manifest


def validate_scene(directory):
    """Reopen every referenced file and re-audit exact CAD separately from USD."""
    from pxr import Usd, UsdGeom
    import cadquery as cq
    out = Path(directory)
    doc = json.loads((out / "manifest.json").read_text(encoding="utf8"))
    body = {k: value for k, value in doc.items() if k != "sha256"}
    if (doc.get("schema") != SCHEMA or doc.get("sha256") != canonical_json_sha256(body)):
        raise ValueError("Scene manifest is missing or tampered")
    stage_path = doc["stage"]
    assets = doc["assets"]
    for name, digest in assets.items():
        p = (out / name).resolve()
        if not p.is_relative_to(out.resolve()) or not p.is_file():
            raise ValueError("Bundle asset is missing or escaped its boundary")
        if _digest_file(p) != digest:
            raise ValueError("Portable bundle asset digest mismatch")
    stage = Usd.Stage.Open(str(out / stage_path))
    if not stage:
        raise ValueError("OpenUSD stage could not be reopened")
    if UsdGeom.GetStageUpAxis(stage) != UsdGeom.Tokens.z:
        raise ValueError("Stage up-axis changed")
    if abs(UsdGeom.GetStageMetersPerUnit(stage) - doc["meters_per_unit"]) > 1e-12:
        raise ValueError("Stage units changed")
    expected = set()
    for record in doc["bodies"]:
        prim = stage.GetPrimAtPath(record["prim_path"])
        if not prim or not prim.IsA(UsdGeom.Mesh):
            raise ValueError("Accepted CAD representation missing in composed stage")
        if prim.GetAttribute("loom:entityId").Get() != record["entity_id"]:
            raise ValueError("Semantic identity binding changed")
        if prim.GetAttribute("loom:programSha256").Get() != record["program_sha256"]:
            raise ValueError("Program ancestry binding changed")
        expected.add(record["prim_path"])
        imported = cq.importers.importStep(str(out / record["step_path"])).val()
        info = record["step_reimport"]
        if not imported.isValid() or len(imported.Solids()) != info["solids"]:
            raise ValueError("STEP re-import cannot verify native solid")
        if abs(float(imported.Volume()) - info["step_volume"]) > info["volume_tol"] * max(1.0, info["step_volume"]):
            raise ValueError("STEP native-volume evidence no longer matches")
        if max(abs(a - b) for a, b in zip(_bounds(imported), info["step_bounds"])) > info["bounds_tol"]:
            raise ValueError("STEP extent evidence no longer matches")
    actual = {str(prim.GetPath()) for prim in stage.Traverse() if prim.IsA(UsdGeom.Mesh)}
    if actual != expected:
        raise ValueError("Composed scene has unmapped or missing geometry")
    return {"valid": True, "entities": len(expected), "assets": len(assets),
            "source_pose_authority": doc["source_pose_authority"]}
