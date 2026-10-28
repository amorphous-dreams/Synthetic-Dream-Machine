"""Real cross-domain F witness with independent source, CAD and causal records."""
import json
import pytest
from projection_loom.hephaestus_holistic import run_holistic
from projection_loom.location_workspace import verify_workspace
from projection_loom.scene_variants import validate_variants
from test_hephaestus_registered_multiview import evidence


def declaration():
    def body(name,size,translation=None):
        item={"entity_id":name,"growth_program":{"nodes":[
            {"key":"root","op":"foundation","size":size}]}}
        if translation is not None:
            item["translation"]=translation
        return item
    return {"schema":"projection-loom/scene-declaration",
            "location":"independent-waterfront-crucible","meters_per_unit":1.0,
            "assemblies":[body("quay",[5,5,2]),
                          body("watch",[3,3,1],[0,0,2]),
                          body("lighthouse",[2,2,3],[10,0,0])]}


def test_measured_source_to_support_to_independent_edit_to_variants(tmp_path):
    source=evidence(tmp_path)
    output=tmp_path/"full-location"
    report=run_holistic(source,declaration(),"quay","watch","lighthouse",
                        (3,0,0),output)
    assert report["registered_source_views"]==2
    assert report["native_reaudited"]==1
    assert report["native_cache_reused"]==2
    assert report["automatic_promotion"] is False
    assert report["external_survey_certification"] is False
    assert report["load_certification"] is False
    assert report["operator_winner"] is None
    for name in ("initial","supported","edited"):
        assert verify_workspace(output/name)["valid"]
    assert validate_variants(output/"variants")["valid"]
    assert report["initial_workspace_sha256"]!=report["edited_workspace_sha256"]
    assert json.loads((output/"crucible.json").read_text())==report
    with pytest.raises(ValueError,match="new immutable output"):
        run_holistic(source,declaration(),"quay","watch","lighthouse",
                     (3,0,0),output)


def test_incompatible_native_contact_fails_without_crucible_completion(tmp_path):
    source=evidence(tmp_path)
    bad=declaration()
    bad["assemblies"][1]["translation"]=[0,0,9]
    path=tmp_path/"broken-support"
    with pytest.raises(ValueError,match="gap or penetration"):
        run_holistic(source,bad,"quay","watch","lighthouse",(3,0,0),path)
    assert (path/"FAILED").is_file()
    assert not (path/"crucible.json").exists()


def test_unregistered_source_cannot_enter_holistic_crucible(tmp_path):
    source=evidence(tmp_path)
    manifest=json.loads(source.read_text())
    manifest["views"][0]["registration"]="provisional"
    manifest["views"][0].pop("calibration")
    source.write_text(json.dumps(manifest))
    with pytest.raises(ValueError,match="independent calibrated"):
        run_holistic(source,declaration(),"quay","watch","lighthouse",
                     (3,0,0),tmp_path/"unregistered")
