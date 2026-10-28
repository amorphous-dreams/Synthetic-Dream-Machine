"""Full location source -> causal editor -> native reusable scene -> OODA-HA."""
import json
from pathlib import Path
import pytest

from projection_loom.location_stack import Frame, Source, Element, Relation, LocationStack
from projection_loom.location_workspace import create_workspace, edit_workspace, verify_workspace
from projection_loom.editor_proposals import seed_editor_ground


def fixture(tmp_path):
    photo = tmp_path / "source.png"
    photo.write_bytes(b"independent visual testimony - not metric camera calibration")
    stack = LocationStack("held-out-coastal-archive")
    stack.add_frame(Frame("local", "local3d", "model_unit"))
    stack.add_frame(Frame("photo", "pixel", "px"))
    stack.add_source(Source.from_file("archival-image", "single_image", photo, "photo"))
    stack.add_element(Element("archival-projection", "image_plane",
                              witness_ids=("archival-image",), epistemic="source"))
    def body(id, w):
        return {"entity_id": id, "growth_program": {"nodes": [
            {"key": "root", "op": "foundation", "size": [w, w, 2]},
            {"key": "upper", "op": "spawn", "parent": "root", "face": "up",
             "size": [1.5, 1.5, 1]}]}}
    declaration = {"schema": "projection-loom/scene-declaration",
                   "location": stack.location_id, "meters_per_unit": .75,
                   "assemblies": [body("east", 5), body("west", 7)]}
    return stack, declaration, photo


def proposal(workspace, entity="east", delta=(4, 0, 0)):
    manifest = json.loads((workspace / "manifest.json").read_text())
    from projection_loom.relational_ground import RelationalGround
    ground = RelationalGround.load(workspace / manifest["paths"]["ground"])
    return {"schema": "projection-loom/editor-proposal",
            "editor": "cli", "actor": "operator-held-out",
            "bundle_sha256": manifest["scene_sha256"],
            "observed_frontier": list(ground.frontier),
            "edits": [{"kind": "translate", "entity_id": entity,
                       "delta": list(delta)}]}


def test_source_causal_native_location_roundtrip_and_idempotent_read(tmp_path):
    stack, declaration, photo = fixture(tmp_path)
    first = tmp_path / "first"
    result = create_workspace(stack, declaration, first)
    assert result["automatic_promotion"] is False
    assert len(stack.elements) == 1  # source object not silently rewritten
    assert verify_workspace(first)["entities"] == 2
    assert verify_workspace(first)["workspace_sha256"] == result["sha256"]
    with pytest.raises(ValueError, match="new and immutable"):
        create_workspace(stack, declaration, first)
    second = tmp_path / "second"
    edited = edit_workspace(first, proposal(first), second)
    assert edited["parent_workspace_sha256"] == result["sha256"]
    assert edited["inventory_sha256"] == result["inventory_sha256"]
    assert verify_workspace(second)["native"] == "verified-cad-step-usd"
    receipt = json.loads((second / "revision" / "reconciliation.json").read_text())
    assert receipt["invalidation_plan"]["native_reaudited"] == 1
    assert receipt["invalidation_plan"]["actual_cache_reuse"] == 1
    from projection_loom.relational_ground import RelationalGround
    ground = RelationalGround.load(second / "revision" / "ground.json")
    assert ground.snapshot()["entities"]["east"]["matrix"][3] == 4
    assert json.loads((second / "session.json").read_text())["status"] == "completed"
    with pytest.raises(ValueError, match="new causal island"):
        edit_workspace(first, proposal(first), second)
    photo.write_bytes(b"new pixels")
    with pytest.raises(ValueError, match="Source bytes disagree"):
        verify_workspace(second)


def test_location_mismatch_unsupported_frame_and_second_structure_authority(tmp_path):
    stack, declaration, _ = fixture(tmp_path)
    other = json.loads(json.dumps(declaration))
    other["location"] = "alien"
    with pytest.raises(ValueError, match="source location disagree"):
        create_workspace(stack, other, tmp_path / "alien")
    stack.add_frame(Frame("second", "local3d", "m"))
    with pytest.raises(ValueError, match="unambiguous authored"):
        create_workspace(stack, declaration, tmp_path / "ambiguous")
    stack, declaration, _ = fixture(tmp_path / "different")
    # Test source cannot silently add second CAD ownership path.
    stack.add_element(Element("east", "cad_body", body_token="east"))
    with pytest.raises(ValueError, match="already owns"):
        create_workspace(stack, declaration, tmp_path / "double")


def test_tampered_source_ground_and_edited_lineage_refused(tmp_path):
    stack, declaration, _ = fixture(tmp_path)
    first = tmp_path / "base"
    create_workspace(stack, declaration, first)
    second = tmp_path / "branch"
    edit_workspace(first, proposal(first), second)
    p = second / "revision" / "ground.json"
    original = p.read_text()
    p.write_text(original.replace('"construct"', '"observation"', 1))
    with pytest.raises(ValueError, match="digest"):
        verify_workspace(second)
    p.write_text(original)
    p = second / "proposal.json"
    p.write_text(p.read_text().replace("operator-held-out", "other-actor"))
    with pytest.raises(ValueError, match="receipt changed"):
        verify_workspace(second)


def test_failed_workspace_never_looks_completed(tmp_path):
    stack, declaration, _ = fixture(tmp_path)
    first = tmp_path / "source"
    create_workspace(stack, declaration, first)
    bad = proposal(first)
    bad["edits"][0]["kind"] = "arbitrary-mesh-retopology"
    output = tmp_path / "failed"
    with pytest.raises(ValueError, match="Only rigid assembly translation"):
        edit_workspace(first, bad, output)
    assert (output / "FAILED").is_file()
    assert not (output / "manifest.json").exists()
    with pytest.raises(FileNotFoundError):
        verify_workspace(output)
