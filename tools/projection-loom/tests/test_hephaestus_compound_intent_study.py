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
