"""Full authored spatial intentions compare two independently native route births."""
import json
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_compound_routes import run_compound_route_study,verify_compound_route_study


def inputs():
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome((PlaceBody("east",p,(10,10,0)),
                          PlaceBody("refuge",p,(25,25,0)),
                          PlaceBody("west",p,(0,0,0))))
    aim=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),
                               SpatialGoal("shelter","refuge","roof")),"operator")
    return original,aim


def test_two_native_alternatives_preserve_complete_goals_and_separate_choices(tmp_path):
    original,aim=inputs()
    path=tmp_path/"study"
    result=run_compound_route_study(original,aim,path,
                                    location="compound-place",goal_index=0,corner_id="bend")
    assert result["native_attempts"]==2
    assert len(result["arms"])==2
    assert all(len(row["goal_statuses"])==2 for row in result["arms"])
    assert result["arms"][0]["result_genome_sha256"]!=result["arms"][1]["result_genome_sha256"]
    assert result["distinct_witnessed_route_layouts"]
    assert not result["automatic_artistic_winner"]
    assert verify_compound_route_study(original,aim,path,
                   location="compound-place",goal_index=0,corner_id="bend")==result


def test_native_comparison_rejects_forged_other_goal_or_turn(tmp_path):
    original,aim=inputs()
    path=tmp_path/"study"
    run_compound_route_study(original,aim,path,
                             location="compound-place",goal_index=0,corner_id="bend")
    arm=path/"x-then-y"/"receipt.json"
    data=json.loads(arm.read_text())
    data["goal_statuses"][1]["status"]="geometric-route-proposal"
    arm.write_text(json.dumps(data))
    with pytest.raises(ValueError,match="differs"):
        verify_compound_route_study(original,aim,path,
                              location="compound-place",goal_index=0,corner_id="bend")
