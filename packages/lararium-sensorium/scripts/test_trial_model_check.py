"""An offline trial model is named by its exact bytes before a holder starts."""

import hashlib
import json

import pytest

from trial_model_check import verify_model


def test_model_asset_hashes_and_state_boundary(tmp_path):
    state = tmp_path / "state"
    cache = state / "cache" / "model"
    cache.mkdir(parents=True)
    asset = cache / "model.bin"
    asset.write_bytes(b"model bytes")
    lock = tmp_path / "lock.json"
    record = {"schema": "lararium.sensorium.trial-model-assets.v1", "model": "trial",
              "dimensions": 3, "cache_path": "cache/model",
              "files": {"model.bin": hashlib.sha256(asset.read_bytes()).hexdigest()}}
    lock.write_text(json.dumps(record))
    assert verify_model(state, lock)["verified_assets"] == 1
    asset.write_bytes(b"changed")
    with pytest.raises(ValueError, match="hash changed"):
        verify_model(state, lock)
    record["cache_path"] = "../outside"
    lock.write_text(json.dumps(record))
    with pytest.raises(ValueError, match="beneath state"):
        verify_model(state, lock)
