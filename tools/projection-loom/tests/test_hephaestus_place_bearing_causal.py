"""N9 native bearing becomes one causal support without rewriting source."""
from test_hephaestus_place_bearing import fixture
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack,Frame
from projection_loom.spatial_intent import SpatialIntent
from projection_loom.location_workspace import create_workspace,verify_workspace
from projection_loom.place_bearing_causal import materialize_bearing_support,verify_bearing_support
import pytest
import json


def original(tmp_path,*,gap=False):
    genome,goal=fixture(roof_z=4. if gap else 2.)
    intent=IntentContract("bearing-site","Confirm native contact",("bear",))
    spatial=SpatialIntent(intent.identity,goal.goals,"operator")
    inventory=LocationStack(intent.location)
    inventory.add_frame(Frame("operator-local","local3d","model_unit"))
    src=tmp_path/"source"
    create_workspace(inventory,genome.declaration(intent.location),src)
    return src,genome,spatial


def test_bearing_attaches_one_originally_absent_causal_support(tmp_path):
    source,genome,spatial=original(tmp_path)
    before=verify_workspace(source)
    output=tmp_path/"causal"
    receipt=materialize_bearing_support(source,genome,spatial,output,actor="operator")
    assert verify_bearing_support(source,genome,spatial,output)==receipt
    assert receipt["source_workspace_sha256"]==before["workspace_sha256"]
    assert verify_workspace(source)==before
    assert not receipt["load_certification"] and not receipt["automatic_promotion"]
    (output/"receipt.json").write_text(json.dumps({**receipt,"actor_attribution":"pretender"}))
    with pytest.raises(ValueError,match="receipt diverges"):
        verify_bearing_support(source,genome,spatial,output)


def test_native_bearing_gap_refuses_before_causal_workspace_is_created(tmp_path):
    source,genome,spatial=original(tmp_path,gap=True)
    with pytest.raises(ValueError,match="must independently prove"):
        materialize_bearing_support(source,genome,spatial,tmp_path/"forbidden",
                                     actor="operator")
    assert not (tmp_path/"forbidden").exists()


def test_causal_bearing_cli_emits_attributed_replayable_native_workspace(tmp_path):
    from projection_loom.cli import main
    source,genome,spatial=original(tmp_path)
    (tmp_path/"genome.json").write_text(json.dumps(genome.to_dict()))
    (tmp_path/"spatial.json").write_text(json.dumps(spatial.to_dict()))
    args=["--workspace",str(source),"--genome",str(tmp_path/"genome.json"),
          "--spatial",str(tmp_path/"spatial.json")]
    out=tmp_path/"materialized"
    created=main(["place-bearing-support",*args,"--actor","operator","--out",str(out)])
    assert not created["load_certification"]
    assert main(["place-bearing-support-verify",*args,"--causal",str(out)])==created
