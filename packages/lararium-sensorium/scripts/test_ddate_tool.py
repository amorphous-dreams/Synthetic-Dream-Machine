"""Witness — the `ddate` MCP tool: the MCP skin of the `ddate` verb every vessel answers (the house's own calendar core).

The tool mirrors `lares ddate [+FORMAT] [day month year]`. It rides the @daemon wire like every routed read, seats HOTL,
states its annotations, and carries the seat's own local day as `today` on a call that names no date (the verb reads no
clock). The calendar itself lives in `@lararium/mesh/ddate`, whose golden tests hold it against the host's `ddate`.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_ddate_tool.py -q
"""
import asyncio
import datetime

import pytest

import lares_uds as uds
from lares_mcp import DDATE_VERBS, VERB_SEATS, DaemonCoordinator, build_mcp, seat_of
from test_tiddler_tools import daemon  # noqa: F401 — the fixture that stands the fake daemon's socket


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _tool():
    return _mcp()._tool_manager.get_tool("ddate").fn  # noqa: SLF001 — the registered skin


def test_ddate_registers_and_seats_hotl(daemon):
    names = {t.name for t in asyncio.run(_mcp().list_tools())}
    assert set(DDATE_VERBS) == {"ddate"} <= names
    assert "ddate" in VERB_SEATS and seat_of("ddate") == "HOTL"


def test_ddate_states_its_annotations(daemon):
    tool = {t.name: t for t in asyncio.run(_mcp().list_tools())}["ddate"]
    a = tool.annotations
    assert a is not None
    assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == (True, False, True, False)


def test_a_call_naming_a_date_rides_the_wire_with_the_date_and_the_seats_today(daemon):
    daemon.output = {"text": "Setting Orange, Chaos 5, 3190 YOLD"}
    today = datetime.date.today()
    out = _tool()(day=5, month=1, year=2024)
    assert out == {"text": "Setting Orange, Chaos 5, 3190 YOLD"}
    wire = daemon.wire()
    assert wire["verb"] == "ddate"
    assert wire["args"] == {"day": 5, "month": 1, "year": 2024,
                            "today": {"year": today.year, "month": today.month, "day": today.day}}


def test_a_bare_call_carries_today_and_a_format_rides_as_named(daemon):
    daemon.output = {"text": "x"}
    _tool()(format="%A")
    args = daemon.wire()["args"]
    assert args["format"] == "%A"
    assert set(args["today"]) == {"year", "month", "day"}
    assert "day" not in args and "year" not in args


def test_a_house_refusal_crosses_the_seat_in_its_own_words(daemon):
    daemon.error = {"status": "error", "error": "ddate: Invalid date -- out of range"}
    with pytest.raises(uds.LaresVerbError):
        _tool()(day=32, month=1, year=2024)
