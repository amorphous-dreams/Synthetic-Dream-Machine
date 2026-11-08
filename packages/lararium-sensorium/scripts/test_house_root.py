"""The one named house root, the Python tongue: an unnamed root refuses, and every entry lays beneath it.

The cross-language half (TS and Python tables equal) lives in `packages/lararium-node/tests/house-root-weld.test.ts`.
"""
import os

import pytest

import guest_harvest
import house_root
import lares_uds
import meta_io


@pytest.mark.parametrize("value", [None, "", "   "])
def test_house_paths_refuse_an_unnamed_root(monkeypatch, value):
    if value is None:
        monkeypatch.delenv("LAR_ROOT", raising=False)
    else:
        monkeypatch.setenv("LAR_ROOT", value)
    monkeypatch.setenv("XDG_DATA_HOME", "/xdg/data")   # present, and never consulted
    for resolve in (lares_uds.data_dir, lares_uds.identity_dir, guest_harvest.default_stage_root,
                    meta_io._meta_config_path, house_root.library_root):
        with pytest.raises(house_root.HouseRootUnnamed, match="set LAR_ROOT"):
            resolve()


def test_every_entry_stands_one_level_below_the_root(monkeypatch):
    monkeypatch.setenv("LAR_ROOT", "/house")
    j = os.path.join
    assert house_root.table() == {
        "larHouseRoot": "/house",
        "larHearthHome": j("/house", "hearth"),
        "larDataDir": j("/house", "hearth", "vessel"),
        "larIdentityDir": j("/house", "hearth", "identity"),
        "larSealHome": j("/house", "hearth", "nexus"),
        "larSensoriumsHome": j("/house", "hearth", "sensoriums"),
        "larCheckpointsHome": j("/house", "hearth", "checkpoints"),
        "larStagingHome": j("/house", "hearth", "staging"),
        "larProjectionCheckpointDir": j("/house", "hearth", "checkpoints", "projection"),
        "larHarvestCheckpointDir": j("/house", "hearth", "checkpoints", "harvest"),
        "larHarvestStagingDir": j("/house", "hearth", "staging", "harvest"),
        "larLibraryRoot": j("/house", "library"),
        "larProjectionsHome": j("/house", "projections"),
        "larConfigHome": j("/house", "config"),
        "larCacheHome": j("/house", "cache"),
        "larRuntimeHome": j("/house", "run"),
    }
    assert lares_uds.data_dir() == house_root.vessel_dir()
    assert lares_uds.identity_dir() == house_root.identity_dir()
    assert meta_io._meta_config_path() == j("/house", "config", "meta.json")


def test_the_library_and_projections_stand_outside_the_hearth(monkeypatch):
    monkeypatch.setenv("LAR_ROOT", "/house")
    hearth = house_root.hearth_home() + os.sep
    assert not house_root.library_root().startswith(hearth)
    assert not house_root.projections_home().startswith(hearth)
