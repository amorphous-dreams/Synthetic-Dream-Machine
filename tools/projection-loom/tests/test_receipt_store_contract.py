"""Isomorphic immutable receipt publication retains deterministic bytes and safety."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import inspect
import json
import pytest
from projection_loom.receipt_store import save_once
import projection_loom.receipt_store as receipt_store


def test_receipt_store_does_not_import_campaign_controller():
    source=inspect.getsource(receipt_store)
    assert "generalized_campaign" not in source
    assert "fractal_ooda_ha" not in source


def test_save_once_preserves_formatted_bytes_across_identical_replays(tmp_path):
    path=tmp_path/"parent"/"receipt.json"
    payload={"z":3,"a":{"child":1}}
    assert save_once(path,payload) is None
    first=path.read_bytes()
    assert first==(json.dumps(payload,sort_keys=True,indent=2,allow_nan=False)+"\n").encode("utf8")
    assert save_once(path,{"a":{"child":1},"z":3}) is None
    assert path.read_bytes()==first
    with pytest.raises(ValueError,match="different immutable receipt"):
        save_once(path,{"a":{"child":2},"z":3})
    assert path.read_bytes()==first
    assert not tuple(path.parent.glob(".receipt.json.pending-*"))


def test_concurrent_same_content_publication_never_overwrites(tmp_path):
    path=tmp_path/"immutable.json"
    with ThreadPoolExecutor(max_workers=8) as executor:
        results=list(executor.map(lambda _: save_once(path,{"a":1}),range(16)))
    assert all(result is None for result in results)
    assert json.loads(path.read_text())=={"a":1}
    assert not tuple(tmp_path.glob(".immutable.json.pending-*"))


def test_invalid_non_finite_receipt_does_not_publish(tmp_path):
    path=tmp_path/"bad.json"
    with pytest.raises(ValueError):
        save_once(path,{"invalid":float("nan")})
    assert not path.exists()
