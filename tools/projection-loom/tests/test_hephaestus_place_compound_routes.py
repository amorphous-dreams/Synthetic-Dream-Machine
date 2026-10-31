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
    assert len(result["authored_goal_contrasts"])==2
    assert all(not x["automatic_operator_choice"] for x in result["authored_goal_contrasts"])
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

def test_compound_bend_native_cli_uses_original_typed_sources(tmp_path):
    from projection_loom.cli import main
    site,aim=inputs()
    (tmp_path/"site.json").write_text(json.dumps(site.to_dict()))
    (tmp_path/"aim.json").write_text(json.dumps(aim.to_dict()))
    source=["--genome",str(tmp_path/"site.json"),"--spatial",str(tmp_path/"aim.json"),
            "--location","compound-place","--goal-index","0","--corner-id","bend"]
    out=tmp_path/"cli-study"
    result=main(["place-compound-routes",*source,"--out",str(out)])
    assert result["native_attempts"]==2
    assert main(["place-compound-routes-verify",*source,
                 "--study",str(out)])==result

def test_compound_summary_cannot_reassign_failure_to_another_goal(tmp_path):
    original,aim=inputs()
    path=tmp_path/"study"
    run_compound_route_study(original,aim,path,
                             location="compound-place",goal_index=0,corner_id="bend")
    file=path/"summary.json"
    row=json.loads(file.read_text())
    row["authored_goal_contrasts"][0]["goal_index"]=1
    file.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="alternatives or refusal census"):
        verify_compound_route_study(original,aim,path,
                              location="compound-place",goal_index=0,corner_id="bend")
