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

def test_recombined_genome_file_cannot_be_rewritten_after_audition(tmp_path):
    original,left,right,aim=seed()
    root=tmp_path/"child"
    opts={"location":"recombined-place","left_generated":["intent_deck_000"],
          "right_generated":["roof"]}
    run_recombined_native(original,left,right,aim,root,**opts)
    path=root/"child_genome.json"
    written=json.loads(path.read_text())
    written["bodies"][-1]["translation"][0]+=1
    path.write_text(json.dumps(written))
    with pytest.raises(ValueError,match="child genotype"):
        verify_recombined_native(root,original,left,right,aim,**opts)

def test_completed_recombinant_replays_without_copying_parent_audition(tmp_path,monkeypatch):
    from projection_loom import place_recombination_study as module
    original,left,right,aim=seed()
    opts={"location":"recombined-place","left_generated":["intent_deck_000"],
          "right_generated":["roof"]}
    root=tmp_path/"child"
    first=run_recombined_native(original,left,right,aim,root,**opts)
    before=(root/"receipt.json").read_bytes()
    def forbidden_rebuild(*args,**kwargs):
        raise AssertionError("Completed recombinant replay must not rebuild STEP")
    monkeypatch.setattr(module,"package_scene",forbidden_rebuild)
    assert run_recombined_native(original,left,right,aim,root,**opts)==first
    assert (root/"receipt.json").read_bytes()==before
    with pytest.raises(ValueError,match="original parent sources or choice"):
        run_recombined_native(original,left,right,aim,root,
                              location="other-place",
                              left_generated=["intent_deck_000"],
                              right_generated=["roof"])
    incomplete=tmp_path/"incomplete"
    incomplete.mkdir()
    with pytest.raises(ValueError,match="fresh immutable study root"):
        run_recombined_native(original,left,right,aim,incomplete,**opts)
