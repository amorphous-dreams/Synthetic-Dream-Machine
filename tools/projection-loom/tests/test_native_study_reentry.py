"""Complete native studies replay read-only; incomplete and conflicting roots refuse."""
import pytest
from projection_loom.study_reentry import replay_completed_or_require_fresh


def test_untouched_root_is_fresh_and_occupied_root_refuses(tmp_path):
    root=tmp_path/"study"
    verify=lambda: {"verified":True}
    args={"completion":"summary.json","verify":verify,"occupied_reason":"occupied"}
    assert replay_completed_or_require_fresh(root,**args) is None
    root.mkdir()
    with pytest.raises(ValueError,match="occupied"):
        replay_completed_or_require_fresh(root,**args)
    (root/"summary.json").write_text("{}")
    assert replay_completed_or_require_fresh(root,**args)=={"verified":True}
    (root/"FAILED").write_text("incomplete")
    with pytest.raises(ValueError,match="occupied"):
        replay_completed_or_require_fresh(root,**args)


def test_completed_marker_only_selects_independent_verifier(tmp_path):
    root=tmp_path/"study"
    root.mkdir()
    (root/"receipt.json").write_text("{}")
    def broken_source():
        raise ValueError("independent source mismatch")
    with pytest.raises(ValueError,match="source mismatch"):
        replay_completed_or_require_fresh(
            root,completion="receipt.json",verify=broken_source,occupied_reason="occupied")
