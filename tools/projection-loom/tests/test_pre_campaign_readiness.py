"""Evidence boundaries; native integration runs through dedicated Actions workflow."""
from pathlib import Path
import json
import pytest

from projection_loom.pre_campaign_readiness import (
    CONTRACT, contract_for, checked, seal, verify_seal, topology_controls)
from projection_loom.pipeline import Project
from projection_loom.capability_stack import CapabilityRecipe

EX = Path(__file__).resolve().parents[1] / "examples/necrospire"


def test_contract_is_frozen_to_source_camera_scoring_and_code():
    project = Project.load(EX / "project_alpha.json")
    recipe = CapabilityRecipe.load(EX / "hybrid/recipe_alpha.json")
    args = dict(passes=1, offspring=1, exact=3, detail=2, seed=41, size=(64,96),
                control_scale=.10, candidate_scale=.16)
    first = contract_for(project, recipe, **args)
    assert first == contract_for(project, recipe, **args)
    assert checked(first, CONTRACT) == first
    assert first["source"]["evidence"] == "provisional-unregistered"
    assert first["policy"]["local_objectives"] == ["regional"]
    with pytest.raises(ValueError, match="distinct"):
        contract_for(project, recipe, **{**args, "candidate_scale": .10})
    with pytest.raises(ValueError, match="budgets"):
        contract_for(project, recipe, **{**args, "detail": 4})
    tampered = json.loads(json.dumps(first))
    tampered["policy"]["seed"] = 20
    with pytest.raises(ValueError, match="digest"):
        checked(tampered, CONTRACT)


def test_seal_detects_tamper_and_missing_bytes(tmp_path):
    (tmp_path / "readiness.json").write_text('{"record":"sealed"}')
    (tmp_path / "native.step").write_bytes(b"real-native-geometry")
    manifest = seal(tmp_path)
    assert verify_seal(tmp_path) == manifest
    assert seal(tmp_path) == manifest
    (tmp_path / "native.step").write_bytes(b"changed")
    with pytest.raises(ValueError, match="changed"):
        verify_seal(tmp_path)


@pytest.mark.slow
def test_directed_topology_truth_table_keeps_failures_attributed(tmp_path):
    project = Project.load(EX / "project_alpha.json")
    recipe = CapabilityRecipe.load(EX / "hybrid/recipe_alpha.json")
    result = topology_controls(project, recipe, tmp_path / "native", size=(64,96))
    assert result["attempted"] == 8
    assert {r["case"] for r in result["cases"]} == {
        "000","001","010","011","100","101","110","111"}
    assert result["native_valid"] + result["native_rejected"] == 8
    for row in result["cases"]:
        if row["state"] == "native-valid":
            assert row["witness_id"]
            assert row["audit"]["cad_valid"]
            assert row["audit"]["composite_cad_union_verified"] is False
            assert (tmp_path / row["native_manifest"]).is_file()
        else:
            assert row["reason"]
