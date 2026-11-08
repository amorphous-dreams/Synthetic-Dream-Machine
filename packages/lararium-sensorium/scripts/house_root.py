"""house_root — the ONE named house root and the classes beneath it, the Python tongue.

`LAR_ROOT` names the house root and nothing else stands in for it: no home directory, no XDG base. An unset or
blank root raises `HouseRootUnnamed`, whose message names the cure; the container sets `LAR_ROOT=/lar`.

This module mirrors `packages/lararium-mempalace/src/house-root.ts` and the vessel resolvers in
`packages/lararium-node/src/vessel-paths.ts` entry for entry. No module crosses the language seam, so agreement
joins the two spellings, and `packages/lararium-node/tests/house-root-weld.test.ts` holds them to it by reading
both tables and asserting them equal. Move one and move the other in the same breath.

    <root>/hearth/{vessel,identity,nexus}   the spirits' sovereign homes
    <root>/hearth/checkpoints                watermarks (projection, harvest)
    <root>/hearth/staging                    normalized copies a harvest stages
    <root>/sensoriums/<name>                 memory · mesh · memetic-wikitext (outside the hearth)
    <root>/library                           the acquired library (outside the hearth)
    <root>/projections                       deliberate plaintext renders
    <root>/config · <root>/cache · <root>/run

A re-founding clears `<root>/hearth` alone. Dependency-free (stdlib only), so every script imports it.
"""
import os


class HouseRootUnnamed(RuntimeError):
    """The refusal an unnamed house root raises. Mirrors TS `HouseRootUnnamed`, message for message."""

    def __init__(self):
        super().__init__(
            "LAR_ROOT names no house root — set LAR_ROOT to the house root (the container sets /lar); "
            "no home directory stands in for it")


def house_root() -> str:
    """The house root — `LAR_ROOT`, verbatim. Unset or blank raises `HouseRootUnnamed`: a blank root would hang
    every path under it off whatever cwd the process holds. Mirrors TS `larHouseRoot()`."""
    root = os.environ.get("LAR_ROOT")
    if root is None or not root.strip():
        raise HouseRootUnnamed()
    return root


def hearth_home() -> str:
    """`<root>/hearth` — what a re-founding clears. Mirrors TS `larHearthHome()`."""
    return os.path.join(house_root(), "hearth")


def vessel_dir() -> str:
    """`<root>/hearth/vessel` — the vessel substrate. Mirrors TS `larDataDir()`."""
    return os.path.join(hearth_home(), "vessel")


def identity_dir() -> str:
    """`<root>/hearth/identity` — the sovereign keypair. Mirrors TS `larIdentityDir()`."""
    return os.path.join(hearth_home(), "identity")


def seal_home() -> str:
    """`<root>/hearth/nexus` — the Nexus seal. Mirrors TS `larSealHome()`."""
    return os.path.join(hearth_home(), "nexus")


def sensoriums_home() -> str:
    """`<root>/sensoriums` — every standing sensorium, outside the hearth. Mirrors TS `larSensoriumsHome()`."""
    return os.path.join(house_root(), "sensoriums")


def checkpoints_home() -> str:
    """`<root>/hearth/checkpoints` — the watermarks. Mirrors TS `larCheckpointsHome()`."""
    return os.path.join(hearth_home(), "checkpoints")


def staging_home() -> str:
    """`<root>/hearth/staging` — normalized copies a harvest stages. Mirrors TS `larStagingHome()`."""
    return os.path.join(hearth_home(), "staging")


def projection_checkpoint_dir() -> str:
    """`<root>/hearth/checkpoints/projection`. Mirrors TS `larProjectionCheckpointDir()`."""
    return os.path.join(checkpoints_home(), "projection")


def harvest_checkpoint_dir() -> str:
    """`<root>/hearth/checkpoints/harvest`. Mirrors TS `larHarvestCheckpointDir()`."""
    return os.path.join(checkpoints_home(), "harvest")


def harvest_staging_dir() -> str:
    """`<root>/hearth/staging/harvest`. Mirrors TS `larHarvestStagingDir()`."""
    return os.path.join(staging_home(), "harvest")


def library_root() -> str:
    """`<root>/library` — the acquired library, outside the hearth. Mirrors TS `larLibraryRoot()`."""
    return os.path.join(house_root(), "library")


def projections_home() -> str:
    """`<root>/projections` — the deliberate plaintext renders. Mirrors TS `larProjectionsHome()`."""
    return os.path.join(house_root(), "projections")


def config_home() -> str:
    """`<root>/config` — config.json, meta.json, the repo registry. Mirrors TS `larConfigHome()`."""
    return os.path.join(house_root(), "config")


def cache_home() -> str:
    """`<root>/cache` — sweepable scratch. Mirrors TS `larCacheHome()`."""
    return os.path.join(house_root(), "cache")


def run_home() -> str:
    """`<root>/run` — transient spool, sockets and levers. Mirrors TS `larRuntimeHome()`."""
    return os.path.join(house_root(), "run")


def table() -> dict:
    """Every entry by its TS resolver name — the shape the weld test compares against the TS side."""
    return {
        "larHouseRoot": house_root(),
        "larHearthHome": hearth_home(),
        "larDataDir": vessel_dir(),
        "larIdentityDir": identity_dir(),
        "larSealHome": seal_home(),
        "larSensoriumsHome": sensoriums_home(),
        "larCheckpointsHome": checkpoints_home(),
        "larStagingHome": staging_home(),
        "larProjectionCheckpointDir": projection_checkpoint_dir(),
        "larHarvestCheckpointDir": harvest_checkpoint_dir(),
        "larHarvestStagingDir": harvest_staging_dir(),
        "larLibraryRoot": library_root(),
        "larProjectionsHome": projections_home(),
        "larConfigHome": config_home(),
        "larCacheHome": cache_home(),
        "larRuntimeHome": run_home(),
    }
