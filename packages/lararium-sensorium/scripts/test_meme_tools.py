"""Witness — a meme family through the MCP seat: `put` lands a family's carrier or one slot, `delete(family=True)` removes it,
`get` reads a meme (whole by `mu="assert"`) or lists its roots, and the seat's own act at lar:///engine.meme.projects renders
it.

Each record tool rides `lares_uds.call("call", {verb, params, surface: "mcp"})` to the @daemon, never a store; the projection
rides `act` by address, the vessel answers `handler/seat`, and the seat's act rides `meme-project`. The witness spawns a FAKE
daemon on a temp unix socket (it records every request line and answers canned receipts), so each assertion reads the EXACT
`{verb, args}` the seat put on the wire.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_meme_tools.py -q
"""
import asyncio
import json

import pytest

import lares_uds as uds
from lares_mcp import DaemonCoordinator, build_mcp
from test_tiddler_tools import call_line, daemon, seated  # noqa: F401 — the fixture that stands the fake daemon's socket

_URI = "lar:///ha.ka.ba/lares/api/pono/meme"
PROJECTS = "lar:///engine.meme.projects"
POURS = "lar:///sense.capture.pours"
RECALLS = "lar:///sense.memory.recalls"
_PUT_OUTPUT = {"recipe": "sdm", "title": _URI, "decision": "put", "bag": "lar:///ha.ka.ba/bags/sdm", "created": False,
               "changed": ["text"], "hash": "sha256-record", "textHash": "sha256-text", "position": "root",
               "canonicalHash": "sha256-put", "landed": [_URI], "kept": [], "tombstoned": [], "warnings": []}
_PROJECT_OUTPUT = {"uri": _URI, "to": "html", "text": "<p>the body</p>", "contentType": "text/html"}
_LIST_OUTPUT = {"bag": "lar:///ha.ka.ba/bags/daemon", "roots": [{"uri": _URI, "canonicalHash": "sha256-get"}]}
_DELETE_OUTPUT = {"recipe": "default", "title": _URI, "decision": "removed", "mode": "plain", "tombstoned": [], "retracted": [_URI], "canonicalHash": "sha256-get"}


def _tools():
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return {name: mcp._tool_manager.get_tool(name).fn for name in ("get", "put", "delete", "act")}  # noqa: SLF001


def _project(**kw):
    return build_mcp(DaemonCoordinator(wing="w")).seat_acts[PROJECTS](**kw)


def test_the_meme_family_rides_the_record_tools_and_the_projection_seats_by_address(daemon):
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    names = {t.name for t in asyncio.run(mcp.list_tools())}
    assert {"get", "put", "delete"} <= names
    assert names.isdisjoint({"meme_put", "meme_list", "meme_delete", "meme_get", "meme_project", "project_md"})
    assert callable(mcp.seat_acts[PROJECTS])
    # The LOCAL seats (`meme normalize` · `meme check`) hold no seat act: the seat runs the daemon-seated acts only.
    assert {getattr(fn, "__name__", "") for fn in mcp.seat_acts.values()}.isdisjoint({"meme_normalize", "meme_check"})


def test_a_family_put_rides_the_one_call_with_its_container_and_answers_the_receipt(daemon):
    daemon.output = _PUT_OUTPUT
    out = _tools()["put"](title=_URI, text="the body", recipe="default")
    assert daemon.wire() == call_line("put", {"title": _URI, "text": "the body", "recipe": "default"})
    assert daemon.lines[-1]["requestedBy"] == "0xwitness"
    assert out == _PUT_OUTPUT
    _tools()["put"](title=_URI, text="the body", bag="lares", base="sha256-get")
    assert daemon.wire() == call_line("put", {"title": _URI, "text": "the body", "bag": "lares", "base": "sha256-get"})


def test_a_family_put_the_gate_refuses_raises_its_refusal_by_name(daemon):
    # The gate refuses by a thrown refusal with its own code, never a receipt that reads as a landing.
    daemon.error = {"errorMessage": "family-gate-refused: the carrier names no title", "refusal": {"reason": "family-gate-refused"}}
    with pytest.raises(uds.LaresVerbError, match=r"family-gate-refused.*the carrier names no title"):
        _tools()["put"](title=_URI, text="the body", recipe="sdm")


def test_a_family_put_on_a_locked_vessel_names_the_unlock(daemon):
    # A LOCKED VESSEL FAILS CLOSED and the seat refuses by name: the tool error leads with `vessel-locked` and
    # names the one act that opens it.
    daemon.error = {"errorMessage": "control-home-unavailable: vessel-locked: the vessel's key stays shut",
                    "refusal": {"reason": "vessel-locked"}}
    with pytest.raises(uds.LaresVerbError, match=r"^vessel-locked: run `?lares vault unlock`?") as caught:
        _tools()["put"](title=_URI, text="the body", recipe="default")
    assert caught.value.refusal == "vessel-locked"


def test_a_meme_reads_whole_through_the_one_get(daemon):
    # ONE DOOR: the meme rides `get` with `mu="assert"`; the daemon's answer (has line, grain, next) crosses the seat
    # untouched, the floor word with it.
    answer = {"has": "<<~ has name=`lar:///ha.ka.ba/lares/api/pono/meme` params=`bag/lar:///ha.ka.ba/bags/lararium floor/true base/sha256-get`>>",
              "bag": "lar:///ha.ka.ba/bags/lararium", "floor": True, "title": _URI, "lens": "meme",
              "meme": {"uri": _URI, "text": "the body", "canonicalHash": "sha256-get", "bytes": 8, "slots": []},
              "grain": {"asked": None, "applied": "whole", "why": "fits one page"}, "next": None}
    daemon.output = answer
    assert _tools()["get"](title=_URI, bag="lararium", mu="assert") == answer
    assert daemon.wire() == call_line("get", {"title": _URI, "bag": "lararium", "mu": "assert"})
    _tools()["get"](title=_URI, recipe="default", mu="assert", after="1.0123456789abcdef")
    assert daemon.wire() == call_line("get", {"title": _URI, "recipe": "default", "mu": "assert", "after": "1.0123456789abcdef"})


def test_a_family_listing_rides_the_one_get_and_answers_as_the_vessel_spoke(daemon):
    daemon.output = _LIST_OUTPUT
    assert _tools()["get"](recipe="default", params={"meme": True, "tree": True}) == _LIST_OUTPUT
    assert daemon.wire() == call_line("get", {"recipe": "default", "meme": True, "tree": True})


def test_meme_project_wire_uri_to_and_container(daemon):
    # The projection act rides `meme-project` with {uri, to} + the container law; `recipe`/`bag` ride through as bare slugs,
    # the daemon's own wiki under its explicit name.
    daemon.output = _PROJECT_OUTPUT
    out = _project(uri=_URI, to="html", recipe="default")
    assert daemon.wire() == {"verb": "meme-project", "args": {"recipe": "default", "uri": _URI, "to": "html"}}
    assert out == _PROJECT_OUTPUT
    _project(uri=_URI, to="tid", recipe="sdm")
    assert daemon.wire() == {"verb": "meme-project", "args": {"recipe": "sdm", "uri": _URI, "to": "tid"}}
    _project(uri=_URI, to="json", bag="lares")
    assert daemon.wire() == {"verb": "meme-project", "args": {"bag": "lares", "uri": _URI, "to": "json"}}


def test_meme_project_through_act_rides_the_call_then_the_projection(daemon):
    daemon.answers = [seated(PROJECTS, {"uri": _URI, "to": "html", "recipe": "default"})]
    daemon.output = _PROJECT_OUTPUT
    assert _tools()["act"](address=PROJECTS, args={"uri": _URI, "to": "html"}) == _PROJECT_OUTPUT
    assert daemon.wire(0) == call_line(PROJECTS, {"uri": _URI, "to": "html"})
    assert daemon.wire(1) == {"verb": "meme-project", "args": {"recipe": "default", "uri": _URI, "to": "html"}}


def test_meme_project_refuses_a_target_off_the_list(daemon):
    daemon.output = _PROJECT_OUTPUT
    with pytest.raises(ValueError, match="`to`"):
        _project(uri=_URI, to="pdf", recipe="default")
    with pytest.raises(ValueError, match="no-container"):
        _project(uri=_URI, to="html", recipe="sdm", bag="lares")
    assert daemon.lines == []                                       # nothing reached the wire


def test_a_family_delete_rides_the_family_flag_on_the_one_call(daemon):
    daemon.output = _DELETE_OUTPUT
    out = _tools()["delete"](title=_URI, family=True, recipe="default")
    assert daemon.wire() == call_line("delete", {"title": _URI, "family": True, "recipe": "default"})
    assert out == _DELETE_OUTPUT
    _tools()["delete"](title=_URI, family=True, bag="lares", base="sha256-get")
    assert daemon.wire() == call_line("delete", {"title": _URI, "family": True, "bag": "lares", "base": "sha256-get"})


# ─── THE SEAT'S OWN ANSWER ───────────────────────────────────────────────────────────────────────────────
# Every test above calls a tool's python body. These cross the SERVER: an in-memory MCP client asks the real
# `tools/call` handler, and each assertion reads the `CallToolResult` a harness (and the model behind it) receives.


def _seat_call(name: str, args: dict, mcp=None):
    from mcp import Client

    server = mcp or build_mcp(DaemonCoordinator(wing="w"))

    async def ask():
        async with Client(server) as client:
            return await client.call_tool(name, args)

    return asyncio.run(ask())


def _said(result) -> str:
    return " ".join(c.text for c in result.content if getattr(c, "text", None))


def test_a_refused_write_reaches_the_caller_naming_its_reason(daemon):
    daemon.error = {"errorMessage": "put-conflict: nothing landed at the meme · the record reads hash sha256-record-live now",
                    "refusal": {"reason": "put-conflict"}}
    result = _seat_call("put", {"title": _URI, "text": "the body", "recipe": "sdm", "base": "sha256-stale"})
    assert result.is_error
    assert "put-conflict" in _said(result) and "sha256-record-live" in _said(result)
    daemon.error = {"errorMessage": "stage-path-shape: the stage meme path reads no segment", "refusal": {"reason": "stage-path-shape"}}
    result = _seat_call("put", {"title": _URI, "text": "the body", "recipe": "default"})
    assert result.is_error and "stage-path-shape" in _said(result)


def test_every_refusal_family_reaches_the_caller_by_name(daemon, monkeypatch):
    # The vessel's own refusal (`vessel-locked`), a seat act's pre-wire refusal (`no-container`), a shaping this seat never
    # routes, and an absent daemon: each answers isError AND carries its own words.
    daemon.error = {"errorMessage": "control-home-unavailable: vessel-locked: the vessel's key stays shut",
                    "refusal": {"reason": "vessel-locked"}}
    locked = _seat_call("get", {"title": _URI, "recipe": "default", "mu": "assert"})
    assert locked.is_error and "vessel-locked" in _said(locked) and "lares vault unlock" in _said(locked)
    daemon.error = None
    daemon.answers = [seated(PROJECTS, {"uri": _URI, "to": "html"})]
    bare = _seat_call("act", {"address": PROJECTS, "args": {"uri": _URI, "to": "html"}})
    assert bare.is_error and "no-container" in _said(bare)
    daemon.answers = [seated(POURS, {"surface": "claude-code", "pointer": "p", "dry-run": True})]
    unshaped = _seat_call("act", {"address": POURS, "args": {"surface": "claude-code", "pointer": "p", "dry_run": True}})
    assert unshaped.is_error and "carries no writeback/preview shaping" in _said(unshaped)
    monkeypatch.setattr(uds, "socket_path", lambda: "/nonexistent/lares.sock")
    absent = _seat_call("get", {"title": _URI, "recipe": "default", "mu": "assert"})
    assert absent.is_error and "no lares daemon" in _said(absent)


def test_a_landed_write_answers_unchanged_and_an_internal_fault_stays_unnamed(daemon):
    # CONTROL, both sides: a write that landed answers its receipt and no error; a fault the seat never named (a bug in
    # a tool body) still answers the bare line, carrying neither its own text nor a traceback.
    daemon.output = _PUT_OUTPUT
    landed = _seat_call("put", {"title": _URI, "text": "the body", "recipe": "sdm"})
    assert not landed.is_error and json.loads(_said(landed)) == _PUT_OUTPUT

    mcp = build_mcp(DaemonCoordinator(wing="w"))

    @mcp.tool()
    def faulty() -> dict:
        return {}["the-secret-key-inside"]

    crashed = _seat_call("faulty", {}, mcp)
    assert crashed.is_error and _said(crashed) == "Error executing tool faulty"
    assert "the-secret-key-inside" not in _said(crashed) and "Traceback" not in _said(crashed)


def test_a_stray_builtin_error_stays_unnamed_and_only_a_house_raised_refusal_crosses(daemon, tmp_path):
    # THE SEAT FORWARDS WHAT THE HOUSE RAISED BY NAME, never a builtin by its type. An OS permission error carries house
    # paths and a library's decode error carries its input: neither was written for a caller, so each answers the bare line.
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    sealed = tmp_path / "hearth" / "vault" / "seat.key"

    @mcp.tool()
    def os_denied() -> dict:
        raise PermissionError(13, "Permission denied", str(sealed))

    @mcp.tool()
    def lib_decode() -> dict:
        return {"n": int("the-private-row-text")}

    @mcp.tool()
    def lib_runtime() -> dict:
        raise RuntimeError(f"dictionary changed size during iteration over {sealed}")

    for name in ("os_denied", "lib_decode", "lib_runtime"):
        crashed = _seat_call(name, {}, mcp)
        assert crashed.is_error and _said(crashed) == f"Error executing tool {name}", _said(crashed)
        assert str(tmp_path) not in _said(crashed) and "the-private-row-text" not in _said(crashed)
    # CONTROL: the same three builtin families, raised by the house under its own refusal classes, still cross in their own
    # words (an argument guard, a shaping this seat never routes, an address that walks out of the shrine).
    daemon.answers = [seated(PROJECTS, {"uri": _URI, "to": "html"})]
    assert "no-container" in _said(_seat_call("act", {"address": PROJECTS, "args": {"uri": _URI, "to": "html"}}, mcp))
    daemon.answers = [seated(POURS, {"surface": "claude-code", "pointer": "p", "dry-run": True})]
    assert "carries no writeback/preview shaping" in _said(_seat_call("act", {"address": POURS, "args": {"dry_run": True}}, mcp))
    daemon.answers = [seated(RECALLS, {"query": "q", "sensorium": "../abide"})]
    walked = _seat_call("act", {"address": RECALLS, "args": {"query": "q", "sensorium": "../abide"}}, mcp)
    assert walked.is_error and "ONE path segment" in _said(walked)


def _described(name: str) -> str:
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return next(t.description for t in asyncio.run(mcp.list_tools()) if t.name == name)


def test_put_text_names_the_stage_meme_law():
    # A writer meets the law in the tool's own text, before the gate refuses: a meme under the memory stage carries
    # its stage path in the title, and the refusal the law answers stands named.
    said = _described("put")
    assert 'lar:///ha.ka.ba/kahua/memory/<class>/<slug>' in said and "stage-path-shape" in said


def test_get_text_promises_a_row_bag_for_a_named_recipe_alone():
    # The daemon's own wiki (`recipe="default"`) answers ONE `bag` over the whole listing and no row names its layer;
    # the text says so, beside the shape each container answers.
    said = _described("get")
    assert "{recipe, bags, roots, next}" in said and "{bag, roots, next}" in said
    assert 'under `recipe="default"` no row names a `bag`' in said


def test_get_text_names_the_floor_word():
    # A caller learns from the tool's own text that `floor: true` marks a read the floor snapshot answered, and where
    # the word rides: on the answer a read hands back, on a bag listing's seat, on each row of a recipe listing.
    got = _described("get")
    assert "`floor: true`" in got and "floor snapshot" in got
    assert "{bag, floor, roots, next}" in got and "each row" in got


def test_put_text_names_the_seat_canon_refusal_and_the_true_layer():
    # The seat meets its canon fence in the tool's own text (reach-mu T4-2): a `bag` naming house canon refuses
    # `seat-canon-reach`. A `recipe` lands in the wiki's writable bag (its working layer, or the face's personal layer
    # without a writer's seat), never "its top bag" (reach-mu decision 8).
    said = _described("put")
    assert "seat-canon-reach" in said
    assert "personal" in said and "`layer`" in said
