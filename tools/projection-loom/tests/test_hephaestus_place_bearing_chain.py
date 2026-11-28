"""N9 real two-event causal column: source and both bearing frontiers survive."""
import json
import pytest
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack,Frame
from projection_loom.place_genome import propose_from_spatial_intent
from projection_loom.spatial_intent import SpatialIntent
from projection_loom.location_workspace import create_workspace,verify_workspace
from projection_loom.place_bearing_causal import (
    materialize_bearing_chain,verify_bearing_chain)
from test_hephaestus_place_bearing import fixture


def source(tmp_path):
    original,prior=fixture(roof_z=4.)
    intent=IntentContract("bearing-site","Construct attributable column",("bearing",))
    spatial=SpatialIntent(intent.identity,prior.goals,"operator")
    child=propose_from_spatial_intent(original,spatial)
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("operator-local","local3d","model_unit"))
    path=tmp_path/"original"
    create_workspace(inventory,child.declaration(intent.location),path)
    return path,child,spatial


def test_two_native_contacts_create_two_separate_causal_support_events(tmp_path):
    original,genome,spatial=source(tmp_path)
    before=verify_workspace(original)
    out=tmp_path/"two"
    result=materialize_bearing_chain(original,genome,spatial,out,actor="operator")
    assert len(result["events"])==2
    assert result["events"][0]["upper"]==result["events"][1]["lower"]
    assert not result["load_certification"] and not result["automatic_promotion"]
    assert verify_bearing_chain(original,genome,spatial,out)==result
    assert verify_workspace(original)==before
    forged={**result,"events":[dict(x) for x in result["events"]]}
    forged["events"][1]["event_id"]="forged"
    (out/"receipt.json").write_text(json.dumps(forged))
    with pytest.raises(ValueError,match="altered"):
        verify_bearing_chain(original,genome,spatial,out)


def test_causal_column_cli_reopens_same_native_frontiers(tmp_path):
    from projection_loom.cli import main
    original,genome,spatial=source(tmp_path)
    (tmp_path/"genome.json").write_text(json.dumps(genome.to_dict()))
    (tmp_path/"spatial.json").write_text(json.dumps(spatial.to_dict()))
    common=["--workspace",str(original),
            "--genome",str(tmp_path/"genome.json"),
            "--spatial",str(tmp_path/"spatial.json")]
    out=tmp_path/"chain"
    made=main(["place-bearing-chain",*common,"--actor","operator","--out",str(out)])
    assert len(made["events"])==2
    assert main(["place-bearing-chain-verify",*common,"--causal",str(out)])==made
