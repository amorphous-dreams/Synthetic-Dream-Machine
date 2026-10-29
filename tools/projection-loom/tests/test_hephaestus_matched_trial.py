"""Two-generation matched-source objective experiment with independent native evidence."""
import json
from pathlib import Path
import pytest
from projection_loom.seed_adapters import image_group
from projection_loom.intent_seed import IntentContract
from projection_loom.matched_registered_trial import matched_registered_ablation
from test_hephaestus_registered_multiview import evidence


def _inputs(tmp_path):
    adapters = image_group(evidence(tmp_path))
    intent = IntentContract(
        "held-out-multiview-ablation",
        "compare source-conditioned and image-withheld native growth",
        ("native-validity","source-silhouette","structural-novelty"))
    return adapters, intent


def test_matched_two_generation_cad_auditions_and_paired_baseline(tmp_path):
    adapters, intent = _inputs(tmp_path)
    output = tmp_path / "experiment"
    comparison = matched_registered_ablation(
        adapters, intent, output, epochs=2, offspring=2,
        exact_budget=2, finalists=1, seed=73)
    assert comparison["same_first_epoch_native_candidates"]
    assert comparison["same_source_and_random_proposal_stream"]
    assert comparison["source_view_count"] == 2
    assert comparison["operator_winner"] is None
    assert comparison["automatic_promotion"] is False
    assert len(comparison["epochs"]) == 2
    assert len(comparison["measured_full_source_fitness"]) >= 1
    assert len(comparison["measured_full_source_fitness"][0]) == 2
    for epoch in comparison["epochs"]:
        assert epoch["withheld"]["attempted"] == epoch["measured"]["attempted"] == 2
        assert epoch["withheld"]["fitness_observed"] == 0
    manifest = json.loads((output / "pre_registration.json").read_text())
    assert manifest["epochs"] == 2 and manifest["exact_budget"] == 2
    assert json.loads((output / "comparison.json").read_text()) == comparison
    assert matched_registered_ablation(
        adapters, intent, output, epochs=2, offspring=2,
        exact_budget=2, finalists=1, seed=73) == comparison


def test_unregistered_or_modified_camera_cannot_enter_matched_evolution(tmp_path):
    adapters, intent = _inputs(tmp_path)
    with pytest.raises(ValueError, match="independent calibrated"):
        matched_registered_ablation(adapters[:1], intent, tmp_path / "too_few")
    import json
    cal = Path(adapters[0].registration["calibration_file"])
    record = json.loads(cal.read_text())
    record["max_rms_px"] = 2.0
    cal.write_text(json.dumps(record))
    with pytest.raises(ValueError, match="calibration changed"):
        matched_registered_ablation(adapters, intent, tmp_path / "altered")



def test_repeated_blind_source_audit_scores_both_selected_arms_without_leak(tmp_path):
    from projection_loom.matched_registered_trial import matched_registered_replicates
    adapters, intent = _inputs(tmp_path)
    site = tmp_path / "replicates"
    report = matched_registered_replicates(
        adapters, intent, site, seeds=(73, 91), epochs=2, offspring=2,
        exact_budget=2, finalists=1)
    assert report["replicate_count"] == 2
    assert report["operator_winner"] is None
    assert report["observed_min_delta"] <= report["descriptive_mean_delta"] <= report["observed_max_delta"]
    for row in report["trials"]:
        assert row["native_auditions"] == {"withheld": 4, "measured": 4}
        assert len(row["per_arm_post_selection"]["withheld"][0]["registered_source_views"]) == 2
        assert len(row["per_arm_post_selection"]["measured"][0]["registered_source_views"]) == 2
        withheld = site / f"seed-{row['seed']}" / "withheld"
        for winner in json.loads((withheld / "summary.json").read_text())["finalists"]:
            assert json.loads((withheld / "finalists" / (winner["id"] + ".json")).read_text())["full_source"] is None
    assert matched_registered_replicates(
        adapters, intent, site, seeds=(73, 91), epochs=2, offspring=2,
        exact_budget=2, finalists=1) == report
    assert not report["automatic_promotion"]
