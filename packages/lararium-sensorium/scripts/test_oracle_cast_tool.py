"""Witness — the `oracle_cast` MCP tool: the MCP skin of the `oracle-cast` verb every vessel answers.

The tool mirrors `lares oracle cast`. A cast stands as an ACT: the vessel casts, draws the coins through the platform's
entropy door (or takes the operator's six typed values), and writes the cast once as a tiddler; the draw lives in the
tool, never in the prompt, so the seat that asks never picks the figure. The seat names the time of the cast (the verb
reads no clock) and the caster. The tool's account names the throw a blind throw to collide uncertainty with: the throw stands, the reading stays open.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_oracle_cast_tool.py -q
"""
import asyncio

import pytest

import lares_uds as uds
from lares_mcp import ORACLE_VERBS, VERB_SEATS, DaemonCoordinator, SeatArgumentRefused, build_mcp, seat_of
from test_tiddler_tools import daemon  # noqa: F401 — the fixture that stands the fake daemon's socket


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _tool():
    return _mcp()._tool_manager.get_tool("oracle_cast").fn  # noqa: SLF001 — the registered skin


def test_oracle_cast_registers_and_seats_hotl(daemon):
    names = {t.name for t in asyncio.run(_mcp().list_tools())}
    assert set(ORACLE_VERBS) == {"oracle_cast"} <= names
    assert "oracle_cast" in VERB_SEATS and seat_of("oracle_cast") == "HOTL"


def test_oracle_cast_states_its_annotations_and_its_limit(daemon):
    tool = {t.name: t for t in asyncio.run(_mcp().list_tools())}["oracle_cast"]
    a = tool.annotations
    assert a is not None
    # A cast writes a new record each time: not read-only, not idempotent, never destructive.
    assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == (False, False, False, False)
    assert "a blind throw to collide uncertainty with: the throw stands, the reading stays open" in tool.description


def test_a_house_cast_rides_the_wire_with_the_container_the_caster_and_the_seats_time(daemon):
    daemon.output = {"decision": "put", "title": "t"}
    out = _tool()(recipe="default")
    assert out == {"decision": "put", "title": "t"}
    wire = daemon.wire()
    assert wire["verb"] == "oracle-cast"
    args = wire["args"]
    assert args["recipe"] == "default"
    assert args["caster"] == "agent"
    assert isinstance(args["at"], str) and args["at"].endswith("Z")
    assert "coins" not in args


def test_the_operators_coins_ride_as_six_values(daemon):
    daemon.output = {"decision": "put"}
    _tool()(recipe="default", coins=[7, 8, 9, 6, 7, 7], caster="operator")
    args = daemon.wire()["args"]
    assert args["coins"] == [7, 8, 9, 6, 7, 7]
    assert args["caster"] == "operator"


def test_coins_that_read_wrong_refuse_at_the_seat(daemon):
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default", coins=[7, 8, 9])
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default", coins=[7, 8, 9, 6, 7, 5])


def test_a_house_refusal_crosses_the_seat_in_its_own_words(daemon):
    daemon.error = {"status": "error", "error": "oracle-cast-untimed: name `at`"}
    with pytest.raises(uds.LaresVerbError):
        _tool()(recipe="default")
