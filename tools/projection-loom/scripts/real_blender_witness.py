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
from projection_loom.location_workspace import (
    create_workspace, edit_workspace, support_workspace, verify_workspace)
from projection_loom.native_support import propose_support
from projection_loom.relational_ground import RelationalGround


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

        # Second real-application witness: one operator-declared connected
        # support group moves together; the unedited third solid is reused.
        group_doc = {"schema": "projection-loom/scene-declaration",
                     "location": "held-out-blender-coupled-support",
                     "meters_per_unit": 1.0, "assemblies": [
                         {"entity_id": "lower", "growth_program": {"nodes": [
                             {"key": "root", "op": "foundation", "size": [5, 5, 2]}]}},
                         {"entity_id": "upper", "translation": [0, 0, 2],
                          "growth_program": {"nodes": [
                              {"key": "root", "op": "foundation", "size": [3, 3, 1]}]}},
                         {"entity_id": "independent", "translation": [12, 0, 0],
                          "growth_program": {"nodes": [
                              {"key": "root", "op": "foundation", "size": [2, 2, 3]}]}}]}
        source_inventory = LocationStack(group_doc["location"])
        source_inventory.add_frame(Frame("authored-local", "local3d", "m"))
        group_source = work / "group-source"
        group_before = create_workspace(source_inventory, group_doc, group_source)
        prior = RelationalGround.load(group_source / "ground.json")
        bearing = propose_support(prior, group_source / "scene", "lower", "upper")
        bearing_workspace = work / "group-supported"
        bearing_manifest = support_workspace(group_source, bearing, bearing_workspace)
        group_scene = bearing_workspace / "scene"
        group_blend = work / "group-scene.blend"
        group_import = invoke("import", "--bundle", group_scene, "--blend",
                              group_blend, "--operator-note")
        if "LOOM_BLENDER_IMPORT" not in group_import:
            raise RuntimeError("Real Blender coupled-support import absent")
        group_proposal_path = work / "group-proposal.json"
        group_capture = invoke(
            "capture", "--bundle", group_scene, "--ground",
            bearing_workspace / "ground.json", "--blend", group_blend,
            "--proposal", group_proposal_path,
            "--test-move", "lower:4,0,0",
            "--test-move", "upper:4,0,0",
            "--transaction", "support-group",
            "--actor", "blender-group-test")
        if "LOOM_BLENDER_PROPOSAL" not in group_capture:
            raise RuntimeError("Real Blender coupled-support capture absent")
        group_proposal = json.loads(group_proposal_path.read_text(encoding="utf8"))
        assert group_proposal["transaction"] == "support-group"
        assert [item["entity_id"] for item in group_proposal["edits"]] == ["lower", "upper"]
        group_destination = work / "group-regenerated"
        group_after = edit_workspace(bearing_workspace, group_proposal,
                                     group_destination)
        assert group_after["parent_workspace_sha256"] == bearing_manifest["sha256"]
        assert verify_workspace(group_destination)["valid"]
        group_reconciliation = json.loads(
            (group_destination / "revision" / "reconciliation.json").read_text())
        assert group_reconciliation["invalidation_plan"]["native_reaudited"] == 2
        assert group_reconciliation["invalidation_plan"]["actual_cache_reuse"] == 1
        group_reloaded = work / "group-reloaded.blend"
        group_reload = invoke(
            "reload", "--bundle", group_destination / "revision" / "scene",
            "--blend", group_blend, "--out", group_reloaded)
        if "OperatorNote" not in group_reload or not group_reloaded.is_file():
            raise RuntimeError("Coupled support reload dropped operator-owned objects")
        # N6: actual Blender translates one dependent into a replacement bearing.
        # Parent transfer stays explicit operator intent, never inferred from pixels.
        transfer_doc = {"schema":"projection-loom/scene-declaration",
                        "location":"held-out-blender-support-transfer",
                        "meters_per_unit":1.0,"assemblies":[
                            {"entity_id":"old","growth_program":{"nodes":[
                                {"key":"root","op":"foundation","size":[4,4,2]}]}},
                            {"entity_id":"new","translation":[9,0,0],
                             "growth_program":{"nodes":[
                                 {"key":"root","op":"foundation","size":[4,4,2]}]}},
                            {"entity_id":"child","translation":[0,0,2],
                             "growth_program":{"nodes":[
                                 {"key":"root","op":"foundation","size":[2,2,1]}]}}]}
        transfer_inventory = LocationStack(transfer_doc["location"])
        transfer_inventory.add_frame(Frame("authored", "local3d", "m"))
        transfer_root=work/"transfer-root"
        create_workspace(transfer_inventory,transfer_doc,transfer_root)
        transfer_source=RelationalGround.load(transfer_root/"ground.json")
        transfer_proof=propose_support(transfer_source,transfer_root/"scene","old","child")
        transfer_bearing=work/"transfer-bearing"
        transfer_base=support_workspace(transfer_root,transfer_proof,transfer_bearing)
        transfer_scene=transfer_bearing/"scene"
        transfer_blend=work/"transfer.blend"
        assert "LOOM_BLENDER_IMPORT" in invoke("import","--bundle",transfer_scene,
                                               "--blend",transfer_blend,"--operator-note")
        transfer_proposal=work/"transfer-proposal.json"
        capture=invoke("capture","--bundle",transfer_scene,
                       "--ground",transfer_bearing/"ground.json",
                       "--blend",transfer_blend,"--proposal",transfer_proposal,
                       "--test-move","child:9,0,0","--transaction","support-transfer",
                       "--support-transfer","child:old:new",
                       "--actor","blender-transfer-test")
        assert "LOOM_BLENDER_PROPOSAL" in capture
        authored=json.loads(transfer_proposal.read_text(encoding="utf8"))
        assert authored["support_transfers"] == [
            {"child":"child","old_parent":"old","new_parent":"new"}]
        transfer_out=work/"transfer-regenerated"
        transfer_accepted=edit_workspace(transfer_bearing,authored,transfer_out)
        assert verify_workspace(transfer_out)["valid"]
        transfer_reloaded=work/"transfer-reloaded.blend"
        transfer_log=invoke("reload","--bundle",transfer_out/"revision"/"scene",
                            "--blend",transfer_blend,"--out",transfer_reloaded)
        assert "OperatorNote" in transfer_log and transfer_reloaded.is_file()
        from projection_loom.location_review import review_location, verify_location_review
        reviewed=review_location(transfer_out,actor="operator-review-test",
                                 decision="abstain",reason="pending aesthetic judgment",
                                 destination=work/"transfer-review.json")
        assert verify_location_review(transfer_out,reviewed)
        # N9: One place embodies two distinct architectural intentions.
        # Blender's mesh presentation may change a transform, while native
        # STEP must independently re-witness BOTH spatial relationships.
        from projection_loom.developmental import GrowthNode, GrowthProgram
        from projection_loom.place_genome import PlaceGenome, PlaceBody, propose_from_spatial_intent
        from projection_loom.spatial_intent import SpatialIntent, SpatialGoal
        from projection_loom.intent_seed import IntentContract
        from projection_loom.place_affordances import assess_place
        def _root_body(name,shape,position):
            return PlaceBody(name,GrowthProgram((GrowthNode(
                "root","foundation",size=shape),)),position)
        n9_location="blender-native-interpreted-architecture"
        n9_source=PlaceGenome((
            _root_body("begin",(3.,3.,1.),(0.,0.,0.)),
            _root_body("summit",(3.,3.,2.2),(9.,0.,0.))))
        n9_intent=IntentContract(n9_location,"A rising passage and shelter",
                                 ("ascent","cover"))
        n9_spatial=SpatialIntent(n9_intent.identity,(
            SpatialGoal("ascend","begin","summit",.9,.6),
            SpatialGoal("shelter","begin","roof",.9,1.1)), "operator")
        n9_genome=propose_from_spatial_intent(n9_source,n9_spatial)
        assert len(n9_genome.ascents)==1 and len(n9_genome.bodies)>=5
        n9_inventory=LocationStack(n9_location)
        n9_inventory.add_frame(Frame("authored-local","local3d","m"))
        n9_root=work/"n9-blender-source"
        n9_origin=create_workspace(n9_inventory,n9_genome.declaration(n9_location),n9_root)
        n9_before=assess_place(n9_root/"scene",n9_genome,n9_spatial)
        if not n9_before["all_declared_goals_witnessed"]:
            raise RuntimeError("Authored STEP canopy/ascent lack native proof before Blender")
        n9_blend=work/"n9-interpreted.blend"
        if "LOOM_BLENDER_IMPORT" not in invoke("import","--bundle",n9_root/"scene",
                                                "--blend",n9_blend,"--operator-note"):
            raise RuntimeError("Real Blender refused compound architectural place")
        n9_edit_path=work/"n9-proposal.json"
        n9_capture=invoke("capture","--bundle",n9_root/"scene",
                          "--ground",n9_root/"ground.json","--blend",n9_blend,
                          "--proposal",n9_edit_path,"--test-move","roof:0.25,0,0",
                          "--actor","blender-n9-operator")
        if "LOOM_BLENDER_PROPOSAL" not in n9_capture:
            raise RuntimeError("Blender did not capture authored canopy movement")
        n9_edit=json.loads(n9_edit_path.read_text(encoding="utf8"))
        if n9_edit["edits"] != [{"entity_id":"roof","kind":"translate",
                                 "delta":[.25,0.,0.]}]:
            raise RuntimeError("Blender canopy transform was not captured as authored")
        n9_destination=work/"n9-blender-regenerated"
        n9_after=edit_workspace(n9_root,n9_edit,n9_destination)
        if not verify_workspace(n9_destination)["valid"]:
            raise RuntimeError("N9 native and causal place failed independent rehydration")
        updated=[]
        for body in n9_genome.bodies:
            if body.entity_id=="roof":
                updated.append(PlaceBody("roof",body.program,
                               (body.translation[0]+.25,*body.translation[1:])))
            else:
                updated.append(body)
        n9_moved=PlaceGenome(tuple(updated),n9_genome.walkways,n9_genome.ascents)
        n9_proof=assess_place(n9_destination/"revision"/"scene",n9_moved,n9_spatial)
        if not n9_proof["all_declared_goals_witnessed"]:
            raise RuntimeError("Edited canopy lost native shelter or ascent evidence")
        n9_reloaded=work/"n9-operator-preserved.blend"
        n9_log=invoke("reload","--bundle",n9_destination/"revision"/"scene",
                      "--blend",n9_blend,"--out",n9_reloaded)
        if "OperatorNote" not in n9_log or not n9_reloaded.is_file():
            raise RuntimeError("N9 regenerated spatial scene lost Blender operator objects")
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
                          "coupled_support_source": group_before["sha256"],
                          "coupled_support_workspace": bearing_manifest["sha256"],
                          "coupled_support_regenerated": group_after["sha256"],
                          "coupled_support_native_reaudited": 2,
                          "coupled_support_native_cache_reused": 1,
                          "coupled_support_operator_note_preserved": True,
                          "transfer_workspace":transfer_accepted["sha256"],
                          "transfer_operator_note_preserved":True,
                          "transfer_review_sha256":reviewed["sha256"],
                          "n9_intent_sha256":n9_intent.identity,
                          "n9_native_spatial_goals":2,
                          "n9_source_workspace_sha256":n9_origin["sha256"],
                          "n9_edited_workspace_sha256":n9_after["sha256"],
                          "n9_operator_note_preserved":True,
                          "n9_native_spatial_reaudited":True,
                          "actor": "blender-automated-test",
                          "real_editor": True, "exact_cad_reaudited": 1}
        (work / "blender-witness.json").write_text(
            json.dumps(report, sort_keys=True, indent=2) + "\n", encoding="utf8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
