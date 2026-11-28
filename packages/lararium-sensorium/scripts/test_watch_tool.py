"""Witness — the `watch` MCP tool: the MCP skin of the daemon's `filter-watch` verb (lar:///engine.filter.watches,
comms-ux-enacts landing 16). A watch names the face that bound it, as its session door verified it, so the tool rides a SESSION of the seat's face
(`lares_uds.session_call`), never the one-shot line. One call holds and answers at the first change, or `unchanged` when its hold
runs out; the seat's wait rises above the hold for this tool alone, and the vessel's own wait rides the call as `timeoutMs`.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_watch_tool.py -q
"""
import asyncio

import pytest

import lares_uds as uds
from lares_mcp import VERB_SEATS, WATCH_HOLD_MS, WATCH_VERBS, DaemonCoordinator, SeatArgumentRefused, build_mcp, seat_of


class _Sessions:
    """A stand-in for `lares_uds.session_call`: records each call and answers one canned receipt."""

    def __init__(self) -> None:
        self.calls: "list[dict]" = []
        self.output: "dict | None" = None

    def __call__(self, verb, args=None, **kw):
        self.calls.append({"verb": verb, "args": args, **kw})
        return {"status": "done", "requestId": "r1", "results": {"summary": {"ok": True, "output": self.output}}}


@pytest.fixture
def sessions(monkeypatch):
    fake = _Sessions()
    monkeypatch.setattr(uds, "session_call", fake)

    def no_line(*_a, **_k):
        raise AssertionError("a watch never rides the one-shot line")
    monkeypatch.setattr(uds, "call", no_line)
    return fake


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _tool():
    return _mcp()._tool_manager.get_tool("watch").fn  # noqa: SLF001 — the registered skin


def test_watch_registers_and_seats_hotl(sessions):
    names = {t.name for t in asyncio.run(_mcp().list_tools())}
    assert set(WATCH_VERBS) == {"watch"} <= names
    assert "watch" in VERB_SEATS and seat_of("watch") == "HOTL"


def test_watch_states_its_annotations(sessions):
    a = {t.name: t for t in asyncio.run(_mcp().list_tools())}["watch"].annotations
    assert a is not None
    assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == (True, False, True, False)


def test_a_watch_rides_a_session_with_its_cursor_its_hold_and_the_vessels_wait(sessions):
    sessions.output = {"band": "changed", "id": "abc", "asOf": "d1"}
    out = _tool()(filter="[tag[memory]]", recipe="default", id="abc", as_of="d0", hold=4000)
    assert out == {"band": "changed", "id": "abc", "asOf": "d1"}
    call = sessions.calls[-1]
    assert call["verb"] == "filter-watch"
    assert call["args"] == {"recipe": "default", "filter": "[tag[memory]]", "id": "abc", "asOf": "d0", "hold": 4000}
    assert call["vessel_wait_ms"] > 4000 and call["timeout"] > 4.0


def test_a_bare_watch_holds_the_default(sessions):
    sessions.output = {"band": "unchanged", "id": "abc", "asOf": "d0"}
    _tool()(filter="[tag[memory]]", recipe="default")
    assert sessions.calls[-1]["args"]["hold"] == WATCH_HOLD_MS
    assert sessions.calls[-1]["vessel_wait_ms"] > WATCH_HOLD_MS


def test_unask_drops_the_watch_its_id_names(sessions):
    sessions.output = {"band": "removed", "id": "abc"}
    _tool()(recipe="default", id="abc", mu="unask")
    assert sessions.calls[-1]["verb"] == "filter-watch"
    assert sessions.calls[-1]["args"] == {"recipe": "default", "id": "abc", "unask": True}


def test_unask_with_no_id_and_a_watch_with_no_filter_refuse_before_the_wire(sessions):
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default", mu="unask")
    with pytest.raises(SeatArgumentRefused):
        _tool()(recipe="default")
    assert sessions.calls == []
