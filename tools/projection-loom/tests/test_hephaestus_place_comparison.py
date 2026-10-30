"""N8-O: comparison keeps unresolved alternatives and real scene references."""
import json
from projection_loom.place_comparison import place_comparison,verify_place_comparison
from test_hephaestus_place_campaign import setup
from projection_loom.place_campaign import run_place_campaign
import pytest

def test_comparison_reopens_native_finalists_and_keeps_operator_choice_free(tmp_path):
    data=setup()
    root=tmp_path/"scene"
    run_place_campaign(*data,root,epochs=1,offspring=2,exact_budget=2,seed=23)
    receipt=place_comparison(root,tmp_path/"comparison.json")
    assert len(receipt["candidates"])==2
    assert not receipt["automatic_ranking"] and not receipt["automatic_artist_winner"]
    assert receipt["admitted"]>=1
    for item in receipt["candidates"]:
        if item["status"]=="admitted":
            assert item["native_scene"]["native_step"]
            assert item["native_scene"]["usd_scene"].endswith(".usda")
    assert verify_place_comparison(root,receipt)
    forged=json.loads(json.dumps(receipt))
    forged["admitted"]+=1
    with pytest.raises(ValueError,match="diverges"):
        verify_place_comparison(root,forged)
