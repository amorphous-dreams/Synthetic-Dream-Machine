"""Independent measured cameras enter source inventory and a native workspace."""
import json
from hashlib import sha256
import pytest
from projection_loom.location_stack import LocationStack
from projection_loom.registered_inventory import registered_location_inventory
from projection_loom.seed_adapters import image_group
from projection_loom.location_workspace import create_workspace, verify_workspace
from test_hephaestus_registered_multiview import evidence


def test_registered_observations_become_one_attributable_location(tmp_path):
    adapters=image_group(evidence(tmp_path))
    stack=registered_location_inventory(adapters,"held-out-multiview-site")
    assert stack.audit()["verified_registrations"]==2
    assert stack.audit()["sources"]==5  # original RGBA x2, calibration x2, survey x1
    assert stack.audit()["elements"]==2
    assert all(x=="matched" for x in stack.verify_source_bytes().values())
    reopened=LocationStack.from_dict(stack.to_dict())
    assert reopened.to_dict()==stack.to_dict()
    assert reopened.frames["authored-local3d"].kind=="local3d"
    assert sum(s.kind=="survey_control" for s in reopened.sources.values())==1
    assert all(r.residual_units=="px" and r.state=="verified" for r in reopened.registrations)
    site={"schema":"projection-loom/scene-declaration",
          "location":stack.location_id,"meters_per_unit":1.0,
          "assemblies":[{"entity_id":"coastal-foundation","growth_program":{
              "nodes":[{"key":"root","op":"foundation","size":[5,5,2]}]}}]}
    folder=tmp_path/"native-location"
    doc=create_workspace(stack,site,folder)
    assert verify_workspace(folder)["valid"]
    assert doc["source_authority"]=="independent-inventory; no-calibrated-pose"
    # Source registration remains testimony, not projective proof of this CAD.
    entry=json.loads((folder/"inventory.json").read_text())
    assert len(entry["registrations"])==2


def test_registered_location_invalidates_on_mutated_survey_source(tmp_path):
    adapters=image_group(evidence(tmp_path))
    stack=registered_location_inventory(adapters,"measured-village")
    survey=next(s for s in stack.sources.values() if s.kind=="survey_control")
    with open(survey.locator,"a",encoding="utf8") as stream:
        stream.write("\n")
    with pytest.raises(ValueError,match="Source bytes disagree"):
        stack.verify_source_bytes()
    with pytest.raises(ValueError,match="calibration changed|Source bytes disagree"):
        registered_location_inventory(adapters,"measured-village")


def test_provisional_image_is_never_registered_source_truth(tmp_path):
    from PIL import Image
    source=tmp_path/"other.png"
    Image.new("RGBA",(64,64),(0,0,0,0)).save(source)
    manifest=tmp_path/"group.json"
    manifest.write_text(json.dumps({
        "kind":"image-group","views":[{"rgba":"other.png"}]}))
    adapters=image_group(manifest)
    with pytest.raises(ValueError,match="two or more"):
        registered_location_inventory(adapters,"unmeasured-place")
