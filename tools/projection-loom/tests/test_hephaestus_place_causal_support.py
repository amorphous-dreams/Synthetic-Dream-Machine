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
