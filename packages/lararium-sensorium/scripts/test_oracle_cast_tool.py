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


def test_the_asking_rides_as_its_words_so_a_retry_answers_the_standing_throw(daemon):
    daemon.output = {"band": "answered", "replayed": True}
    out = _tool()(recipe="default", asking="which road first?")
    assert out["band"] == "answered"
    args = daemon.wire()["args"]
    assert args["asking"] == "which road first?"
    assert "fresh" not in args and "seed" not in args and "nonce" not in args


def test_a_blank_asking_rides_as_none(daemon):
    daemon.output = {"band": "answered"}
    _tool()(recipe="default", asking="   ")
    assert "asking" not in daemon.wire()["args"]


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


def test_the_uncertainty_and_the_pointers_ride_the_wire_to_fill_the_first_slots(daemon):
    # The cast lands as an OODA-HA meme: `observe` fills #/observe and `uncertain` fills #/orient beside the asking.
    daemon.output = {"band": "answered", "slots": []}
    _tool()(recipe="default", asking="which lane first?", uncertain="two leans, neither grounded",
            observe="lar:///ha.ka.ba/kahua/memory/plan/x  spirit/lane")
    args = daemon.wire()["args"]
    assert args["uncertain"] == "two leans, neither grounded"
    assert args["observe"] == ["lar:///ha.ka.ba/kahua/memory/plan/x", "spirit/lane"]
    _tool()(recipe="default", asking="which lane first?", observe=["a", " ", "b"])
    assert daemon.wire()["args"]["observe"] == ["a", "b"]


def test_pointers_that_read_wrong_refuse_at_the_seat_and_blank_words_ride_as_none(daemon):
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default", asking="q", observe=[1, 2])
    daemon.output = {"band": "answered"}
    _tool()(recipe="default", asking="q", uncertain="  ", observe=[])
    args = daemon.wire()["args"]
    assert "uncertain" not in args and "observe" not in args


def test_one_door_no_unfold_and_no_collapse(daemon):
    # ONE door: the cast takes the uncertainty itself; no unfold axis and no second skin ride this tool.
    tool = {t.name: t for t in asyncio.run(_mcp().list_tools())}["oracle_cast"]
    props = set((tool.input_schema or {}).get("properties", {}))
    assert {"uncertain", "observe"} <= props
    assert "unfold" not in props
    assert "collapse" not in tool.description and "unfold" not in tool.description
