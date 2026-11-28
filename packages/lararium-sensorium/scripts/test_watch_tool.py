"""Witness — the `watch` MCP tool: the MCP skin of the daemon's `filter-watch` verb (lar:///engine.filter.watches,
comms-ux-enacts landing 16). One call holds and answers at the first change, or `unchanged` when its hold runs out; the seat's
wait rises above the hold for this tool alone, and the vessel's own wait rides the line as `timeoutMs`.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_watch_tool.py -q
"""
import asyncio

import pytest

from lares_mcp import VERB_SEATS, WATCH_HOLD_MS, WATCH_VERBS, DaemonCoordinator, SeatArgumentRefused, build_mcp, seat_of
from test_tiddler_tools import daemon  # noqa: F401 — the fixture that stands the fake daemon's socket


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _tool():
    return _mcp()._tool_manager.get_tool("watch").fn  # noqa: SLF001 — the registered skin


def test_watch_registers_and_seats_hotl(daemon):
    names = {t.name for t in asyncio.run(_mcp().list_tools())}
    assert set(WATCH_VERBS) == {"watch"} <= names
    assert "watch" in VERB_SEATS and seat_of("watch") == "HOTL"


def test_watch_states_its_annotations(daemon):
    a = {t.name: t for t in asyncio.run(_mcp().list_tools())}["watch"].annotations
    assert a is not None
    assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == (True, False, True, False)


def test_a_watch_rides_the_wire_with_its_cursor_its_hold_and_the_vessels_wait(daemon):
    daemon.output = {"band": "changed", "id": "abc", "asOf": "d1"}
    out = _tool()(filter="[tag[memory]]", recipe="default", id="abc", as_of="d0", hold=4000)
    assert out == {"band": "changed", "id": "abc", "asOf": "d1"}
    assert daemon.wire() == {"verb": "filter-watch",
                             "args": {"recipe": "default", "filter": "[tag[memory]]", "id": "abc", "asOf": "d0", "hold": 4000}}
    assert daemon.lines[-1]["timeoutMs"] > 4000


def test_a_bare_watch_holds_the_default(daemon):
    daemon.output = {"band": "unchanged", "id": "abc", "asOf": "d0"}
    _tool()(filter="[tag[memory]]", recipe="default")
    assert daemon.wire()["args"]["hold"] == WATCH_HOLD_MS
    assert daemon.lines[-1]["timeoutMs"] > WATCH_HOLD_MS


def test_unask_drops_the_watch_its_id_names(daemon):
    daemon.output = {"band": "removed", "id": "abc"}
    _tool()(recipe="default", id="abc", mu="unask")
    assert daemon.wire() == {"verb": "filter-watch", "args": {"recipe": "default", "id": "abc", "unask": True}}


def test_unask_with_no_id_and_a_watch_with_no_filter_refuse_before_the_wire(daemon):
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default", mu="unask")
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default")
    assert daemon.lines == []
