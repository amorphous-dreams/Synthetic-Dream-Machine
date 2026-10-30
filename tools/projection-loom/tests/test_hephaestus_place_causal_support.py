"""Only true horizontal native bearing becomes causal support ancestry."""
import pytest
from projection_loom.place_causal_support import materialize_crossing_support,verify_crossing_support
from projection_loom.location_workspace import create_workspace
from test_hephaestus_place_campaign import setup
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent


def test_two_bearing_native_crossing_forks_two_real_causal_workspaces(tmp_path):
    inventory,intent,spatial,genome=setup()
    source=tmp_path/"source"
    original=create_workspace(inventory,genome.declaration(intent.location),source)
    result=materialize_crossing_support(source,genome,spatial,
                                      tmp_path/"causal",actor="operator")
    assert result["source_workspace_sha256"]==original["sha256"]
    assert len(result["links"])==2
    assert not result["load_certification"] and not result["automatic_promotion"]
    assert verify_crossing_support(source,genome,spatial,tmp_path/"causal")==result
    assert (tmp_path/"causal"/"support-2"/"scene"/"manifest.json").is_file()


def test_shelter_never_forged_into_load_bearing_relation(tmp_path):
    inventory,intent,spatial,genome=setup()
    source=tmp_path/"source"
    create_workspace(inventory,genome.declaration(intent.location),source)
    cover=SpatialIntent(spatial.intent_sha256,
        (SpatialGoal("shelter","west","deck"),),"operator")
    with pytest.raises(ValueError,match="Only one independently witnessed horizontal crossing"):
        materialize_crossing_support(source,genome,cover,
                                    tmp_path/"wrong",actor="operator")
    assert not (tmp_path/"wrong").exists()

def test_mutated_support_receipt_cannot_change_event_under_fresh_digest(tmp_path):
    import json
    from projection_loom.provenance_encoding import canonical_json_sha256
    inventory,intent,spatial,genome=setup()
    source=tmp_path/"source"
    create_workspace(inventory,genome.declaration(intent.location),source)
    out=tmp_path/"causal"
    materialize_crossing_support(source,genome,spatial,out,actor="operator")
    record=json.loads((out/"receipt.json").read_text())
    record["links"][1]["event_id"]="0"*64
    record["sha256"]=canonical_json_sha256({k:v for k,v in record.items() if k!="sha256"})
    (out/"receipt.json").write_text(json.dumps(record))
    with pytest.raises(ValueError,match="event or native contact"):
        verify_crossing_support(source,genome,spatial,out)


def test_cli_materializes_and_reaudits_two_native_causal_forks(tmp_path):
    import json
    from projection_loom.cli import main
    inventory,intent,spatial,genome=setup()
    source=tmp_path/"source"
    create_workspace(inventory,genome.declaration(intent.location),source)
    (tmp_path/"genome.json").write_text(json.dumps(genome.to_dict()))
    (tmp_path/"spatial.json").write_text(json.dumps(spatial.to_dict()))
    common=["--workspace",str(source),"--genome",str(tmp_path/"genome.json"),
            "--spatial",str(tmp_path/"spatial.json")]
    first=main(["place-causal-support",*common,"--actor","operator",
                "--out",str(tmp_path/"forks")])
    second=main(["place-causal-support-verify",*common,"--causal",str(tmp_path/"forks")])
    assert first==second and len(second["links"])==2
