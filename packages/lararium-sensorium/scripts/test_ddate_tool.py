"""Witness — the seat's `ddate` act (lar:///oracle.calendar.dates): the seat's handler for the `ddate` verb every vessel
answers (the house's own calendar core).

A caller reaches it as `act(address="lar:///oracle.calendar.dates", args={...})`; the vessel binds the args and answers
`handler/seat`, and the seat's act rides the @daemon wire, carrying the seat's own local day as `today` on a call that names
no date (the verb reads no clock). The calendar itself lives in `@lararium/mesh/ddate`, whose golden tests hold it against
the host's `ddate`.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_ddate_tool.py -q
"""
import datetime

import pytest

import lares_uds as uds
from lares_mcp import DaemonCoordinator, build_mcp
from test_tiddler_tools import call_line, daemon, seated  # noqa: F401 — the fixture that stands the fake daemon's socket

ADDRESS = "lar:///oracle.calendar.dates"


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _act():
    return _mcp().seat_acts[ADDRESS]


def test_a_call_naming_a_date_rides_the_wire_with_the_date_and_the_seats_today(daemon):
    daemon.output = {"text": "Setting Orange, Chaos 5, 3190 YOLD"}
    today = datetime.date.today()
    out = _act()(day=5, month=1, year=2024)
    assert out == {"text": "Setting Orange, Chaos 5, 3190 YOLD"}
    wire = daemon.wire()
    assert wire["verb"] == "ddate"
    assert wire["args"] == {"day": 5, "month": 1, "year": 2024,
                            "today": {"year": today.year, "month": today.month, "day": today.day}}


def test_a_bare_call_carries_today_and_a_format_rides_as_named(daemon):
    daemon.output = {"text": "x"}
    _act()(format="%A")
    args = daemon.wire()["args"]
    assert args["format"] == "%A"
    assert set(args["today"]) == {"year", "month", "day"}
    assert "day" not in args and "year" not in args


def test_the_act_reaches_the_calendar_by_address(daemon):
    daemon.answers = [seated(ADDRESS, {"format": "%A"})]
    daemon.output = {"text": "Sweetmorn"}
    act = _mcp()._tool_manager.get_tool("act").fn  # noqa: SLF001 — the registered skin
    assert act(address=ADDRESS, args={"format": "%A"}) == {"text": "Sweetmorn"}
    assert daemon.wire(0) == call_line(ADDRESS, {"format": "%A"})
    assert daemon.wire(1)["verb"] == "ddate" and daemon.wire(1)["args"]["format"] == "%A"


def test_a_house_refusal_crosses_the_seat_in_its_own_words(daemon):
    daemon.error = {"status": "error", "error": "ddate: Invalid date -- out of range"}
    with pytest.raises(uds.LaresVerbError):
        _act()(day=32, month=1, year=2024)
