"""Fourth independent producer enters the generic machina without a kind switch."""
import json

from projection_loom.intent_seed import SeedEntry, IntentContract
from projection_loom.seed_adapters import SeedAdapter
from projection_loom.generalized_campaign import initial_program, run_cohort


def adapter(tmp_path, identifier, width):
    path = tmp_path / f"{identifier}.json"
    program = {"growth_program": {"nodes": [
        {"key": "base", "op": "foundation", "size": [width, width, 2]},
        {"key": "rail", "op": "spawn", "parent": "base",
         "face": "up", "size": [1.5, 1.5, 1]}]}}
    path.write_text(json.dumps(program))
    evidence = SeedEntry.from_file("independent-program", path, frame_kind="none",
                                   authority="proposed")
    return SeedAdapter(evidence, program)


def test_independent_producer_generates_native_construction(tmp_path):
    custom = adapter(tmp_path, "coastal", 6)
    offer = initial_program([custom])
    assert offer.nodes[0].key == "root"
    assert offer.nodes[1].parent == "root"
    contract = IntentContract("held-out-coast", "grow a coastal canopy",
                              ("native-validity", "structural-novelty"))
    report = run_cohort((custom,), contract, tmp_path / "result",
                        epochs=1, offspring=1, exact_budget=1, finalists=1)
    assert report["status"] == "completed"
    assert report["native_valid"] >= 1


def test_two_new_producers_compose_without_engine_case_switch(tmp_path):
    a = adapter(tmp_path, "east", 6)
    b = adapter(tmp_path, "west", 7)
    whole = initial_program([a, b])
    assert len(whole.nodes) == 3
    assert len({x.key for x in whole.nodes}) == 3
    assert whole.nodes[-1].parent == "root"


def test_new_kind_requires_explicit_frame(tmp_path):
    path = tmp_path / "seed.json"
    path.write_text("{}")
    import pytest
    with pytest.raises(ValueError, match="explicitly name its source frame"):
        SeedEntry.from_file("independent-program", path)
