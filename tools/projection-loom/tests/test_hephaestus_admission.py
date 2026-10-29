"""N6-A: source producers enter one inventory without inventing registration."""
from projection_loom.intent_seed import SeedEntry, SeedBundle, IntentContract, normalize_location
from projection_loom.location_stack import LocationStack


def test_seed_admission_matches_canonical_owner_and_preserves_bytes(tmp_path):
    source = tmp_path / "photograph.bin"
    source.write_bytes(b"independently attributed observation")
    seed = SeedBundle((SeedEntry.from_file("image-group", source),))
    intent = IntentContract("admitted-place", "construct", ("preserve-source",))
    output = normalize_location(seed, intent)
    assert output.to_dict() == LocationStack.admit_seed_bundle(seed, intent).to_dict()
    assert list(output.verify_source_bytes().values()) == ["matched"]
    assert output.audit()["verified_registrations"] == 0
    assert len(output.frames) == 1 and next(iter(output.frames.values())).kind == "pixel"


def test_registered_admission_refuses_claim_without_two_independent_views():
    from pytest import raises
    with raises(ValueError, match="two or more cameras"):
        LocationStack.admit_registered_views([], "empty-place")
