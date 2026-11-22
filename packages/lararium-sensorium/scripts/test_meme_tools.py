"""Witness — the `meme_put` / `meme_list` / `meme_delete` / `meme_project` MCP tools (a meme reads through `tiddler_get(meme=True)`): the MCP
skin of the meme family's DAEMON-seated verbs.

Each tool rides `lares_uds.call("meme-put" | "meme-get" | "meme-list" | "meme-delete" | "meme-project",
args)` to the @daemon, never a
store. The witness spawns a FAKE daemon on a temp unix socket (it records every request line and answers a
canned receipt), so each assertion reads the EXACT `{verb, args}` the tool put on the wire — the contract
the daemon side builds to: at most one of `recipe`/`bag`; neither → the daemon reads `recipe: "default"`
(the host's ANCHOR); `base` carries the canonical hash the writer read (absent → adopt); `to` names the
projection target the island renders.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_meme_tools.py -q
"""
import asyncio
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import MEME_VERBS, VERB_SEATS, DaemonCoordinator, build_mcp, seat_of

_URI = "lar:///ha.ka.ba/lares/api/pono/meme"
_PUT_OUTPUT = {"uri": _URI, "decision": "ingest", "grade": "ok", "landed": [_URI], "tombstoned": [],
               "canonicalHash": "sha256-put", "warnings": [], "diagnostics": []}
_PROJECT_OUTPUT = {"uri": _URI, "to": "html", "text": "<p>the body</p>", "contentType": "text/html"}
_LIST_OUTPUT = {"bag": "lar:///ha.ka.ba/bags/daemon", "roots": [{"uri": _URI, "canonicalHash": "sha256-get"}]}
_DELETE_OUTPUT = {"uri": _URI, "decision": "removed", "tombstoned": [_URI], "canonicalHash": "sha256-get"}


class _FakeDaemon:
    """A unix-socket listener that records each NDJSON request line and answers ONE canned receipt
    (`{status, results: {summary: {ok, output}}}` — the shape `lares_uds.output` peels)."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: "list[dict]" = []
        self.output = None
        # A refusal the seat itself answers (`{status: "error", errorMessage, refusal: {reason}}`), in place of a receipt.
        self.error: "dict | None" = None
        self._srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._srv.bind(path)
        self._srv.listen(4)
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self) -> None:
        while True:
            try:
                conn, _ = self._srv.accept()
            except OSError:
                return
            with conn:
                buf = b""
                while b"\n" not in buf:
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    buf += chunk
                self.lines.append(json.loads(buf.split(b"\n", 1)[0].decode()))
                receipt = ({"status": "error", "requestId": "r1", **self.error} if self.error is not None else
                           {"status": "ok", "requestId": "r1",
                            "results": {"summary": {"ok": True, "output": self.output}}})
                conn.sendall((json.dumps(receipt) + "\n").encode())

    def close(self) -> None:
        self._srv.close()

    def wire(self, i: int = -1) -> dict:
        """The `{verb, args}` pair the tool put on the wire (requestedBy stripped — the did rides beside)."""
        line = self.lines[i]
        return {"verb": line["verb"], "args": line["args"]}


@pytest.fixture
def daemon(monkeypatch, tmp_path_factory):
    # The socket sits in pytest's own per-run tmp, which every host can write. A short `mktemp` name keeps
    # the path under the AF_UNIX limit (108 bytes) where a per-test `tmp_path` named after the test may not.
    d = tmp_path_factory.mktemp("uds")
    fake = _FakeDaemon(os.path.join(d, "daemon.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    monkeypatch.setattr(uds, "operator_did", lambda: "0xwitness")
    try:
        yield fake
    finally:
        fake.close()


def _tools():
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return {name: mcp._tool_manager.get_tool(name).fn for name in MEME_VERBS}  # noqa: SLF001 — the registered skins


def _put(**kw):
    return _tools()["meme_put"](**kw)


def _get(**kw):
    # A meme READS through the one door: the tiddler tool's meme lens.
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return mcp._tool_manager.get_tool("tiddler_get").fn(**kw)  # noqa: SLF001 — the registered skin


def _project(**kw):
    return _tools()["meme_project"](**kw)


def _list(**kw):
    return _tools()["meme_list"](**kw)


def _delete(**kw):
    return _tools()["meme_delete"](**kw)


def test_meme_tools_register_and_seat_hotl(daemon):
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    names = {t.name for t in asyncio.run(mcp.list_tools())}
    assert set(MEME_VERBS) == {"meme_put", "meme_list", "meme_delete", "meme_project"} <= names
    # ONE DOOR READS: `meme_get` retired into `tiddler_get(meme=True)`; no tool answers by its name.
    assert "meme_get" not in names
    for v in MEME_VERBS:
        assert v in VERB_SEATS and seat_of(v) == "HOTL"
    # The LOCAL seats (`meme normalize` · `meme check`) hold no MCP tool: the MCP mirrors the CLI's
    # daemon-seated verbs only. The retired `project_md` spelling answers nowhere.
    assert names.isdisjoint({"meme_normalize", "meme_check", "project_md"})


def test_every_meme_tool_refuses_a_missing_container_before_the_wire(daemon):
    # A content verb names its container: neither `recipe` nor `bag` refuses as `no-container`, the code
    # the CLI and the daemon door answer, and nothing reaches the wire. No default wiki exists.
    daemon.output = _PUT_OUTPUT
    for call in (lambda: _put(uri=_URI, text="the body"), lambda: _get(title=_URI, meme=True), lambda: _list(),
                 lambda: _delete(uri=_URI), lambda: _project(uri=_URI, to="html")):
        with pytest.raises(ValueError, match="no-container"):
            call()
    assert daemon.lines == []


def test_meme_put_names_the_daemon_wiki_by_its_explicit_name(daemon):
    # CONTROL: the daemon's own wiki answers to `recipe="default"`, spelled by the caller and sent as spelled.
    daemon.output = _PUT_OUTPUT
    out = _put(uri=_URI, text="the body", recipe="default")
    assert daemon.wire() == {"verb": "meme-put", "args": {"recipe": "default", "uri": _URI, "text": "the body"}}
    assert daemon.lines[-1]["requestedBy"] == "0xwitness"
    assert out == _PUT_OUTPUT


def test_meme_put_named_recipe(daemon):
    daemon.output = _PUT_OUTPUT
    _put(uri=_URI, text="the body", recipe="sdm")
    assert daemon.wire() == {"verb": "meme-put", "args": {"recipe": "sdm", "uri": _URI, "text": "the body"}}


def test_meme_put_bag(daemon):
    daemon.output = _PUT_OUTPUT
    _put(uri=_URI, text="the body", bag="lares")
    assert daemon.wire() == {"verb": "meme-put", "args": {"bag": "lares", "uri": _URI, "text": "the body"}}


def test_meme_put_carries_the_base(daemon):
    # `base` = the canonical hash the writer read back from tiddler_get(meme=True) — the merge base the gate reads.
    daemon.output = _PUT_OUTPUT
    out = _put(uri=_URI, text="the body", recipe="sdm", base="sha256-get")
    assert daemon.wire() == {"verb": "meme-put",
                             "args": {"recipe": "sdm", "uri": _URI, "text": "the body", "base": "sha256-get"}}
    assert out["decision"] == "ingest"


def test_meme_put_conflict_raises_a_tool_error_naming_the_live_hash(daemon):
    # A WRITE THAT NEVER LANDED NEVER READS AS SUCCESS: a stale base answers `decision: conflict` inside the
    # receipt, and the tool raises (the MCP skin answers isError), naming the decision, its reason and the live
    # hash the writer re-reads against. An AI that skips `decision` still hears the refusal.
    daemon.output = dict(_PUT_OUTPUT, decision="conflict", reason="both-moved", landed=[], canonicalHash="sha256-live")
    with pytest.raises(uds.LaresVerbError, match=r"meme-put conflict.*both-moved.*sha256-live"):
        _put(uri=_URI, text="the body", recipe="sdm", base="sha256-stale")


def test_meme_put_refuse_raises_a_tool_error_naming_the_warnings(daemon):
    daemon.output = dict(_PUT_OUTPUT, decision="refuse", landed=[], warnings=["the carrier names no title"])
    with pytest.raises(uds.LaresVerbError, match=r"meme-put refuse.*the carrier names no title"):
        _put(uri=_URI, text="the body", recipe="sdm")


def test_meme_put_noop_answers_success(daemon):
    # CONTROL: a noop moved nothing because the records already say it; that write stands, so it answers.
    daemon.output = dict(_PUT_OUTPUT, decision="noop", reason="canonical-equivalent", landed=[])
    assert _put(uri=_URI, text="the body", recipe="sdm")["decision"] == "noop"


def test_meme_put_on_a_locked_vessel_names_the_unlock(daemon):
    # A LOCKED VESSEL FAILS CLOSED and the seat refuses by name: the tool error leads with `vessel-locked` and
    # names the one act that opens it.
    daemon.error = {"errorMessage": "control-home-unavailable: vessel-locked: the vessel's key stays shut",
                    "refusal": {"reason": "vessel-locked"}}
    with pytest.raises(uds.LaresVerbError, match=r"^vessel-locked: run `?lares vault unlock`?") as caught:
        _put(uri=_URI, text="the body", recipe="default")
    assert caught.value.refusal == "vessel-locked"


def test_meme_put_refuses_recipe_and_bag_together(daemon):
    daemon.output = _PUT_OUTPUT
    with pytest.raises(ValueError, match="no-container"):
        _put(uri=_URI, text="x", recipe="sdm", bag="lares")
    assert daemon.lines == []                                       # nothing reached the wire


def test_meme_tools_carry_a_slug_as_written(daemon):
    # The seat reshapes no slug: whatever names the container rides to the daemon byte for byte, and the
    # daemon's own door answers for it. An empty slug names nothing and refuses before the wire.
    daemon.output = _PUT_OUTPUT
    _put(uri=_URI, text="x", recipe="sdm")
    assert daemon.wire()["args"]["recipe"] == "sdm"
    with pytest.raises(ValueError, match="names no slug"):
        _get(title=_URI, bag="", meme=True)
    assert len(daemon.lines) == 1


def test_a_meme_reads_through_the_tiddler_door_lens(daemon):
    # ONE DOOR: the meme lens rides `tiddler-get` with `meme: true`; the daemon's answer (has line, grain, next) crosses
    # the seat untouched, the floor word with it.
    answer = {"has": "<<~ has name=`lar:///ha.ka.ba/lares/api/pono/meme` params=`bag/lar:///ha.ka.ba/bags/lararium floor/true base/sha256-get`>>",
              "bag": "lar:///ha.ka.ba/bags/lararium", "floor": True, "title": _URI, "lens": "meme",
              "meme": {"uri": _URI, "text": "the body", "canonicalHash": "sha256-get", "bytes": 8, "slots": []},
              "grain": {"asked": None, "applied": "whole", "why": "fits one page"}, "next": None}
    daemon.output = answer
    assert _get(title=_URI, bag="lararium", meme=True) == answer
    assert daemon.wire() == {"verb": "tiddler-get", "args": {"bag": "lararium", "title": _URI, "meme": True}}
    _get(title=_URI, recipe="default", meme=True, grain="whole", after="1.0123456789abcdef")
    assert daemon.wire() == {"verb": "tiddler-get", "args": {"recipe": "default", "title": _URI, "meme": True, "grain": "whole", "after": "1.0123456789abcdef"}}
    with pytest.raises(ValueError, match="no-container"):
        _get(title=_URI, recipe="sdm", bag="lares", meme=True)


def test_meme_list_carries_the_floor_word_on_the_seat_and_on_each_row(daemon):
    # A bag the floor answered names it on the seat; a recipe's stack names it on each row a floor bag answered.
    by_bag = {"bag": "lar:///ha.ka.ba/bags/lararium", "floor": True, "roots": [{"uri": _URI, "canonicalHash": "sha256-get"}], "next": None}
    daemon.output = by_bag
    assert _list(bag="lararium") == by_bag
    by_recipe = {"recipe": "lares", "bags": ["lar:///ha.ka.ba/bags/lares"], "next": None,
                 "roots": [{"uri": _URI, "canonicalHash": "sha256-get", "bag": "lar:///ha.ka.ba/bags/lares", "floor": True}]}
    daemon.output = by_recipe
    assert _list(recipe="lares") == by_recipe


def test_meme_project_wire_uri_to_and_container(daemon):
    # `meme_project` rides `meme-project` with {uri, to} + the container law; `recipe`/`bag` ride
    # through as bare slugs, the daemon's own wiki under its explicit name.
    daemon.output = _PROJECT_OUTPUT
    out = _project(uri=_URI, to="html", recipe="default")
    assert daemon.wire() == {"verb": "meme-project", "args": {"recipe": "default", "uri": _URI, "to": "html"}}
    assert out == _PROJECT_OUTPUT
    _project(uri=_URI, to="tid", recipe="sdm")
    assert daemon.wire() == {"verb": "meme-project", "args": {"recipe": "sdm", "uri": _URI, "to": "tid"}}
    _project(uri=_URI, to="json", bag="lares")
    assert daemon.wire() == {"verb": "meme-project", "args": {"bag": "lares", "uri": _URI, "to": "json"}}


def test_meme_project_refuses_a_target_off_the_list(daemon):
    daemon.output = _PROJECT_OUTPUT
    with pytest.raises(ValueError, match="`to`"):
        _project(uri=_URI, to="pdf", recipe="default")
    with pytest.raises(ValueError, match="no-container"):
        _project(uri=_URI, to="html", recipe="sdm", bag="lares")
    assert daemon.lines == []                                       # nothing reached the wire


def test_meme_list_wire_container_and_tree(daemon):
    # `meme_list` addresses the SEAT, never one meme: the container alone rides; `tree` rides only when asked.
    daemon.output = _LIST_OUTPUT
    out = _list(recipe="default")
    assert daemon.wire() == {"verb": "meme-list", "args": {"recipe": "default"}}
    assert out == _LIST_OUTPUT
    _list(recipe="sdm", tree=True)
    assert daemon.wire() == {"verb": "meme-list", "args": {"recipe": "sdm", "tree": True}}
    _list(bag="lares")
    assert daemon.wire() == {"verb": "meme-list", "args": {"bag": "lares"}}
    # THE CURSOR rides back as `after`, and only when a caller holds one.
    _list(bag="lares", after="lar:///t/x")
    assert daemon.wire() == {"verb": "meme-list", "args": {"bag": "lares", "after": "lar:///t/x"}}
    with pytest.raises(ValueError, match="no-container"):
        _list(recipe="sdm", bag="lares")


def test_meme_delete_wire_uri_container_and_base(daemon):
    # `meme_delete` rides `meme-delete` with {uri} + the container law; `base` = the hash the writer read.
    daemon.output = _DELETE_OUTPUT
    out = _delete(uri=_URI, recipe="default")
    assert daemon.wire() == {"verb": "meme-delete", "args": {"recipe": "default", "uri": _URI}}
    assert out == _DELETE_OUTPUT
    _delete(uri=_URI, bag="lares", base="sha256-get")
    assert daemon.wire() == {"verb": "meme-delete", "args": {"bag": "lares", "uri": _URI, "base": "sha256-get"}}


def test_meme_delete_stale_base_reads_conflict_and_moves_nothing(daemon):
    # CONTROL: the daemon's 412-shaped answer rides back as the receipt — `decision: conflict`, nothing
    # tombstoned — never an exception, so the caller reads the live hash and decides.
    daemon.output = {"uri": _URI, "decision": "conflict", "tombstoned": [], "canonicalHash": "sha256-live"}
    out = _delete(uri=_URI, recipe="default", base="sha256-stale")
    assert out["decision"] == "conflict" and out["tombstoned"] == [] and out["canonicalHash"] == "sha256-live"
    with pytest.raises(ValueError, match="no-container"):
        _delete(uri=_URI, recipe="sdm", bag="lares")
    assert len(daemon.lines) == 1                                    # the refused call never reached the wire


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


def test_a_refused_write_reaches_the_caller_naming_decision_reason_and_live_hash(daemon):
    daemon.output = dict(_PUT_OUTPUT, decision="conflict", reason="both-moved", landed=[], canonicalHash="sha256-live")
    result = _seat_call("meme_put", {"uri": _URI, "text": "the body", "recipe": "sdm", "base": "sha256-stale"})
    assert result.is_error
    assert "meme-put conflict" in _said(result) and "both-moved" in _said(result) and "sha256-live" in _said(result)
    daemon.output = dict(_PUT_OUTPUT, decision="refuse", landed=[], warnings=["stage-path-shape: the stage meme path reads no segment"])
    result = _seat_call("meme_put", {"uri": _URI, "text": "the body", "recipe": "default"})
    assert result.is_error and "meme-put refuse" in _said(result) and "stage-path-shape" in _said(result)


def test_every_refusal_family_reaches_the_caller_by_name(daemon, monkeypatch):
    # The seat's own refusal (`vessel-locked`), a tool's pre-wire refusal (`no-container`), a HITL guard, a shaping this
    # seat never routes, and an absent daemon: each answers isError AND carries its own words.
    daemon.error = {"errorMessage": "control-home-unavailable: vessel-locked: the vessel's key stays shut",
                    "refusal": {"reason": "vessel-locked"}}
    locked = _seat_call("tiddler_get", {"title": _URI, "recipe": "default", "meme": True})
    assert locked.is_error and "vessel-locked" in _said(locked) and "lares vault unlock" in _said(locked)
    bare = _seat_call("meme_list", {})
    assert bare.is_error and "no-container" in _said(bare)
    guarded = _seat_call("purge", {"name": "x"})
    assert guarded.is_error and "HITL" in _said(guarded)
    unshaped = _seat_call("pour", {"surface": "claude-code", "pointer": "p", "dry_run": True})
    assert unshaped.is_error and "carries no writeback/preview shaping" in _said(unshaped)
    monkeypatch.setattr(uds, "socket_path", lambda: "/nonexistent/lares.sock")
    absent = _seat_call("tiddler_get", {"title": _URI, "recipe": "default", "meme": True})
    assert absent.is_error and "no lares daemon" in _said(absent)


def test_a_landed_write_answers_unchanged_and_an_internal_fault_stays_unnamed(daemon):
    # CONTROL, both sides: a write that landed answers its receipt and no error; a fault the seat never named (a bug in
    # a tool body) still answers the bare line, carrying neither its own text nor a traceback.
    daemon.output = _PUT_OUTPUT
    landed = _seat_call("meme_put", {"uri": _URI, "text": "the body", "recipe": "sdm"})
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
    # words (an argument guard, the HITL guard, a shaping this seat never routes, an address that walks out of the shrine).
    assert "no-container" in _said(_seat_call("meme_list", {}, mcp))
    assert "HITL" in _said(_seat_call("purge", {"name": "x"}, mcp))
    assert "carries no writeback/preview shaping" in _said(_seat_call("pour", {"surface": "claude-code", "pointer": "p", "dry_run": True}, mcp))
    walked = _seat_call("recall", {"query": "q", "sensorium": "../abide"}, mcp)
    assert walked.is_error and "ONE path segment" in _said(walked)


def _described(name: str) -> str:
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return next(t.description for t in asyncio.run(mcp.list_tools()) if t.name == name)


def test_meme_put_text_names_the_stage_meme_law():
    # A writer meets the law in the tool's own text, before the gate refuses: a meme under the memory stage carries
    # its stage path in the title, and the refusal the law answers stands named.
    said = _described("meme_put")
    assert 'lar:///ha.ka.ba/kahua/memory/<class>/<slug>' in said and "stage-path-shape" in said


def test_meme_list_text_promises_a_row_bag_for_a_named_recipe_alone():
    # The daemon's own wiki (`recipe="default"`) answers ONE `bag` over the whole listing and no row names its layer;
    # the text says so, beside the shape each container answers.
    said = _described("meme_list")
    assert "{recipe, bags, roots, next}" in said and "{bag, roots, next}" in said
    assert 'under `recipe="default"` no row names a `bag`' in said


def test_tiddler_get_and_meme_list_texts_name_the_floor_word():
    # A caller learns from the tool's own text that `floor: true` marks a read the floor snapshot answered, and where
    # the word rides: on the answer a read hands back, on a bag listing's seat, on each row of a recipe listing.
    got = _described("tiddler_get")
    assert "`floor: true`" in got and "floor snapshot" in got
    listed = _described("meme_list")
    assert "`floor: true`" in listed and "floor snapshot" in listed
    assert "{bag, floor, roots, next}" in listed and "each row" in listed


def test_meme_put_text_names_the_seat_canon_refusal_and_the_true_layer():
    # The seat meets its canon fence in the tool's own text (reach-mu T4-2): a `bag` naming house canon refuses
    # `seat-canon-reach`, and the road reads copy-up then offer. A `recipe` lands in the wiki's writable bag (its working
    # layer, or the face's personal layer without a writer's seat), never "its top bag" (reach-mu decision 8).
    said = _described("meme_put")
    assert "seat-canon-reach" in said and "meme_offer" in said
    assert "top bag" not in said and "personal" in said and "`layer`" in said


def test_tiddler_put_text_names_the_seat_canon_refusal():
    said = _described("tiddler_put")
    assert "seat-canon-reach" in said

