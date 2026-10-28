"""Real headless Blender round-trip with native OpenUSD and CAD replay.

Requires Blender executable and python with cadquery + usd-core, not an
untrusted bpy mock. Emits a recorded test workflow and refuses unsupported
Blender topology/rotation changes at the application boundary.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from PIL import Image
from projection_loom.scene_usd import validate_scene
from projection_loom.location_stack import Frame, Source, Element, LocationStack
from projection_loom.location_workspace import create_workspace, edit_workspace, verify_workspace


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path,
                        help="persistent evidence directory for CI and operator review")
    args = parser.parse_args(argv)
    blender = shutil.which("blender")
    if not blender:
        raise SystemExit("Blender binary absent; editor witness BLOCKED")
    script = Path(__file__).resolve().parents[1] / "blender" / "bridge.py"
    with ExitStack() as cleanup:
        if args.out is None:
            work = Path(cleanup.enter_context(
                tempfile.TemporaryDirectory(prefix="loom-blender-witness-")))
        else:
            work = args.out.resolve()
            if work.exists():
                raise ValueError("Blender evidence output must be new and immutable")
            work.mkdir(parents=True)
        document = {"schema": "projection-loom/scene-declaration",
                    "location": "held-out-blender-village",
                    "meters_per_unit": 1.0,
                    "assemblies": [
                        {"entity_id": "east", "growth_program": {"nodes": [
                            {"key": "root", "op": "foundation", "size": [6, 6, 2]},
                            {"key": "top", "op": "spawn", "parent": "root",
                             "face": "up", "size": [2, 2, 1]}]}},
                        {"entity_id": "west", "growth_program": {"nodes": [
                            {"key": "root", "op": "foundation", "size": [4, 4, 2]},
                            {"key": "top", "op": "spawn", "parent": "root",
                             "face": "up", "size": [1.5, 1.5, 1]}]}}]}
        # This picture is independent *test* testimony, not a real surveyed
        # camera; the source inventory never upgrades it to metric authority.
        photo = work / "source-test-observation.png"
        Image.new("RGBA", (96, 96), (220, 165, 90, 255)).save(photo)
        inventory = LocationStack(document["location"])
        inventory.add_frame(Frame("native-model", "local3d", "m"))
        inventory.add_frame(Frame("source-pixels", "pixel", "px"))
        inventory.add_source(Source.from_file("independent-photo", "single_image",
                                              photo, "source-pixels"))
        inventory.add_element(Element("source-projection", "image_plane",
                                      witness_ids=("independent-photo",),
                                      epistemic="source"))
        original = work / "source-workspace"
        origin = create_workspace(inventory, document, original)
        assert verify_workspace(original)["valid"]
        scene = original / "scene"
        manifest = json.loads((scene / "manifest.json").read_text(encoding="utf8"))
        app = work / "scene.blend"
        def invoke(*args):
            command = [blender, "-b", "-noaudio", "--python", str(script), "--", *map(str, args)]
            result = subprocess.run(command, check=False, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True, timeout=240)
            if result.returncode or "Traceback (most recent call last):" in result.stdout:
                raise RuntimeError(f"Blender step failed {result.returncode}:\n" + result.stdout[-12000:])
            return result.stdout
        import_log = invoke("import", "--bundle", scene, "--blend", app, "--operator-note")
        if "LOOM_BLENDER_IMPORT" not in import_log:
            raise RuntimeError("Blender import receipt absent; raw stdout:\n" + import_log[-12000:])
        proposal = work / "proposal.json"
        capture_log = invoke("capture", "--bundle", scene, "--ground", original / "ground.json",
                             "--blend", app, "--proposal", proposal,
                             "--test-move", "east:3,0,0",
                             "--actor", "blender-automated-test")
        if "LOOM_BLENDER_PROPOSAL" not in capture_log:
            raise RuntimeError("Blender edit proposal absent; raw stdout:\n" + capture_log[-12000:])
        edit = json.loads(proposal.read_text(encoding="utf8"))
        if edit["edits"] != [{"entity_id": "east", "kind": "translate",
                             "delta": [3.0, 0.0, 0.0]}]:
            raise RuntimeError("Captured Blender translation mismatched authored edit")
        destination = work / "regenerated-workspace"
        next_location = edit_workspace(original, edit, destination)
        assert next_location["parent_workspace_sha256"] == origin["sha256"]
        assert next_location["inventory_sha256"] == origin["inventory_sha256"]
        assert verify_workspace(destination)["valid"]
        outcome = json.loads((destination / "revision" / "reconciliation.json").read_text())
        assert outcome["invalidation_plan"]["native_reaudited"] == 1
        assert outcome["invalidation_plan"]["actual_cache_reuse"] == 1
        regenerated_scene = destination / "revision" / "scene"
        assert validate_scene(regenerated_scene)["valid"]
        target = work / "reloaded.blend"
        reload_log = invoke("reload", "--bundle", regenerated_scene,
                            "--blend", app, "--out", target)
        if "OperatorNote" not in reload_log or not target.is_file():
            raise RuntimeError("Blender operator-owned scene work was not preserved")
        report = {"schema": "projection-loom/blender-native-editor-witness",
                  "blender_executable": blender,
                          "editor": "Blender",
                          "source_bundle": manifest["sha256"],
                          "regenerated_bundle": outcome["new_bundle_sha256"],
                          "source_workspace": origin["sha256"],
                          "regenerated_workspace": next_location["sha256"],
                          "workspace_ancestry_verified": True,
                          "source_inventory_preserved": True,
                          "retained_operator_note": True,
                          "actor": "blender-automated-test",
                          "real_editor": True, "exact_cad_reaudited": 1}
        (work / "blender-witness.json").write_text(
            json.dumps(report, sort_keys=True, indent=2) + "\n", encoding="utf8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
