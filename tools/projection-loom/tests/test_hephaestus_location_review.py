"""N6-D: operator review records attribution without automatic promotion."""
import pytest
from projection_loom.location_stack import Frame, LocationStack
from projection_loom.location_workspace import create_workspace
from projection_loom.location_review import review_location, verify_location_review


def test_review_is_immutable_and_refuses_unattributed_dissent(tmp_path):
    stack=LocationStack("reviewable")
    stack.add_frame(Frame("local","local3d","m"))
    document={"schema":"projection-loom/scene-declaration","location":"reviewable",
              "meters_per_unit":1.,"assemblies":[{"entity_id":"one",
              "growth_program":{"nodes":[{"key":"root","op":"foundation",
                                           "size":[2,2,2]}]}}]}
    scene=tmp_path/"source"
    create_workspace(stack,document,scene)
    with pytest.raises(ValueError,match="dissent"):
        review_location(scene,actor="operator",decision="dissent",reason="",destination=tmp_path/"bad")
    report=review_location(scene,actor="operator",decision="abstain",reason="",destination=tmp_path/"decision.json")
    assert report["automatic_canon_promotion"] is False
    assert verify_location_review(scene,report)
    with pytest.raises(ValueError,match="new immutable"):
        review_location(scene,actor="operator",decision="abstain",reason="",destination=tmp_path/"decision.json")
