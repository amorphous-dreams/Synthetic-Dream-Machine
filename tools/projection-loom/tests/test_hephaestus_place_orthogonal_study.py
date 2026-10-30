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
