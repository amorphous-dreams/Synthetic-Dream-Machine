"""Same native source and exact budgets, different authored spatial births."""
from projection_loom.place_matched_trial import run_matched_architecture
import pytest


def test_two_supported_intents_produce_independent_native_location_lineages(tmp_path):
    report=run_matched_architecture(tmp_path/"matched",seeds=(41,),epochs=1)
    assert len(report["arms"])==2
    assert {x["arm"] for x in report["arms"]}=={"shelter","ascent"}
    assert len({x["original_genome_sha256"] for x in report["arms"]})==1
    assert len({x["native_candidate_sha256"] for x in report["arms"]})==2
    assert all(x["admitted"]==1 for x in report["arms"])
    assert not report["source_camera_registration"] and not report["automatic_artistic_winner"]


def test_matched_trial_output_is_immutable_not_an_artificial_best_arm(tmp_path):
    out=tmp_path/"campaign"
    run_matched_architecture(out,seeds=(41,),epochs=1)
    with pytest.raises(ValueError,match="new immutable root"):
        run_matched_architecture(out,seeds=(41,),epochs=1)
