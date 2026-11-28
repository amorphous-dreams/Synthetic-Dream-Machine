"""N8-M: one original location, two equally costly native intent outcomes."""
from projection_loom.place_intent_contrast import run_intent_contrast

def test_intent_changes_native_construction_without_camera_or_safety_claim(tmp_path):
    report=run_intent_contrast(tmp_path/"contrast")
    assert len(report["arms"])==2
    assert report["same_exact_native_audition_budget"]
    assert report["source_fitness_claim"] is None
    assert report["arms"][0]["place_genome_sha256"]!=report["arms"][1]["place_genome_sha256"]
