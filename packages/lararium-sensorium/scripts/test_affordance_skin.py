"""Witness — the MCP skin of an affordance carrier: a pack-routed tool takes its words from the baked pack, its signature
names exactly the args its carrier's mcp skin takes (W2's MCP twin), and no seat path admits on a pack field (W8).

The pack: `packages/lararium-tw5/affordance-pack.json`, baked by `packages/lararium-tw5/scripts/build-affordance-pack.ts`
(lar:///ha.ka.ba/lares/api/pono/affordance). RED-FIRST: written by smith#1, run by the familiar.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_affordance_skin.py -q
"""
import inspect
import os
import re

import pytest

from lares_mcp import DaemonCoordinator, _dress_from_pack, build_mcp, pack_tool_skin, read_affordance_pack

ADDRESS = "lar:///oracle.library.consults"

FIXTURE_PACK = {
    "carriers": {ADDRESS: {
        "renders": {"mcp": {"whole": ["Cast the I Ching by three coins; the cast lands as a tiddler.", "the throw stands"]}},
        "params": {"asking": "the question, named before the throw", "recipe": "the wiki that takes the cast"},
    }},
    "routes": {"mcp": {"oracle_cast": ADDRESS}},
}


def _signature_params(mcp, tool):
    fn = mcp._tool_manager.get_tool(tool).fn  # noqa: SLF001 — the registered skin
    return sorted(inspect.signature(fn).parameters)


def test_a_pack_routed_tool_takes_its_words_from_the_pack():
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    _dress_from_pack(mcp, FIXTURE_PACK)
    held = mcp._tool_manager.get_tool("oracle_cast")  # noqa: SLF001
    assert held.description == "Cast the I Ching by three coins; the cast lands as a tiddler.\nthe throw stands"
    assert held.parameters["properties"]["asking"]["description"] == "the question, named before the throw"
    # CONTROL: a tool the pack routes nothing to keeps its own words.
    assert mcp._tool_manager.get_tool("tiddler_get").description  # noqa: SLF001
    assert pack_tool_skin("tiddler_get", FIXTURE_PACK) is None


def test_w2_every_pack_routed_tool_names_exactly_its_carriers_mcp_args():
    pack = read_affordance_pack()
    routed = sorted((pack.get("routes") or {}).get("mcp") or {})
    # SEED: the oracle cast flipped first; a pack that routes no `oracle_cast` reads red until the familiar re-bakes.
    for seed in ("oracle_cast", "ddate", "law_index", "law_pin", "law_unpin", "shore", "shore_flush", "flow"):
        assert seed in routed, f"affordance-pack-stale: the pack routes no {seed}; re-bake: pnpm --filter @lararium/tw5 build"
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    for tool in routed:
        _, params = pack_tool_skin(tool, pack)
        assert _signature_params(mcp, tool) == sorted(params), tool
    # CONTROL: a carrier naming one arg the signature lacks disagrees.
    assert _signature_params(mcp, "oracle_cast") != sorted({**pack_tool_skin("oracle_cast", pack)[1], "zz_no_such_arg": "x"})


def test_w8_no_seat_path_reads_the_pack_but_the_dresser():
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "lares_mcp.py"), encoding="utf-8").read()
    calls = [m.start() for m in re.finditer(r"\b(read_affordance_pack|pack_tool_skin)\(", src)]
    dresser = src.index("def _dress_from_pack(")
    region = (src.index("def read_affordance_pack("), src.index("\ndef ", dresser + 1))
    outside = [at for at in calls if not (region[0] <= at < region[1])]
    assert outside == [], "an admission path reads the affordance pack: a carrier describes, the door checks the ocap"
    # CONTROL: the scan sees the dresser's own read.
    assert any(dresser <= at < region[1] for at in calls)


@pytest.mark.parametrize("missing", ["/nonexistent/affordance-pack.json"])
def test_a_missing_pack_reads_empty_never_throws(missing):
    assert read_affordance_pack(missing) == {"carriers": {}, "routes": {}}
