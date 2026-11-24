"""Re-entry contracts: what each producer does when its destination already stands.

Characterization only; no producer changes to satisfy a test. Replay (identical
bytes accepted, changed bytes refused) belongs to `save_once`; the native study
producers refuse an occupied destination on purpose and leave its bytes alone.
"""
import json
import pytest
from PIL import Image
from projection_loom.receipt_store import read_json, save_once
from projection_loom.intent_seed import IntentContract, SeedBundle, SeedEntry
from projection_loom.location_stack import Frame, LocationStack
from projection_loom.location_workspace import create_workspace
from projection_loom.place_bearing_causal import materialize_bearing_support
from projection_loom.place_board import render_place_board
from projection_loom.place_causal_support import materialize_crossing_support
from projection_loom.place_gallery import render_place_gallery
from projection_loom.place_source_transfer import run_source_transfer
from projection_loom.spatial_intent import SpatialIntent
from test_hephaestus_place_bearing import fixture
from test_hephaestus_place_campaign import setup


def _tree(root):
    return {str(p.relative_to(root)): (p.read_bytes() if p.is_file() else None)
            for p in sorted(root.rglob("*"))}


def _occupied(path):
    path.mkdir()
    (path / "keep.txt").write_bytes(b"existing bytes")
    return _tree(path)


def test_read_json_is_the_plain_utf8_reader(tmp_path):
    payload = {"name": "pavillon élève", "n": [1, 2.5, None]}
    path = tmp_path / "r.json"
    path.write_bytes(json.dumps(payload, ensure_ascii=False).encode("utf8"))
    assert read_json(path) == payload
    assert read_json(str(path)) == payload


def test_save_once_replays_identical_bytes_and_refuses_changed_ones(tmp_path):
    path = tmp_path / "out" / "receipt.json"
    save_once(path, {"a": 1})
    first = path.read_bytes()
    save_once(path, {"a": 1})
    assert path.read_bytes() == first
    with pytest.raises(ValueError, match="collides with a different immutable receipt"):
        save_once(path, {"a": 2})
    assert path.read_bytes() == first
    assert [p.name for p in path.parent.iterdir()] == ["receipt.json"]


def test_gallery_refuses_an_occupied_destination_and_leaves_it_alone(tmp_path):
    folder = tmp_path / "gallery"
    before = _occupied(folder)
    with pytest.raises(ValueError, match="needs a fresh destination"):
        render_place_gallery(tmp_path / "campaign", folder)
    assert _tree(folder) == before


def test_board_refuses_an_occupied_destination_and_leaves_it_alone(tmp_path):
    folder = tmp_path / "board"
    before = _occupied(folder)
    with pytest.raises(ValueError, match="unused immutable destination"):
        render_place_board(tmp_path / "campaign", folder)
    assert _tree(folder) == before


def test_source_transfer_refuses_an_occupied_study_root_and_leaves_it_alone(tmp_path):
    image = tmp_path / "source.png"
    Image.new("RGBA", (8, 8), (30, 30, 30, 255)).save(image)
    grammar = tmp_path / "grammar.json"
    grammar.write_text('{"construct":"two sites"}')
    arms = {kind: SeedBundle((SeedEntry.from_file(kind, path),))
            for kind, path in (("image-group", image), ("constructive-grammar", grammar))}
    _, intent, spatial, genome = setup()
    root = tmp_path / "study"
    before = _occupied(root)
    with pytest.raises(ValueError, match="needs a new immutable study root"):
        run_source_transfer(arms, intent, spatial, genome, root,
                            epochs=1, offspring=1, exact_budget=1)
    assert _tree(root) == before


def test_crossing_support_refuses_an_occupied_destination_and_leaves_it_alone(tmp_path):
    inventory, intent, spatial, genome = setup()
    source = tmp_path / "source"
    create_workspace(inventory, genome.declaration(intent.location), source)
    destination = tmp_path / "causal"
    before = _occupied(destination)
    with pytest.raises(ValueError, match="fresh immutable destination"):
        materialize_crossing_support(source, genome, spatial, destination, actor="operator")
    assert _tree(destination) == before


def test_bearing_support_refuses_an_occupied_destination_and_leaves_it_alone(tmp_path):
    genome, goal = fixture(roof_z=2.)
    intent = IntentContract("bearing-site", "Confirm native contact", ("bear",))
    spatial = SpatialIntent(intent.identity, goal.goals, "operator")
    inventory = LocationStack(intent.location)
    inventory.add_frame(Frame("operator-local", "local3d", "model_unit"))
    source = tmp_path / "source"
    create_workspace(inventory, genome.declaration(intent.location), source)
    destination = tmp_path / "causal"
    before = _occupied(destination)
    with pytest.raises(ValueError, match="fresh immutable destination"):
        materialize_bearing_support(source, genome, spatial, destination, actor="operator")
    assert _tree(destination) == before
