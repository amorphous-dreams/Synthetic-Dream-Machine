"""Witness — the seat's oracle cast (lar:///library.oracle.speaks): the seat's handler for the `oracle-cast` verb every
vessel answers.

A caller reaches it as `act(address="lar:///library.oracle.speaks", args={...})`, the CLI as `lares oracle cast`. A cast
stands as an ACT: the vessel casts, draws the coins through the platform's entropy door (or takes the operator's six typed
values), and writes the cast once as a tiddler; the draw lives in the vessel, never in the prompt, so the seat that asks
never picks the figure. The seat names the time of the cast (the verb reads no clock) and the caster. The carrier's words
name the throw a blind throw to collide uncertainty with: the throw stands, the reading stays open.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_oracle_cast_tool.py -q
"""
import pytest

import lares_uds as uds
from lares_mcp import DaemonCoordinator, SeatArgumentRefused, build_mcp, carrier_words
from test_tiddler_tools import call_line, daemon, seated  # noqa: F401 — the fixture that stands the fake daemon's socket

ADDRESS = "lar:///library.oracle.speaks"


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _act():
    return _mcp().seat_acts[ADDRESS]


def test_the_carrier_names_the_throw_and_its_limit():
    said = "\n".join(carrier_words(ADDRESS))
    assert said, f"affordance-pack-stale: the pack holds no mcp words for {ADDRESS}; re-bake: pnpm --filter @lararium/tw5 build"
    assert "a blind throw to collide uncertainty with: the throw stands, the reading stays open" in said
    assert "collapse" not in said and "unfold" not in said


def test_a_house_cast_rides_the_wire_with_the_container_the_caster_and_the_seats_time(daemon):
    daemon.output = {"decision": "put", "title": "t"}
    out = _act()(recipe="default")
    assert out == {"decision": "put", "title": "t"}
    wire = daemon.wire()
    assert wire["verb"] == "oracle-cast"
    args = wire["args"]
    assert args["recipe"] == "default"
    assert args["caster"] == "agent"
    assert isinstance(args["at"], str) and args["at"].endswith("Z")
    assert "coins" not in args


def test_a_cast_through_act_rides_the_call_then_the_cast(daemon):
    daemon.answers = [seated(ADDRESS, {"recipe": "default", "asking": "which road first?"})]
    daemon.output = {"band": "answered"}
    act = _mcp()._tool_manager.get_tool("act").fn  # noqa: SLF001 — the registered skin
    assert act(address=ADDRESS, args={"asking": "which road first?"}) == {"band": "answered"}
    assert daemon.wire(0) == call_line(ADDRESS, {"asking": "which road first?"})
    cast = daemon.wire(1)
    assert cast["verb"] == "oracle-cast" and cast["args"]["recipe"] == "default" and cast["args"]["asking"] == "which road first?"


def test_the_asking_rides_as_its_words_so_a_retry_answers_the_standing_throw(daemon):
    daemon.output = {"band": "answered", "replayed": True}
    out = _act()(recipe="default", asking="which road first?")
    assert out["band"] == "answered"
    args = daemon.wire()["args"]
    assert args["asking"] == "which road first?"
    assert "fresh" not in args and "seed" not in args and "nonce" not in args


def test_a_blank_asking_rides_as_none(daemon):
    daemon.output = {"band": "answered"}
    _act()(recipe="default", asking="   ")
    assert "asking" not in daemon.wire()["args"]


def test_the_operators_coins_ride_as_six_values(daemon):
    daemon.output = {"decision": "put"}
    _act()(recipe="default", coins=[7, 8, 9, 6, 7, 7], caster="operator")
    args = daemon.wire()["args"]
    assert args["coins"] == [7, 8, 9, 6, 7, 7]
    assert args["caster"] == "operator"


def test_coins_that_read_wrong_refuse_at_the_seat(daemon):
    with pytest.raises(SeatArgumentRefused):
        _act()(recipe="default", coins=[7, 8, 9])
    with pytest.raises(SeatArgumentRefused):
        _act()(recipe="default", coins=[7, 8, 9, 6, 7, 5])


def test_a_house_refusal_crosses_the_seat_in_its_own_words(daemon):
    daemon.error = {"status": "error", "error": "oracle-cast-untimed: name `at`"}
    with pytest.raises(uds.LaresVerbError):
        _act()(recipe="default")


def test_the_uncertainty_and_the_pointers_ride_the_wire_to_fill_the_first_slots(daemon):
    # The cast lands as an OODA-HA meme: `observe` fills #/observe and `uncertain` fills #/orient beside the asking.
    daemon.output = {"band": "answered", "slots": []}
    _act()(recipe="default", asking="which lane first?", uncertain="two leans, neither grounded",
           observe="lar:///ha.ka.ba/kahua/memory/plan/x  spirit/lane")
    args = daemon.wire()["args"]
    assert args["uncertain"] == "two leans, neither grounded"
    assert args["observe"] == ["lar:///ha.ka.ba/kahua/memory/plan/x", "spirit/lane"]
    _act()(recipe="default", asking="which lane first?", observe=["a", " ", "b"])
    assert daemon.wire()["args"]["observe"] == ["a", "b"]


def test_pointers_that_read_wrong_refuse_at_the_seat_and_blank_words_ride_as_none(daemon):
    with pytest.raises(SeatArgumentRefused):
        _act()(recipe="default", asking="q", observe=[1, 2])
    daemon.output = {"band": "answered"}
    _act()(recipe="default", asking="q", uncertain="  ", observe=[])
    args = daemon.wire()["args"]
    assert "uncertain" not in args and "observe" not in args


def test_one_act_takes_the_uncertainty_and_no_unfold_axis():
    # ONE act: the cast takes the uncertainty itself; no unfold axis rides it.
    import inspect
    takes = set(inspect.signature(_act()).parameters)
    assert {"uncertain", "observe"} <= takes
    assert "unfold" not in takes
