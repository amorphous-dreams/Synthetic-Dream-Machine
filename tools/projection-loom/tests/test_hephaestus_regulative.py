"""Actual native site adaptation and matched OODA-HA controls."""
import json
import pytest

from projection_loom.developmental import GrowthNode, GrowthProgram, compile_growth
from projection_loom.regulative_growth import regulate, matched_trial


def program(width):
    return GrowthProgram((
        GrowthNode("root", "foundation", size=(width, width, 2)),
        GrowthNode("terrace", "spawn", parent="root", face="up",
                   size=(2, 2, 1)),
    ))


def test_regulation_adapts_to_local_supported_capacity():
    six, events_six = regulate(program(6), fill=.40)
    eight, events_eight = regulate(program(8), fill=.40)
    assert six.nodes[1].size[:2] == (2.4, 2.4)
    assert eight.nodes[1].size[:2] == (3.2, 3.2)
    assert events_six[0]["producer"] == "root"
    assert events_eight[0]["site"] == "root/up"
    assert compile_growth(six).audit()["valid"]
    assert compile_growth(eight).audit()["valid"]
    assert six.identity != eight.identity


def test_regulative_control_uses_existing_five_phase_helm(tmp_path):
    report = matched_trial(program(6), tmp_path / "trial", fill=.40)
    assert report["exact_attempts_per_arm"] == 1
    assert report["source_fitness"] is None
    assert report["automatic_promotion"] is False
    assert report["arms"]["fixed"]["state"] == "native-valid"
    assert report["arms"]["regulative"]["state"] == "native-valid"
    assert len(report["rule_activations"]) == 1
    session = json.loads((tmp_path / "trial" / "session.json").read_text())
    assert session["status"] == "completed"
    assert all(loop["phase"] == "closed" for loop in session["loops"].values())


def test_regulation_refuses_unbounded_claims():
    for ratio in (0, float("nan"), float("inf"), 1.1):
        with pytest.raises(ValueError, match="Regulative fill"):
            regulate(program(6), fill=ratio)


def test_distinct_independent_subject_has_no_necrospire_constants(tmp_path):
    # A horizontal coastal platform is materially different from the original seed.
    other = GrowthProgram((
        GrowthNode("root", "foundation", size=(12, 4, 1.5)),
        GrowthNode("jetty", "spawn", parent="root", face="east",
                   size=(2, 2, 1)),
    ))
    result = matched_trial(other, tmp_path / "coastal", fill=.50)
    assert result["arms"]["fixed"]["state"] == "native-valid"
    assert result["arms"]["regulative"]["state"] == "native-valid"
    assert result["rule_activations"][0]["orientation"] == (1, 0, 0) or result[
        "rule_activations"][0]["orientation"] == [1, 0, 0]
