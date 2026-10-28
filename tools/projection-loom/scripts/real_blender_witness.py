"""Real headless Blender round-trip with native OpenUSD and CAD replay.

Requires Blender executable and python with cadquery + usd-core, not an
untrusted bpy mock. Emits a recorded test workflow and refuses unsupported
Blender topology/rotation changes at the application boundary.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from projection_loom.scene_usd import package_scene, validate_scene
from projection_loom.editor_proposals import seed_editor_ground, apply_proposal


def main():
    blender = shutil.which("blender")
    if not blender:
        raise SystemExit("Blender binary absent; editor witness BLOCKED")
    script = Path(__file__).resolve().parents[1] / "blender" / "bridge.py"
    with tempfile.TemporaryDirectory(prefix="loom-blender-witness-") as temp:
        work = Path(temp)
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
        original = work / "source"
        manifest = package_scene(document, original)
        ground = seed_editor_ground(document)
        ground.save(work / "ground.json")
        app = work / "scene.blend"
        def invoke(*args):
            command = [blender, "-b", "-noaudio", "--python", str(script), "--", *map(str, args)]
            result = subprocess.run(command, check=False, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True, timeout=240)
            if result.returncode or "Traceback (most recent call last):" in result.stdout:
                raise RuntimeError(f"Blender step failed {result.returncode}:\n" + result.stdout[-12000:])
            return result.stdout
        import_log = invoke("import", "--bundle", original, "--blend", app, "--operator-note")
        if "LOOM_BLENDER_IMPORT" not in import_log:
            raise RuntimeError("Blender import receipt absent; raw stdout:\n" + import_log[-12000:])
        proposal = work / "proposal.json"
        capture_log = invoke("capture", "--bundle", original, "--ground", work / "ground.json",
                             "--blend", app, "--proposal", proposal,
                             "--test-move", "east:3,0,0",
                             "--actor", "blender-automated-test")
        if "LOOM_BLENDER_PROPOSAL" not in capture_log:
            raise RuntimeError("Blender edit proposal absent; raw stdout:\n" + capture_log[-12000:])
        edit = json.loads(proposal.read_text(encoding="utf8"))
        if edit["edits"] != [{"entity_id": "east", "kind": "translate",
                             "delta": [3.0, 0.0, 0.0]}]:
            raise RuntimeError("Captured Blender translation mismatched authored edit")
        destination = work / "regenerated"
        outcome = apply_proposal(document, ground, original, edit, destination)
        assert outcome["invalidation_plan"]["native_reaudited"] == 2
        assert validate_scene(destination / "scene")["valid"]
        target = work / "reloaded.blend"
        reload_log = invoke("reload", "--bundle", destination / "scene",
                            "--blend", app, "--out", target)
        if "OperatorNote" not in reload_log or not target.is_file():
            raise RuntimeError("Blender operator-owned scene work was not preserved")
        print(json.dumps({"schema": "projection-loom/blender-native-editor-witness",
                          "blender_executable": blender,
                          "editor": "Blender",
                          "source_bundle": manifest["sha256"],
                          "regenerated_bundle": outcome["new_bundle_sha256"],
                          "retained_operator_note": True,
                          "actor": "blender-automated-test",
                          "real_editor": True, "exact_cad_reaudited": 2}, indent=2))


if __name__ == "__main__":
    main()
