"""Witness — the record tools `get` / `put` / `delete` / `rename` and the engine reads behind `act`: the MCP skin of THE
TIDDLER DOOR (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean).

ONE CALL. Each record tool forwards `{verb, params, surface: "mcp"}` to the vessel's `call` verb, the params in their neutral
names; the vessel binds them against the carrier's live #/takes, so the seat guards no argument of its own. VERB-TABLE
PARITY: one table (`fixtures/tiddler-door-answers.json`) drives this skin and the CLI's (`lares-cli/tests/tiddler-door.test.ts`):
a record row's `call` names the `{verb, params}` both skins send, and its `output` comes back verbatim; an engine row rides
`act` by address, the vessel answers `handler/seat`, and the seat's own act puts the row's `{verb, args}` on the socket.
Beside it: each tool states its annotations, a write the vessel answers owed raises by name, and a house refusal crosses
the seat in its own words.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_tiddler_tools.py -q
"""
import asyncio
import inspect
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import DaemonCoordinator, build_mcp

_HERE = os.path.dirname(os.path.abspath(__file__))
RECORD_TOOLS = ("get", "put", "delete", "rename")
# The engine reads a row names by its seat act, each the carrier that seats it.
ENGINE_ACTS = {"wiki_render": "lar:///engine.wiki.renders", "wiki_status": "lar:///engine.layer.reads"}
with open(os.path.join(_HERE, "fixtures", "tiddler-door-answers.json"), encoding="utf-8") as _f:
    _TABLE = json.load(_f)["rows"]
_ROWS = [r for r in _TABLE if r["tool"] in RECORD_TOOLS]
_ENGINE_ROWS = [r for r in _TABLE if r["tool"] in ENGINE_ACTS]


class _FakeDaemon:
    """A unix-socket listener that records each NDJSON request line and answers a canned receipt: the next of `answers`
    while any wait, else `output` (or `error`)."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: "list[dict]" = []
        self.answers: list = []
        self.output = None
        self.error: "dict | None" = None
        self.rest: "dict | None" = None
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
                if self.answers:
                    receipt = {"status": "ok", "requestId": "r1", "results": {"summary": {"ok": True, "output": self.answers.pop(0)}}}
                elif self.error is not None:
                    receipt = {"status": "error", "requestId": "r1", **self.error}
                else:
                    receipt = {"status": "ok", "requestId": "r1", "results": {"summary": {"ok": True, "output": self.output}},
                               **({"rest": self.rest} if self.rest is not None else {})}
                conn.sendall((json.dumps(receipt) + "\n").encode())

    def close(self) -> None:
        self._srv.close()

    def wire(self, i: int = -1) -> dict:
        line = self.lines[i]
        return {"verb": line["verb"], "args": line["args"]}


@pytest.fixture
def daemon(monkeypatch, tmp_path_factory):
    d = tmp_path_factory.mktemp("uds")
    fake = _FakeDaemon(os.path.join(d, "daemon.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    monkeypatch.setattr(uds, "operator_did", lambda: "0xwitness")
    try:
        yield fake
    finally:
        fake.close()


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def _tools():
    mcp = _mcp()
    return {name: mcp._tool_manager.get_tool(name).fn for name in (*RECORD_TOOLS, "act")}  # noqa: SLF001 — the registered skins


def seated(address: str, params: dict) -> dict:
    """The vessel's answer for an act whose handler rests in the seat: the address and the args it bound."""
    return {"handler": "seat", "address": address, "params": params}


#: Each record tool's own address: the tool sends it, never its word, so no spelling a layer seats turns it into another act.
RECORD_ADDRESS = {"put": "lar:///engine.record.puts", "delete": "lar:///engine.record.removes", "rename": "lar:///engine.record.renames"}


def call_line(verb: str, params: dict) -> dict:
    """The one line a seat tool puts on the socket: the vessel's `call` naming the tool's own address (a `get` by filter
    the filter pages, else the record read), the params in their neutral names."""
    if verb == "get":
        verb = "lar:///engine.filter.pages" if "filter" in params else "lar:///engine.record.reads"
    return {"verb": "call", "args": {"verb": RECORD_ADDRESS.get(verb, verb), "params": params, "surface": "mcp"}}


def by_signature(fn, params: dict) -> dict:
    """A row's neutral params as a tool takes them: the names its signature declares, then `params` for the rest."""
    declared = set(inspect.signature(fn).parameters) - {"params"}
    named = {k: v for k, v in params.items() if k in declared}
    rest = {k: v for k, v in params.items() if k not in declared}
    return {**named, **({"params": rest} if rest else {})}


def test_the_record_tools_register_and_state_their_annotations(daemon):
    # The schema's defaults read worst-case (destructive, open-world, non-idempotent, not read-only), so each tool states
    # all four: `get` reads; `put`, `delete` and `rename` move records (a whole-text put destroys, an append repeats).
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    want = {"get": (True, False, True, False), "put": (False, True, False, False),
            "delete": (False, True, False, False), "rename": (False, True, False, False)}
    for name, hints in want.items():
        a = tools[name].annotations
        assert a is not None, f"{name} states no annotations"
        assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == hints, name
    assert set(tools).isdisjoint({"tiddler_get", "tiddler_put", "tiddler_delete", "wiki_filter", "wiki_render", "wiki_status", "wiki"})


def test_the_table_names_the_record_tools_and_the_engine_acts():
    assert {row["tool"] for row in _ROWS} == {"get", "put", "delete"}
    assert all("call" in row for row in _ROWS)
    assert {row["tool"] for row in _ENGINE_ROWS} == set(ENGINE_ACTS)


@pytest.mark.parametrize("row", _ROWS, ids=[f"{r['tool']}:{r['call']['params'].get('title') or r['call']['params'].get('filter') or 'list'}" for r in _ROWS])
def test_verb_table_parity_a_record_tool_sends_the_rows_call_and_the_row_output_returns(daemon, row):
    daemon.output = row["output"]
    fn = _tools()[row["tool"]]
    out = fn(**by_signature(fn, row["call"]["params"]))
    assert [daemon.wire(i) for i in range(len(daemon.lines))] == [call_line(row["call"]["verb"], row["call"]["params"])]
    assert out == row["output"]


@pytest.mark.parametrize("row", _ENGINE_ROWS, ids=[f"{r['tool']}:{r['wire']['args'].get('title') or r['wire']['args'].get('recipe')}" for r in _ENGINE_ROWS])
def test_verb_table_parity_an_engine_act_runs_in_the_seat_and_the_row_wire_rides(daemon, row):
    address = ENGINE_ACTS[row["tool"]]
    bound = {k.replace("_", "-"): v for k, v in row["mcp"].items()}
    daemon.answers = [seated(address, bound)]
    daemon.output = row["output"]
    out = _tools()["act"](address=address, args=row["mcp"])
    assert daemon.wire(0) == call_line(address, bound)
    assert daemon.wire(1) == row["wire"] and len(daemon.lines) == 2
    assert out == row["output"]


def test_a_record_tool_guards_no_argument_and_the_vessels_refusal_crosses_by_name(daemon):
    # THE VESSEL BINDS: a call naming no container rides to `call` as written, and the vessel's own refusal comes back in
    # its words; the seat adds no guard of its own.
    daemon.error = {"errorMessage": "no-container: name where this verb reads or writes", "refusal": {"reason": "no-container"}}
    with pytest.raises(uds.LaresVerbError, match="no-container"):
        _tools()["get"](title="T")
    assert daemon.wire() == call_line("get", {"title": "T"})


def test_the_engine_acts_keep_their_own_guards_before_the_wire(daemon):
    render = _mcp().seat_acts[ENGINE_ACTS["wiki_render"]]
    with pytest.raises(ValueError, match="one of `title`"):
        render(recipe="default")
    with pytest.raises(ValueError, match="one of `title`"):
        render(recipe="default", title="T", text="span")
    with pytest.raises(ValueError, match="form"):
        render(recipe="default", title="T", form="pdf")
    with pytest.raises(ValueError, match="render-output-substrate-refused"):
        render(recipe="default", title="T", output="workbench")
    assert daemon.lines == []


_OWED = {"band": "owed", "documents": [{"documentId": "2hUgpNYoRGAkCcCXTgZGecaQBXsp", "refusal": "save-unsealed",
                                         "error": "record-refused", "cause": "signer-refused"}]}


def test_a_write_the_vessel_answers_owed_raises_owed_with_the_band_never_ok(daemon):
    """NO SILENT LOSS (research/signer-refused): the vessel stamps `rest: {band: owed}` on a write whose save waits
    unsealed; every seat tool rides the one call wire, so each raises `owed` naming the document and the band, never ok."""
    t = _tools()
    daemon.rest = _OWED
    daemon.output = {"recipe": "lares", "title": "T", "decision": "put", "hash": "sha256-new", "changed": ["text"]}
    with pytest.raises(uds.LaresVerbError, match=r"^owed: .*2hUgpNYoRGAk.*save-unsealed") as put:
        t["put"](title="T", recipe="lares", text="x")
    assert put.value.refusal == "owed"
    assert '"band":"owed"' in str(put.value) and '"decision":"put"' in str(put.value)
    daemon.output = {"recipe": "lares", "title": "T", "decision": "removed", "tombstoned": ["T"]}
    with pytest.raises(uds.LaresVerbError, match=r"^owed: ") as deleted:
        t["delete"](title="T", recipe="lares")
    assert deleted.value.refusal == "owed"
    daemon.rest = None
    daemon.output = {"recipe": "lares", "title": "T", "decision": "put", "hash": "sha256-new", "changed": ["text"]}
    assert t["put"](title="T", recipe="lares", text="x")["decision"] == "put"


def test_an_act_the_vessel_answers_owed_raises_owed_at_the_session_door(monkeypatch, tmp_path_factory):
    """KAHUA-STAGE answers staged: true over a held save; the seat stamps `rest` on the act's answer, and
    `uds.session_act` (every session act rides it) raises `owed` naming the band, never the bare row."""
    d = tmp_path_factory.mktemp("uds-act")
    path = os.path.join(d, "daemon.sock")
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(path)
    srv.listen(2)

    def serve() -> None:
        conn, _ = srv.accept()
        with conn:
            buf = b""
            while True:
                chunk = conn.recv(65536)
                if not chunk:
                    return
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    frame = json.loads(line.decode())
                    if frame.get("op") == "session:open":
                        reply = {"kind": "session:opened", "requestId": frame["requestId"], "ownerEpoch": "e", "sessionId": "s", "generation": 0, "faceRef": "f"}
                    elif frame.get("op") == "session:act":
                        reply = {"kind": "session:act-result", "requestId": frame["requestId"], "answer": {
                            "status": "done", "output": {"title": "memo", "staged": True}, "rest": _OWED}}
                    else:
                        return
                    conn.sendall((json.dumps(reply) + "\n").encode())

    threading.Thread(target=serve, daemon=True).start()
    monkeypatch.setattr(uds, "socket_path", lambda: path)
    monkeypatch.setattr(uds, "resolve_face", lambda face, timeout=30.0: 1)
    try:
        with pytest.raises(uds.LaresVerbError, match=r"^owed: the kahua-stage landed .*2hUgpNYoRGAk") as staged:
            uds.session_act("kahua-stage", {"title": "memo", "text": "body"})
        assert staged.value.refusal == "owed"
        assert '"staged":true' in str(staged.value)
    finally:
        srv.close()


def _call(mcp, name: str, args: dict):
    async def go():
        try:
            return False, str(await mcp.call_tool(name, args))
        except Exception as e:  # noqa: BLE001 — the seat's own tool error
            return True, str(e)
    return asyncio.run(go())


def test_house_refusals_cross_the_seat_in_their_own_words(daemon):
    # The refusal classes the vessel names reach the caller through the seat's one refusal door: the family law on a
    # put, a malformed filter, a face with no reach, each in the house's words and never as a bare crash line.
    mcp = _mcp()
    for refusal, name, args in (
        ("family-carriage-derives: \"lar:///t/x\" stands as a meme root and this put moves `type`", "put", {"title": "lar:///t/x", "recipe": "default", "fields": {"type": "text/plain"}}),
        ("filter-malformed: Missing ] in filter expression (in \"[tag[x\")", "get", {"filter": "[tag[x", "recipe": "default"}),
        ("cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required (no-grant)", "act", {"address": ENGINE_ACTS["wiki_status"], "args": {"recipe": "default"}}),
        ("wiki-unreached: wiki-filter — no wiki \"elsewhere\" this face reaches", "get", {"filter": "[tag[x]]", "recipe": "elsewhere"}),
    ):
        daemon.error = {"errorMessage": refusal, "refusal": {"reason": refusal.split(":", 1)[0]}}
        is_error, said = _call(mcp, name, args)
        assert is_error and refusal.split(":", 1)[0] in said, (name, said)


def test_a_line_sweep_rides_match_and_context_on_the_one_get(daemon):
    """S5 THE LINES LENS (course/ai-surface-gestures): `match` rides untrimmed and `context` as its count (0 included) on
    the one `get`, no new tool; the vessel's own refusal (`filter-context-alone`) comes back in its words; the card
    names the sweep."""
    t = _tools()
    daemon.output = {"recipe": "default", "filter": "[tag[x]]", "rows": [{"title": "T", "fields": {}, "lines": [{"n": 2, "text": "it is"}], "matches": 1}], "total": 1, "next": None, "asOf": "0123456789abcdef"}
    assert t["get"](filter="[tag[x]]", recipe="default", params={"match": " is ", "context": 0})["rows"][0]["matches"] == 1
    assert daemon.wire() == call_line("get", {"filter": "[tag[x]]", "recipe": "default", "match": " is ", "context": 0})
    refusal = "filter-context-alone: `context` shapes the lines `match` finds; name `match=<words>` beside it, or drop `context`."
    daemon.error = {"errorMessage": refusal, "refusal": {"reason": "filter-context-alone"}}
    is_error, said = _call(_mcp(), "get", {"filter": "[tag[x]]", "recipe": "default", "params": {"context": 1}})
    assert is_error and "filter-context-alone" in said
    card = {x.name: x for x in asyncio.run(_mcp().list_tools())}["get"].description
    assert "`match`" in card and "lines: [{n, text}]" in card and "filter-context-alone" in card


def test_the_cards_name_the_rendered_read(daemon):
    # THE RENDERED TIDDLER (backlog-awakens): an agent reads a whole render with ONE `get` by title and any slice with its
    # own `get` by filter over the sources, so the card says so; the write cards name the wall only the renderer passes.
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    get = tools["get"].description
    assert "projection: rendered" in get and "rendered-from" in get and "slice" in get, get
    for name in ("put", "delete"):
        assert "rendered-derives" in tools[name].description, name


def test_the_text_alone_rides_a_named_key_and_takes_no_parameter(daemon):
    """S3 TEXT ALONE (course/ai-surface-gestures): the CLI's `lares get title=<title> form=text` writes the text's bytes alone;
    the MCP seat reads values, so its card names the key each lens carries the text at, and `get` takes no `text`
    parameter (on `put`, `text` names the words written)."""
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    card = tools["get"].description
    assert "form=text" in card and "tiddler.fields.text" in card and "meme.text" in card and "meme.slotText" in card, card
    assert "text" not in inspect.signature(_tools()["get"]).parameters
    assert "text" in inspect.signature(_tools()["put"]).parameters


def test_the_record_tools_reach_one_bag_and_the_engine_acts_name_a_wiki_alone(daemon):
    # `get`, `put` and `delete` name a bag (one record through its store, no engine) on the call; every engine act takes
    # `recipe` alone, so its signature carries no `bag`.
    t = _tools()
    daemon.output = {"bag": "lar:///ha.ka.ba/bags/lares", "title": "T", "tiddler": None}
    assert t["get"](title="T", bag="lares") == daemon.output
    assert daemon.wire() == call_line("get", {"title": "T", "bag": "lares"})
    for name in ("get", "put", "delete"):
        assert "bag" in inspect.signature(t[name]).parameters, name
    acts = _mcp().seat_acts
    for address in ENGINE_ACTS.values():
        assert "bag" not in inspect.signature(acts[address]).parameters, address
    overview = acts[ENGINE_ACTS["wiki_status"]]()
    assert set(overview) == {"catalog", "activation", "residency"}
    assert [line["verb"] for line in daemon.lines[-3:]] == ["list-wikis", "wiki-active", "residency"]


def test_every_write_shape_rides_as_named_params_on_the_one_put(daemon):
    # An append, a create, a slot, a replace span and its words, a field patch: each rides the call in its neutral name, as
    # given, and the vessel binds it against the carrier's #/takes.
    t = _tools()
    daemon.output = {"recipe": "default", "title": "Ledger", "decision": "put", "hash": "sha256:2"}
    t["put"](title="Ledger", recipe="default", append="a dated note", create=True)
    assert daemon.wire() == call_line("put", {"title": "Ledger", "recipe": "default", "append": "a dated note", "create": True})
    t["put"](title="lar:///t/x", recipe="default", base="sha256:1", params={"slot": "#/a", "replace": " the cat ", "with": " a dog"})
    assert daemon.wire() == call_line("put", {"title": "lar:///t/x", "recipe": "default", "base": "sha256:1",
                                              "slot": "#/a", "replace": " the cat ", "with": " a dog"})
    t["put"](title="Note", recipe="default", fields={"status": "trued"}, params={"tag_add": "reviewed", "unset": ["priority"]})
    assert daemon.wire() == call_line("put", {"title": "Note", "recipe": "default", "fields": {"status": "trued"},
                                              "tag-add": "reviewed", "unset": ["priority"]})
    t["put"](title="Note", recipe="default", text="x", mu="pentacle")
    assert daemon.wire() == call_line("put", {"title": "Note", "recipe": "default", "text": "x", "mu": "pentacle"})


def test_a_rename_rides_its_title_its_target_and_its_base(daemon):
    daemon.output = {"recipe": "default", "title": "Old", "to": "New", "decision": "renamed"}
    assert _tools()["rename"](title="Old", to="New", base="sha256:1", recipe="default")["decision"] == "renamed"
    assert daemon.wire() == call_line("rename", {"title": "Old", "to": "New", "base": "sha256:1", "recipe": "default"})


def test_put_and_delete_take_no_meme_argument():
    t = _tools()
    for call in ("put", "delete"):
        with pytest.raises(TypeError):
            t[call](title="lar:///t/x", recipe="default", meme=True)


def test_the_seat_instructions_a_waking_client_receives_name_the_call_shapes_and_the_law_first(daemon):
    """DELIVERY WITNESS (S7): the instructions the built server serves at first contact name the record tools, the one
    act by address, the meme's whole read, and the law read first."""
    served = build_mcp(DaemonCoordinator(wing="w")).instructions
    for door in ("`get`", "`put`", "`delete`", "`rename`", "act(address="):
        assert door in served, door
    assert 'aperture="arc"' in served
    assert 'act(address="lar:///engine.law.indexes")' in served
    assert "Read the house's law first" in served


# ── the seat's own doors hold (ward#1's custody read: F1-F4) ───────────────────────────────────────────────────────

def test_a_record_write_the_vessel_answers_unlanded_raises_by_name(daemon):
    """F2: the vessel answers a stale base, a standing record or a family delete as a receipt naming its decision, never an
    error; the seat raises each by name with what the receipt says, and a landed receipt returns whole."""
    mcp = _mcp()
    for name, args, receipt in (
        ("put", {"title": "T", "recipe": "default", "text": "x", "base": "sha256-old"},
         {"has": "<<~ has name=`T` params=`decision/conflict`>>", "title": "T", "decision": "conflict", "hash": "sha256-live"}),
        ("put", {"title": "T", "recipe": "default", "text": "x", "create": True},
         {"has": "<<~ has name=`T` params=`decision/exists`>>", "title": "T", "decision": "exists", "hash": "sha256-live"}),
        ("delete", {"title": "lar:///t/x#/a", "recipe": "default"},
         {"has": "<<~ has name=`lar:///t/x#/a` params=`decision/refused`>>", "decision": "refused", "refusal": "tiddler-delete-in-a-family",
          "consequence": {"family": "lar:///t/x", "members": 3}}),
        ("rename", {"title": "Old", "to": "New", "recipe": "default", "base": "sha256-old"},
         {"has": "<<~ has name=`Old` params=`decision/conflict`>>", "decision": "conflict", "hash": "sha256-live"}),
    ):
        daemon.output = receipt
        is_error, said = _call(mcp, name, args)
        assert is_error and f"{name}-{receipt['decision']}: nothing landed" in said, (name, said)
        if "refusal" in receipt:
            assert "tiddler-delete-in-a-family" in said and "members" in said
        else:
            assert "sha256-live" in said
    # CONTROL: a landed receipt returns as the vessel wrote it.
    daemon.output = {"has": "<<~ has name=`T` params=`decision/put`>>", "title": "T", "decision": "put", "hash": "sha256-new"}
    assert _tools()["put"](title="T", recipe="default", text="x")["decision"] == "put"


def test_a_seat_act_walks_no_dry_path_its_code_never_walks(daemon):
    """F1: a layer that claims dry/walks for a seat act lets the vessel carry `_` to the seat; whether the seat previews is a
    fact of its code (`SEAT_DRY`, empty today), so the call refuses mu-cell-empty and the handler never runs."""
    from lares_mcp import SEAT_DRY
    assert SEAT_DRY == frozenset()
    t = _tools()
    daemon.answers = [{**seated("lar:///face.draft.stages", {"title": "T", "text": "x"}), "mu": {"asked": "pentacle", "carry": "_0"}}]
    with pytest.raises(Exception, match="mu-cell-empty"):
        t["act"](address="lar:///face.draft.stages", args={"title": "T", "text": "x", "mu": "pentacle"})
    assert len(daemon.lines) == 1   # the vessel's call alone: no session, no stage


def test_a_record_tool_takes_an_answer_from_its_own_class_alone(daemon):
    """F3: each record tool sends its own address, and an answer from any other address (a seat act a layer spelled `get`,
    or a stamp naming another carrier) refuses tool-class-crossed and runs nothing."""
    t = _tools()
    t["get"](title="T", recipe="default")
    assert daemon.wire(0)["args"]["verb"] == "lar:///engine.record.reads"
    daemon.answers = [seated("lar:///face.draft.stages", {"title": "T", "text": "x"})]
    with pytest.raises(Exception, match="tool-class-crossed"):
        t["get"](title="T", recipe="default", params={"text": "x"})
    assert len(daemon.lines) == 2
    daemon.output = {"has": "<<~ has name=`T`>>", "decision": "put", "carrier": {"carrier": "lar:///ha.ka.ba/lares/afford/engine.record.puts", "bag": "b", "base": "x"}}
    with pytest.raises(Exception, match="tool-class-crossed"):
        t["get"](title="T", recipe="default")
    # CONTROL: an answer its own carrier stamps returns whole.
    daemon.output = {"has": "<<~ has name=`T`>>", "title": "T", "carrier": {"carrier": "lar:///ha.ka.ba/lares/afford/engine.record.reads", "bag": "b", "base": "x"}}
    assert t["get"](title="T", recipe="default")["title"] == "T"


def _page(n: int, pages: int, text: str, total: int, after: "str | None", hashed: str = "h1", uri: str = "lar:///t/x") -> dict:
    mark = f"partial:p{n}:{hashed}" if after is not None else hashed
    if after is None and pages > 1:
        mark = f"partial:p{n}:{hashed}"
    return {"has": "<<~ has name=`lar:///t/x` params=`layer/lar:///b base/x`>>", "title": uri, "recipe": "default",
            "meme": {"uri": uri, "text": text, "canonicalHash": mark, "bytes": total, "page": {"page": n, "pages": pages}},
            "next": {"grain": "whole", "after": after} if after is not None else None}


def test_the_one_get_reads_a_whole_carrier_page_by_page_and_refuses_a_mismatch(daemon):
    """F4: `get(aperture="arc")` on a meme that answers past one page follows the cursor to the end and joins the carrier; a page
    naming another hash refuses read-page-mismatch."""
    t = _tools()
    daemon.answers = [_page(1, 2, "ab", 4, "c1"), {**_page(2, 2, "cd", 4, None), "meme": {**_page(2, 2, "cd", 4, None)["meme"], "canonicalHash": "h1"}}]
    out = t["get"](title="lar:///t/x", recipe="default", aperture="arc")
    assert out["meme"]["text"] == "abcd" and out["meme"]["canonicalHash"] == "h1" and out["next"] is None
    assert daemon.wire(1)["args"]["params"]["after"] == "c1"
    daemon.answers = [_page(1, 2, "ab", 4, "c1"), {**_page(2, 2, "cd", 4, None), "meme": {**_page(2, 2, "cd", 4, None)["meme"], "canonicalHash": "h2"}}]
    with pytest.raises(Exception, match="read-page-mismatch"):
        t["get"](title="lar:///t/x", recipe="default", aperture="arc")


def test_an_unlanded_write_raises_by_the_class_that_answered_through_act_too(daemon):
    """F2 through `act`: a record write asked by its address answers the same receipt, and the seat raises it by the class
    the answer's carrier names, whichever tool asked."""
    daemon.output = {"has": "<<~ has name=`T` params=`decision/conflict`>>", "title": "T", "decision": "conflict", "hash": "sha256-live",
                     "carrier": {"carrier": "lar:///ha.ka.ba/lares/afford/engine.record.puts", "bag": "b", "base": "x"}}
    is_error, said = _call(_mcp(), "act", {"address": "lar:///engine.record.puts", "args": {"title": "T", "text": "x", "base": "sha256-old", "recipe": "default"}})
    assert is_error and "put-conflict: nothing landed" in said and "sha256-live" in said
    # CONTROL: a landed receipt through `act` returns whole.
    daemon.output = {**daemon.output, "decision": "put", "hash": "sha256-new"}
    assert _tools()["act"](address="lar:///engine.record.puts", args={"title": "T", "text": "x", "recipe": "default"})["decision"] == "put"
