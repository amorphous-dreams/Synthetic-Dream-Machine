"""Cross-parent candidate requires independent native STEP evidence and replay."""
import json
import pytest
from projection_loom.place_recombination_study import run_recombined_native,verify_recombined_native
from test_hephaestus_place_recombination import seed


def test_real_native_recombination_has_independent_full_goal_evidence(tmp_path):
    original,left,right,aim=seed()
    root=tmp_path/"child"
    opts={"location":"recombined-place","left_generated":["intent_deck_000"],
          "right_generated":["roof"]}
    row=run_recombined_native(original,left,right,aim,root,**opts)
    assert row["status"]=="native-all-goals-witnessed"
    assert len(row["goal_statuses"])==2
    assert row["parental_native_success_inherited"] is False
    assert verify_recombined_native(root,original,left,right,aim,**opts)==row


def test_recombined_native_refuses_forged_parental_success(tmp_path):
    original,left,right,aim=seed()
    root=tmp_path/"child"
    opts={"location":"recombined-place","left_generated":["intent_deck_000"],
          "right_generated":["roof"]}
    run_recombined_native(original,left,right,aim,root,**opts)
    path=root/"receipt.json"
    record=json.loads(path.read_text())
    record["parental_native_success_inherited"]=True
    path.write_text(json.dumps(record))
    with pytest.raises(ValueError,match="native STEP or spatial proof changed"):
        verify_recombined_native(root,original,left,right,aim,**opts)
