"""Blender-side Loom bridge: import, capture operator edits, reload native regen.

Run inside the actual Blender Python interpreter:
  blender -b --python blender/bridge.py -- import --bundle B --blend SCENE.blend
  blender -b --python blender/bridge.py -- capture --bundle B --ground G --blend SCENE.blend --proposal P
  blender -b --python blender/bridge.py -- reload --bundle NEW_B --blend SCENE.blend --out UPDATED.blend

Only rigid assembly translation is bidirectional. Unsupported mesh editing
is a refusal, never silently treated as a valid CAD rewrite. Operator-owned
objects carry no Loom tag and are preserved during reload.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

import bpy


def _mesh_digest(obj):
    digest = sha256()
    mesh = obj.data
    for vertex in mesh.vertices:
        digest.update(struct.pack("<ddd", *[float(v) for v in vertex.co]))
    for polygon in mesh.polygons:
        digest.update(struct.pack("<I", len(polygon.vertices)))
        for vertex in polygon.vertices:
            digest.update(struct.pack("<I", int(vertex)))
    return digest.hexdigest()


def _matrix(obj):
    return [float(obj.matrix_world[r][c]) for r in range(4) for c in range(4)]


def _tag(scene_bundle, manifest):
    for body in manifest["bodies"]:
        path = body["prim_path"].split("/")[-1]
        obj = bpy.data.objects.get(path)
        if obj is None or obj.type != "MESH":
            raise RuntimeError("Blender USD import did not yield declared mesh " + path)
        if "loom_entity_id" in obj:
            raise RuntimeError("Generated mesh identity was already bound")
        obj["loom_entity_id"] = body["entity_id"]
        obj["loom_program_sha256"] = body["program_sha256"]
        obj["loom_bundle_sha256"] = manifest["sha256"]
        obj["loom_initial_matrix"] = _matrix(obj)
        obj["loom_initial_mesh_digest"] = _mesh_digest(obj)


def _open_bundle(bundle):
    source = Path(bundle).resolve()
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf8"))
    if "bodies" not in manifest or "sha256" not in manifest:
        raise ValueError("Invalid authored Loom scene bundle")
    prior_names = set(bpy.data.objects.keys())
    if "FINISHED" not in bpy.ops.wm.usd_import(filepath=str(source / "scene.usda")):
        raise RuntimeError("Blender failed to import the composed USD stage")
    imported = [obj for obj in bpy.data.objects if obj.name not in prior_names]
    if not imported:
        raise RuntimeError("Blender USD import created no objects")
    for obj in imported:
        obj["loom_generated"] = True  # includes parent empties and USD hierarchy
    _tag(source, manifest)
    return manifest


def _import(args):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    manifest = _open_bundle(args.bundle)
    if args.operator_note:
        note = bpy.data.objects.new("OperatorNote", None)
        bpy.context.scene.collection.objects.link(note)
        note["operator_owned"] = True
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.blend).resolve()))
    print("LOOM_BLENDER_IMPORT " + json.dumps({"bodies": len(manifest["bodies"])}))


def _capture(args):
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    ground = json.loads(Path(args.ground).read_text(encoding="utf8"))
    manifest = json.loads((Path(args.bundle) / "manifest.json").read_text(encoding="utf8"))
    objects = [obj for obj in bpy.data.objects if "loom_entity_id" in obj]
    expected = {body["entity_id"] for body in manifest["bodies"]}
    if {obj["loom_entity_id"] for obj in objects} != expected:
        raise RuntimeError("Blender scene lost or duplicated semantic identity binding")
    if args.test_move:
        entity_id, delta_text = args.test_move.split(":", 1)
        delta = [float(x) for x in delta_text.split(",")]
        if len(delta) != 3:
            raise ValueError("Test move needs three deltas")
        match = next(obj for obj in objects if obj["loom_entity_id"] == entity_id)
        for i in range(3):
            match.location[i] += delta[i]
        bpy.context.view_layer.update()
    edits = []
    for obj in objects:
        if obj.type != "MESH" or _mesh_digest(obj) != obj["loom_initial_mesh_digest"]:
            raise RuntimeError("Unsupported Blender mesh topology/vertex edit; refuse CAD inversion")
        if obj["loom_bundle_sha256"] != manifest["sha256"]:
            raise RuntimeError("Blender object came from a different native scene bundle")
        initial = list(obj["loom_initial_matrix"])
        now = _matrix(obj)
        for i in range(16):
            if i not in (3, 7, 11) and abs(now[i] - initial[i]) > 1e-6:
                raise RuntimeError("Unsupported rotation, scale or shear in authored Blender edit")
        delta = [now[i] - initial[i] for i in (3, 7, 11)]
        if any(abs(x) > 1e-6 for x in delta):
            edits.append({"entity_id": obj["loom_entity_id"],
                          "kind": "translate", "delta": delta})
    if not edits:
        raise RuntimeError("No supported Blender edits to propose")
    proposal = {"schema": "projection-loom/editor-proposal",
                "editor": "blender", "actor": args.actor,
                "bundle_sha256": manifest["sha256"],
                "observed_frontier": ground["frontier"],
                "edits": sorted(edits, key=lambda x: x["entity_id"])}
    Path(args.proposal).write_text(json.dumps(proposal, indent=2) + "\n", encoding="utf8")
    print("LOOM_BLENDER_PROPOSAL " + json.dumps({"edits": len(edits),
                                                 "frontier": ground["frontier"]}))


def _reload(args):
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    old_ids = {obj["loom_entity_id"] for obj in bpy.data.objects
               if "loom_entity_id" in obj}
    existing = [obj for obj in bpy.data.objects if obj.get("loom_generated")
                or "loom_entity_id" in obj]
    operator_owned = {obj.name for obj in bpy.data.objects
                      if obj not in existing}
    for obj in existing:
        bpy.data.objects.remove(obj, do_unlink=True)
    manifest = _open_bundle(args.bundle)
    new_ids = {body["entity_id"] for body in manifest["bodies"]}
    if old_ids != new_ids:
        raise RuntimeError("Reload changed authored semantic identity inventory")
    if not operator_owned <= set(bpy.data.objects):
        raise RuntimeError("Reload discarded operator-owned Blender objects")
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.out).resolve()))
    print("LOOM_BLENDER_RELOAD " + json.dumps({"preserved_operator_objects":
                                               sorted(operator_owned), "entities": len(new_ids)}))


def main():
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("import", "capture", "reload"))
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--ground")
    parser.add_argument("--proposal")
    parser.add_argument("--out")
    parser.add_argument("--actor", default="operator")
    parser.add_argument("--operator-note", action="store_true")
    parser.add_argument("--test-move", help="Explicitly simulated move for CI only")
    args = parser.parse_args(arguments)
    if args.action == "import":
        _import(args)
    elif args.action == "capture":
        if not args.ground or not args.proposal:
            parser.error("Capture requires --ground and --proposal")
        _capture(args)
    else:
        if not args.out:
            parser.error("Reload requires --out")
        _reload(args)


if __name__ == "__main__":
    main()
