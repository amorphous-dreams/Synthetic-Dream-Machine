"""Witness — the MCP skin of the affordance carriers: the seat's tools and its instruction text take their words from the
baked pack, and every arg a carrier binds for the seat reaches its seat act (W2's MCP twin: a bound arg the handler takes no
word for would drop at the seat unheard).

The pack: `packages/lararium-tw5/affordance-pack.json`, baked by `packages/lararium-tw5/scripts/build-affordance-pack.ts`
(lar:///ha.ka.ba/lares/api/pono/affordance).

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_affordance_skin.py -q
"""
import asyncio
import inspect
import json

import pytest

import lares_mcp
from lares_mcp import DaemonCoordinator, build_mcp, read_affordance_pack

ORACLE = "lar:///library.oracle.speaks"
READS = "lar:///engine.record.reads"

FIXTURE_PACK = {
    "carriers": {
        ORACLE: {
            "role": "Cast the I Ching by three coins",
            "renders": {"mcp": {"whole": ["Cast the I Ching by three coins; the cast lands as a tiddler.", "the throw stands"]}},
            "params": {"asking": "the question, named before the throw", "recipe": "the wiki that takes the cast"},
        },
        READS: {
            "role": "Read one record",
            "renders": {"mcp": {"whole": ["Read one record by title.", "mu=\"assert\" reads a meme whole"]}},
            "params": {},
        },
        "lar:///carriage.record.adds": {"role": "Add a host file as a record", "renders": {}, "params": {}},
    },
    "routes": {"mcp": {f"act {ORACLE}": ORACLE}},
}


def test_the_tools_and_the_instructions_render_from_the_pack(monkeypatch, tmp_path):
    # RED on 421e4a4df^: the seat dressed its hand-written tools from `routes.mcp` by tool name, and no `get` or `act` stood.
    # GREEN on 421e4a4df: `get` speaks its carriers' mcp wholes, `act` every carrier by address and role, and the
    # instructions add each carrier the pack routes to this seat.
    pack = tmp_path / "affordance-pack.json"
    pack.write_text(json.dumps(FIXTURE_PACK), encoding="utf-8")
    monkeypatch.setattr(lares_mcp, "AFFORDANCE_PACK_PATH", str(pack))
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    listed = {t.name: t for t in asyncio.run(mcp.list_tools())}
    assert listed["get"].description == "Read one record by title.\nmu=\"assert\" reads a meme whole"
    act = listed["act"].description.splitlines()
    assert act[0].startswith("Run any affordance by its lar: address")
    assert act[1:] == ["lar:///carriage.record.adds ~ Add a host file as a record", f"{READS} ~ Read one record",
                       f"{ORACLE} ~ Cast the I Ching by three coins"]
    assert mcp.instructions.endswith(f" The affordances: {ORACLE} ~ Cast the I Ching by three coins.")
    assert READS not in mcp.instructions
    # CONTROL: a tool whose carrier the pack holds no words for keeps its own (here, none).
    assert lares_mcp.carrier_words("lar:///engine.record.puts", FIXTURE_PACK) == []


def test_w2_every_arg_a_carrier_binds_for_the_seat_reaches_its_seat_act():
    pack = read_affordance_pack()
    assert ORACLE in (pack.get("carriers") or {}), \
        f"affordance-pack-stale: the pack holds no {ORACLE}; re-bake: pnpm --filter @lararium/tw5 build"
    acts = build_mcp(DaemonCoordinator(wing="w")).seat_acts
    checked = 0
    for address, carrier in sorted((pack.get("carriers") or {}).items()):
        if address not in acts:
            continue
        bound = {name.replace("-", "_") for name in (carrier.get("params") or {})}
        takes = set(inspect.signature(acts[address]).parameters)
        assert bound <= takes, f"{address}: the carrier binds {sorted(bound - takes)}, which its seat act takes no word for"
        checked += 1
    assert checked > 0
    # CONTROL: a carrier naming one arg its handler lacks disagrees.
    assert not ({"zz_no_such_arg"} <= set(inspect.signature(acts[ORACLE]).parameters))


@pytest.mark.parametrize("missing", ["/nonexistent/affordance-pack.json"])
def test_a_missing_pack_reads_empty_never_throws(missing):
    assert read_affordance_pack(missing) == {"carriers": {}, "routes": {}}
