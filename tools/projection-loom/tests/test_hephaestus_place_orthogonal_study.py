"""Two explicit right-angle routes share one source but not one geometry."""
import json
import pytest
from test_hephaestus_place_orthogonal_route import site
from projection_loom.place_orthogonal_study import run_orthogonal_study,verify_orthogonal_study


def test_native_two_turn_study_preserves_equal_budget_and_alternatives(tmp_path):
    genome,goal=site()
    destination=tmp_path/"turns"
    result=run_orthogonal_study(genome,goal,destination,
                                location="two-choice-site",corner_id="landing")
    assert result["same_original_native_site"]
    assert result["distinct_witnessed_route_layouts"]
    assert result["two_distinct_genomes"]
    assert result["native_attempts"]==2
    assert all(x["status"]=="native-route-witnessed" for x in result["arms"])
    assert [x["turn"] for x in result["arms"]]==["x-then-y","y-then-x"]
    assert not result["automatic_selection"] and not result["physical_safety_certification"]
    assert verify_orthogonal_study(destination,genome,goal,
                                   location="two-choice-site",corner_id="landing")==result
    assert run_orthogonal_study(genome,goal,destination,
                               location="two-choice-site",corner_id="landing")==result


def test_forged_bend_witness_refuses_replay(tmp_path):
    genome,goal=site()
    destination=tmp_path/"turns"
    run_orthogonal_study(genome,goal,destination,
                         location="two-choice-site",corner_id="landing")
    path=destination/"x-then-y"/"receipt.json"
    row=json.loads(path.read_text())
    row["native_evidence"]["all_declared_goals_witnessed"]=False
    path.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="diverged"):
        verify_orthogonal_study(destination,genome,goal,
                                location="two-choice-site",corner_id="landing")

def test_matched_turn_cli_preserves_original_authorized_native_choices(tmp_path):
    from projection_loom.cli import main
    genome,goal=site()
    (tmp_path/"genome.json").write_text(json.dumps(genome.to_dict()))
    (tmp_path/"spatial.json").write_text(json.dumps(goal.to_dict()))
    argv=["--genome",str(tmp_path/"genome.json"),
          "--spatial",str(tmp_path/"spatial.json"),
          "--location","two-choice-site","--corner-id","landing"]
    folder=tmp_path/"study"
    record=main(["place-orthogonal-study",*argv,"--out",str(folder)])
    assert record==main(["place-orthogonal-study-verify",*argv,"--study",str(folder)])
    assert record["native_budget_per_arm"]==1
    assert record["two_distinct_genomes"]


def test_forged_comparison_cannot_promote_distinctness(tmp_path):
    genome,goal=site()
    destination=tmp_path/"turns"
    run_orthogonal_study(genome,goal,destination,
                         location="two-choice-site",corner_id="landing")
    path=destination/"summary.json"
    row=json.loads(path.read_text())
    row["distinct_witnessed_route_layouts"]=False
    path.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="distinct|provenance"):
        verify_orthogonal_study(destination,genome,goal,
                                location="two-choice-site",corner_id="landing")

def test_witnessed_layout_preserves_route_order_not_just_scene_identity():
    from projection_loom.place_orthogonal_study import witnessed_route_layout
    from projection_loom.place_orthogonal_route import propose_orthogonal_route
    genome,spatial=site()
    a=propose_orthogonal_route(genome,spatial,turn="x-then-y",corner_id="landing")
    b=propose_orthogonal_route(genome,spatial,turn="y-then-x",corner_id="landing")
    def evidence(axes):
        return {"all_declared_goals_witnessed":True,"goals":[
            {"status":"geometric-route-proposal","proof":{"segments":[
                {"principal_axis":axis,"route_width_lower_bound":1.0,
                 "deck_to_endpoint_step_upper_bound":0.0} for axis in axes]}}]}
    left=witnessed_route_layout(a,evidence(["x","y"]))
    right=witnessed_route_layout(b,evidence(["y","x"]))
    assert left!=right and left["ordered_route_axes"]==["x","y"]
    assert right["ordered_route_axes"]==["y","x"]
    assert witnessed_route_layout(a,{"all_declared_goals_witnessed":False}) is None
