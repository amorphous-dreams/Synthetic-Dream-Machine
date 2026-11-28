"""N8-P: same original orthos display distinct native geometry without survey claims."""
from projection_loom.place_gallery import render_place_gallery,verify_place_gallery
from test_hephaestus_place_campaign import setup
from projection_loom.place_campaign import run_place_campaign
import pytest

def test_six_view_gallery_preserves_frozen_original_cameras_and_native_sha(tmp_path):
    data=setup()
    campaign=tmp_path/"campaign"
    summary=run_place_campaign(*data,campaign,epochs=1,offspring=2,exact_budget=2,seed=23)
    gallery=tmp_path/"gallery"
    output=render_place_gallery(campaign,gallery)
    assert not output["source_camera_registration"]
    assert output["candidate_count"]==summary["attempted"]
    assert any(row["six_view"] for row in output["entries"])
    assert verify_place_gallery(campaign,gallery)
    selected=next(x["six_view"] for x in output["entries"] if x["six_view"])
    (gallery/selected).write_bytes(b"corrupted generated pixels")
    with pytest.raises(ValueError,match="illustration changed"):
        verify_place_gallery(campaign,gallery)
