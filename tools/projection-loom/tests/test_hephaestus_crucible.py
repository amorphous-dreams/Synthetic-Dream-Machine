"""Held-out independent subject: native, scene, causal and adversarial."""
import json
import pytest
from projection_loom.hephaestus_crucible import run_crucible


def test_multi_representation_held_out_crucible(tmp_path):
    result = run_crucible(tmp_path / "campaign")
    assert result["stable_semantic_ids"]
    assert result["native_step_reimport"]
    assert result["usd_composition_reopened"]
    assert result["stale_edit_refused"]
    assert result["tampered_step_refused"]
    assert result["actual_cache_reuse"] == 1
    assert result["source_camera_authority"] == "none"
    assert result["automatic_promotion"] is False
    with pytest.raises(ValueError, match="independently new"):
        run_crucible(tmp_path / "campaign")
    assert json.loads((tmp_path / "campaign" / "crucible.json").read_text()) == result
