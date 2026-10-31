"""A failed compound shape must not contaminate its controlled ablation arms."""
import json
import pytest
from test_hephaestus_compound_spatial import combined
from projection_loom.compound_intent_study import (run_compound_intent_study,
                                                   verify_compound_intent_study)


def test_source_fixed_compound_intent_ablation_reimports_each_native_arm(tmp_path):
    original,intent,spatial=combined()
    path=tmp_path/"study"
    report=run_compound_intent_study(intent,spatial,original,path)
    assert len(report["arms"])==3
    assert report["native_budget_per_arm"]==1
    assert report["same_original_native_genome"]
    assert [r["arm_id"] for r in report["arms"]]==["full","without-00","without-01"]
    assert report["native_attempts"]==3
    assert len(report["intent_goal_contrasts"])==2
    assert all(row["causal_synergy_certified"] is False for row in report["intent_goal_contrasts"])
    assert all(r["native_evidence"] is not None for r in report["arms"])
    assert not report["automatic_artistic_winner"]
    assert verify_compound_intent_study(path,intent,spatial,original)==report
    assert run_compound_intent_study(intent,spatial,original,path)==report


def test_ablated_native_receipt_cannot_adopt_an_unearned_success(tmp_path):
    original,intent,spatial=combined()
    path=tmp_path/"study"
    run_compound_intent_study(intent,spatial,original,path)
    f=path/"without-00"/"receipt.json"
    row=json.loads(f.read_text())
    row["native_evidence"]["all_declared_goals_witnessed"]=not row[
        "native_evidence"]["all_declared_goals_witnessed"]
    f.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="diverged"):
        verify_compound_intent_study(path,intent,spatial,original)

def test_cli_matched_ablation_reuses_original_survey_free_native_inputs(tmp_path):
    from projection_loom.cli import main
    original,intent,spatial=combined()
    contract={"location":intent.location,"aim":intent.aim,
              "objectives":list(intent.objectives),
              "invariants":list(intent.invariants),
              "budgets":[list(row) for row in intent.budgets]}
    for label,document in (("intent",contract),("spatial",spatial.to_dict()),
                           ("genome",original.to_dict())):
        (tmp_path/(label+".json")).write_text(json.dumps(document))
    arguments=["--intent",str(tmp_path/"intent.json"),
               "--spatial",str(tmp_path/"spatial.json"),
               "--genome",str(tmp_path/"genome.json")]
    study=tmp_path/"native-contrast"
    first=main(["place-intent-ablate",*arguments,"--out",str(study)])
    second=main(["place-intent-ablate-verify",*arguments,"--study",str(study)])
    assert first==second
    assert all(r["native_evidence"]["spatial_intent_sha256"] for r in first["arms"])

def test_forged_intent_contrast_refuses_even_if_status_seems_plausible(tmp_path):
    original,intent,spatial=combined()
    path=tmp_path/"study"
    run_compound_intent_study(intent,spatial,original,path)
    report_path=path/"summary.json"
    receipt=json.loads(report_path.read_text())
    receipt["intent_goal_contrasts"][0]["observed_status_differs"]=True
    report_path.write_text(json.dumps(receipt))
    with pytest.raises(ValueError,match="contrasts"):
        verify_compound_intent_study(path,intent,spatial,original)
