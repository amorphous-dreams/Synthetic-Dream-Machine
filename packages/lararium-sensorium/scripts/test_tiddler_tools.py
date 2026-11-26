"""Witness — the `tiddler_get` / `tiddler_put` / `tiddler_delete` / `wiki_filter` / `wiki_render` / `wiki_status` MCP
tools: the MCP skin of THE TIDDLER DOOR (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean).

VERB-TABLE PARITY. One table (`fixtures/tiddler-door-answers.json`) drives this skin and the CLI's
(`lares-cli/tests/tiddler-door.test.ts`): for each row the tool must put the row's `{verb, args}` on the daemon's
socket and hand the row's `output` back verbatim, the same wire and the same body `lares tiddler|wiki … --json`
answers as `data`. Beside it: every tool states its annotations explicitly (the schema's defaults read worst-case),
the container law refuses before the wire, a write that never landed raises by name, and a house refusal crosses the
seat in its own words.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_tiddler_tools.py -q
"""
import asyncio
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import TIDDLER_VERBS, VERB_SEATS, DaemonCoordinator, build_mcp, seat_of

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "fixtures", "tiddler-door-answers.json"), encoding="utf-8") as _f:
    _ROWS = [r for r in json.load(_f)["rows"] if r["tool"] in TIDDLER_VERBS or r["tool"] == "wiki"]


class _FakeDaemon:
    """A unix-socket listener that records each NDJSON request line and answers ONE canned receipt."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: "list[dict]" = []
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
                receipt = ({"status": "error", "requestId": "r1", **self.error} if self.error is not None else
                           {"status": "ok", "requestId": "r1",
                            "results": {"summary": {"ok": True, "output": self.output}},
                            **({"rest": self.rest} if self.rest is not None else {})})
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
    return {name: mcp._tool_manager.get_tool(name).fn for name in (*TIDDLER_VERBS, "wiki")}  # noqa: SLF001 — the registered skins


def test_tiddler_tools_register_and_seat_hotl(daemon):
    names = {t.name for t in asyncio.run(_mcp().list_tools())}
    assert set(TIDDLER_VERBS) == {"tiddler_get", "tiddler_put", "tiddler_delete",
                                  "wiki_filter", "wiki_render", "wiki_status"} <= names
    for v in TIDDLER_VERBS:
        assert v in VERB_SEATS and seat_of(v) == "HOTL"
    # The switcher keeps its one tool this phase (the `wiki_switch|hold|release|active` rename rides phase 2), and no
    # action-string tool stands yet (`wiki_act`, phase 2): a tool nobody built never lists.
    assert "wiki" in names and names.isdisjoint({"wiki_act", "wiki_catalog", "wiki_switch"})


def test_every_tiddler_tool_states_its_annotations_explicitly(daemon):
    # The schema's defaults read worst-case (destructive, open-world, non-idempotent, not read-only), so each tool
    # states all four. Reads read-only; the put and the delete name what they move (a whole-text put destroys, an append repeats);
    # no tool reaches the open world.
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    want = {
        "wiki_filter":    (True, False, True),
        "tiddler_get":    (True, False, True),
        "wiki_render":    (True, False, True),
        "wiki_status":    (True, False, True),
        "tiddler_put":    (False, True, False),   # `text=` replaces the whole text; an append lands again on each call
        "tiddler_delete": (False, True, True),
    }
    for name, (read_only, destructive, idempotent) in want.items():
        a = tools[name].annotations
        assert a is not None, f"{name} states no annotations"
        assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == \
            (read_only, destructive, idempotent, False), name


def test_the_table_names_every_tool():
    assert {row["tool"] for row in _ROWS} == set(TIDDLER_VERBS) | {"wiki"}


@pytest.mark.parametrize("row", _ROWS, ids=[f"{r['tool']}:{r['wire']['args'].get('title') or r['wire']['args'].get('filter') or 'status'}" for r in _ROWS])
def test_verb_table_parity_the_row_wire_rides_and_the_row_output_returns(daemon, row):
    daemon.output = row["output"]
    out = _tools()[row["tool"]](**row["mcp"])
    assert daemon.wire() == row["wire"]
    assert out == row["output"]


def test_every_tiddler_tool_refuses_a_missing_container_before_the_wire(daemon):
    t = _tools()
    for call in (lambda: t["wiki_filter"](filter="[tag[x]]"), lambda: t["tiddler_get"](title="T"),
                 lambda: t["wiki_render"](title="T"), lambda: t["tiddler_put"](title="T", fields={"a": "b"}),
                 lambda: t["tiddler_delete"](title="T"),
                 lambda: t["tiddler_get"](title="T", recipe="default", bag="lares"),
                 lambda: t["wiki_filter"](filter="[tag[x]]", recipe=None)):
        with pytest.raises(ValueError, match="no-container"):
            call()
    assert daemon.lines == []


def test_arguments_refuse_before_the_wire(daemon):
    t = _tools()
    with pytest.raises(ValueError, match="one of `title`"):
        t["wiki_render"](recipe="default")
    with pytest.raises(ValueError, match="one of `title`"):
        t["wiki_render"](recipe="default", title="T", text="span")
    with pytest.raises(ValueError, match="form"):
        t["wiki_render"](recipe="default", title="T", form="pdf")
    with pytest.raises(ValueError, match="render-output-substrate-refused"):
        t["wiki_render"](recipe="default", title="T", output="workbench")
    with pytest.raises(ValueError, match="string values"):
        t["tiddler_put"](recipe="default", title="T", fields={"n": 1})
    assert daemon.lines == []


def test_tiddler_get_answers_an_absent_tiddler_as_the_verb_does(daemon):
    daemon.output = {"recipe": "default", "title": "Nowhere", "tiddler": None}
    assert _tools()["tiddler_get"](title="Nowhere", recipe="default") == {"recipe": "default", "title": "Nowhere", "tiddler": None}


def test_tiddler_put_raises_where_nothing_landed(daemon):
    t = _tools()
    daemon.output = {"recipe": "default", "title": "T", "decision": "conflict", "hash": "sha256-live", "changed": []}
    with pytest.raises(uds.LaresVerbError, match=r"tiddler-put conflict.*sha256-live"):
        t["tiddler_put"](title="T", recipe="default", fields={"a": "b"}, base="sha256-old")
    daemon.output = {"recipe": "default", "title": "T", "decision": "exists", "hash": "sha256-live", "changed": []}
    with pytest.raises(uds.LaresVerbError, match=r"tiddler-put exists"):
        t["tiddler_put"](title="T", recipe="default", text="x", create=True)
    daemon.output = {"recipe": "default", "title": "T", "decision": "noop", "hash": "sha256-live", "changed": []}
    assert t["tiddler_put"](title="T", recipe="default", fields={"a": "b"})["decision"] == "noop"
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"recipe": "default", "title": "T", "fields": {"a": "b"}}}


_OWED = {"band": "owed", "documents": [{"documentId": "2hUgpNYoRGAkCcCXTgZGecaQBXsp", "refusal": "save-unsealed",
                                         "error": "record-refused", "cause": "signer-refused"}]}


def test_a_write_the_vessel_answers_owed_raises_owed_with_the_band_never_ok(daemon):
    """NO SILENT LOSS (research/signer-refused): the vessel stamps `rest: {band: owed}` on a write whose save waits
    unsealed; every MCP write rides `_meme_wire`, so each raises `owed` naming the document and the band, never ok."""
    t = _tools()
    daemon.rest = _OWED
    daemon.output = {"recipe": "lares", "title": "T", "decision": "put", "hash": "sha256-new", "changed": ["text"]}
    with pytest.raises(uds.LaresVerbError, match=r"^owed: .*2hUgpNYoRGAk.*save-unsealed") as put:
        t["tiddler_put"](title="T", recipe="lares", text="x")
    assert put.value.refusal == "owed"
    assert '"band":"owed"' in str(put.value) and '"decision":"put"' in str(put.value)
    daemon.output = {"recipe": "lares", "title": "T", "decision": "removed", "tombstoned": ["T"]}
    with pytest.raises(uds.LaresVerbError, match=r"^owed: ") as deleted:
        t["tiddler_delete"](title="T", recipe="lares")
    assert deleted.value.refusal == "owed"
    daemon.rest = None
    daemon.output = {"recipe": "lares", "title": "T", "decision": "put", "hash": "sha256-new", "changed": ["text"]}
    assert t["tiddler_put"](title="T", recipe="lares", text="x")["decision"] == "put"


def test_an_act_the_vessel_answers_owed_raises_owed_at_the_session_door(monkeypatch, tmp_path_factory):
    """KAHUA-STAGE answers staged: true over a held save; the seat stamps `rest` on the act's answer, and
    `uds.session_act` (every MCP act rides it) raises `owed` naming the band, never the bare row."""
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


def test_tiddler_delete_raises_on_a_stale_base_and_answers_absent(daemon):
    t = _tools()
    daemon.output = {"recipe": "default", "title": "T", "decision": "conflict", "tombstoned": [], "hash": "sha256-live"}
    with pytest.raises(uds.LaresVerbError, match=r"tiddler-delete conflict.*sha256-live"):
        t["tiddler_delete"](title="T", recipe="default", base="sha256-old")
    daemon.output = {"recipe": "default", "title": "T", "decision": "absent", "tombstoned": []}
    assert t["tiddler_delete"](title="T", recipe="default")["decision"] == "absent"


def test_tiddler_delete_of_a_family_raises_with_its_consequence_and_lands_under_the_family_flag(daemon):
    # THE FAMILY LAW AT THE SEAT: a root without the flag moves nothing and the tool error quotes the consequence the
    # delete would land; with `family=True` the flag rides the wire and the receipt comes back whole.
    t = _tools()
    read = {"act": "delete", "target": "lar:///t/x", "position": "root", "family": "lar:///t/x",
            "acts": [{"title": "lar:///t/x", "act": "tombstone", "bag": "w"}, {"title": "lar:///t/x#/b", "act": "tombstone", "bag": "w"}],
            "leaves": [], "orphans": [], "refusals": []}
    daemon.output = {"recipe": "default", "title": "lar:///t/x", "decision": "refused", "refusal": "tiddler-delete-in-a-family",
                     "why": "tiddler-delete-in-a-family: \"lar:///t/x\" stands as a meme root of lar:///t/x", "tombstoned": [], "consequence": read}
    with pytest.raises(uds.LaresVerbError, match=r"tiddler-delete-in-a-family.*nothing moved.*lar:///t/x#/b") as raised:
        t["tiddler_delete"](title="lar:///t/x", recipe="default")
    assert raised.value.refusal == "tiddler-delete-in-a-family"
    assert daemon.wire() == {"verb": "tiddler-delete", "args": {"recipe": "default", "title": "lar:///t/x"}}
    daemon.output = {"recipe": "default", "title": "lar:///t/x", "decision": "removed", "tombstoned": ["lar:///t/x", "lar:///t/x#/b"], "consequence": read}
    assert t["tiddler_delete"](title="lar:///t/x", recipe="default", family=True)["tombstoned"] == ["lar:///t/x", "lar:///t/x#/b"]
    assert daemon.wire() == {"verb": "tiddler-delete", "args": {"recipe": "default", "title": "lar:///t/x", "family": True}}


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
        ("family-carriage-derives: \"lar:///t/x\" stands as a meme root and this put moves `type`", "tiddler_put", {"title": "lar:///t/x", "recipe": "default", "fields": {"type": "text/plain"}}),
        ("filter-malformed: Missing ] in filter expression (in \"[tag[x\")", "wiki_filter", {"filter": "[tag[x", "recipe": "default"}),
        ("cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required (no-grant)", "wiki_status", {"recipe": "default"}),
        ("wiki-unreached: wiki-filter — no wiki \"elsewhere\" this face reaches", "wiki_filter", {"filter": "[tag[x]]", "recipe": "elsewhere"}),
    ):
        daemon.error = {"errorMessage": refusal, "refusal": {"reason": refusal.split(":", 1)[0]}}
        is_error, said = _call(mcp, name, args)
        assert is_error and refusal.split(":", 1)[0] in said, (name, said)


def test_the_cards_name_the_rendered_read(daemon):
    # THE RENDERED TIDDLER (backlog-awakens): an agent reads a whole render with ONE `tiddler_get` and any slice with its
    # own `wiki_filter` over the sources, so the cards say so; the write cards name the wall only the renderer passes.
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    get, filt = tools["tiddler_get"].description, tools["wiki_filter"].description
    assert "projection: rendered" in get and "rendered-from" in get, get
    assert "rendered-from" in filt and "slice" in filt, filt
    for name in ("tiddler_put", "tiddler_delete"):
        assert "rendered-derives" in tools[name].description, name


def test_the_record_tools_reach_one_bag_and_the_engine_verbs_name_a_wiki_alone(daemon):
    # `tiddler_get`, `tiddler_put` and `tiddler_delete` reach a bag (one record through its store, no engine) and name it on
    # the wire; every engine verb names `recipe` alone, so a `bag` there never rides (the signature carries no `bag`).
    import inspect
    t = _tools()
    daemon.output = {"bag": "lar:///ha.ka.ba/bags/lares", "title": "T", "tiddler": None}
    assert t["tiddler_get"](title="T", bag="lares") == daemon.output
    assert daemon.wire() == {"verb": "tiddler-get", "args": {"bag": "lares", "title": "T"}}
    for name in ("wiki_filter", "wiki_render", "wiki_status"):
        assert "bag" not in inspect.signature(t[name]).parameters, name
    for name in ("tiddler_put", "tiddler_delete"):
        assert "bag" in inspect.signature(t[name]).parameters, name
    with pytest.raises(TypeError):
        t["wiki_filter"](filter="[tag[x]]", bag="lares")
    overview = t["wiki_status"]()
    assert set(overview) == {"catalog", "activation", "residency"}
    assert [line["verb"] for line in daemon.lines[-3:]] == ["list-wikis", "wiki-active", "residency"]


def test_a_retired_parameter_refuses_aloud_before_the_wire(daemon):
    # `text` retired into `grain` (the lens and the grain kept apart): a caller still naming it hears the refusal and the
    # word that replaced it, and nothing crosses the wire; the SDK would otherwise drop it and answer a grain never asked.
    mcp = _mcp()
    for value in (False, True):
        is_error, said = _call(mcp, "tiddler_get", {"title": "T", "recipe": "default", "text": value})
        assert is_error and "param-retired: `text` retired" in said and 'grain="skinny"' in said, said
    assert daemon.lines == []


def test_title_less_family_listing_refuses_the_flags_it_does_not_read(daemon):
    # The listing reads container, tree and cursor; a slot, grain, fields or max_bytes beside it refuses by name, as the CLI does.
    t = _tools()
    for stray in ({"slot": "#/a"}, {"grain": "fat"}, {"fields": ["text"]}, {"max_bytes": 10}):
        with pytest.raises(ValueError, match="title-less meme listing"):
            t["tiddler_get"](meme=True, recipe="default", **stray)
    assert daemon.lines == []


def test_an_append_rides_without_a_base_on_a_record_and_a_slot_and_names_its_words_alone(daemon):
    t = _tools()
    daemon.output = {"has": "<<~ has name=`Ledger` params=`recipe/default decision/put hash/sha256:2`>>", "recipe": "default", "title": "Ledger", "decision": "put", "hash": "sha256:2"}
    assert t["tiddler_put"](title="Ledger", recipe="default", append="a dated note")["hash"] == "sha256:2"
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"recipe": "default", "title": "Ledger", "append": "a dated note"}}
    assert t["tiddler_put"](title="Ledger", recipe="default", append="first", create=True)["decision"] == "put"
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"recipe": "default", "title": "Ledger", "append": "first", "create": True}}
    before = len(daemon.lines)
    for crossed in ({"text": "x"}, {"base": "sha256:1"}, {"fields": {"a": "b"}}, {"unset": ["a"]}):
        with pytest.raises(ValueError, match="append names its words alone"):
            t["tiddler_put"](title="Ledger", recipe="default", append="y", **crossed)
    assert len(daemon.lines) == before
    daemon.output = {"recipe": "default", "title": "Ledger", "decision": "conflict", "hash": "sha256:3"}
    with pytest.raises(uds.LaresVerbError, match=r"kept moving under the append.*sha256:3"):
        t["tiddler_put"](title="Ledger", recipe="default", append="y")
    daemon.output = {"recipe": "default", "title": "lar:///t/x#/a", "decision": "put", "hash": "sha256:4", "landed": [], "kept": [], "tombstoned": [], "warnings": []}
    assert t["tiddler_put"](title="lar:///t/x", recipe="default", slot="#/a", append="note")["decision"] == "put"
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"recipe": "default", "title": "lar:///t/x#/a", "append": "note"}}


def test_the_slot_folds_into_the_title_and_a_slot_text_put_names_no_base(daemon):
    t = _tools()
    daemon.output = {"recipe": "default", "title": "lar:///t/x#/a", "decision": "put", "hash": "sha256:5"}
    t["tiddler_put"](title="lar:///t/x", recipe="default", slot="#/a", text="a new body")
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"recipe": "default", "title": "lar:///t/x#/a", "text": "a new body"}}
    t["tiddler_put"](title="lar:///t/x#/a", recipe="default", text="a new body", base="partial:#/a:sha256:9")
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"recipe": "default", "title": "lar:///t/x#/a", "text": "a new body", "base": "partial:#/a:sha256:9"}}
    before = len(daemon.lines)
    for bad in ("a", "#/", "#/a b", "#/a//b"):
        with pytest.raises(ValueError, match="slot-malformed"):
            t["tiddler_put"](title="lar:///t/x", recipe="default", slot=bad, text="x")
    with pytest.raises(ValueError, match="slot-beside-fragment"):
        t["tiddler_put"](title="lar:///t/x#/a", recipe="default", slot="#/b", text="x")
    assert len(daemon.lines) == before


def test_a_bag_takes_the_plain_put_and_the_family_delete(daemon):
    t = _tools()
    daemon.output = {"bag": "working", "title": "lar:///t/x", "decision": "put", "hash": "sha256:6", "canonicalHash": "sha256:c"}
    t["tiddler_put"](title="lar:///t/x", bag="working", text="a whole carrier")
    assert daemon.wire() == {"verb": "tiddler-put", "args": {"bag": "working", "title": "lar:///t/x", "text": "a whole carrier"}}
    daemon.output = {"bag": "working", "title": "lar:///t/x", "decision": "removed", "tombstoned": [], "retracted": ["lar:///t/x"]}
    t["tiddler_delete"](title="lar:///t/x", bag="working", family=True)
    assert daemon.wire() == {"verb": "tiddler-delete", "args": {"bag": "working", "title": "lar:///t/x", "family": True}}
    before = len(daemon.lines)
    for call, kwargs in (("tiddler_put", {"text": "x"}), ("tiddler_delete", {})):
        with pytest.raises(ValueError, match="no-container"):
            t[call](title="lar:///t/x", recipe="default", bag="working", **kwargs)
    assert len(daemon.lines) == before


def test_put_and_delete_take_no_meme_argument():
    t = _tools()
    for call in ("tiddler_put", "tiddler_delete"):
        with pytest.raises(TypeError):
            t[call](title="lar:///t/x", recipe="default", meme=True)


def test_meme_all_joins_pages_and_retains_the_first_provenance(daemon):
    daemon.output = {"has": "<<~ has name=`first`>>", "title": "lar:///t/x", "meme": {"uri": "lar:///t/x", "text": "aloha", "canonicalHash": "hash", "bytes": 5}, "grain": {"applied": "whole"}, "next": None}
    answer = _tools()["tiddler_get"](title="lar:///t/x", recipe="default", meme=True, all=True)
    assert answer == daemon.output
    assert daemon.wire()["args"]["grain"] == "whole"


def test_meme_all_joins_utf8_pages_and_refuses_changed_pages(monkeypatch):
    parts = ['<<^ code=`&#x0001;`>>\n', '<<~ ahu slot=`#/a`>>\né\n<<~/ahu>>\n', '<<~ ahu slot=`#/b`>>\n<<~/ahu>>\n<<^ code=`&#x0004;`>>']
    size = len(''.join(parts).encode('utf-8'))
    def page(i):
        return {"has": f"<<~ has name=`page{i + 1}` params=`layer/home base/partial:p{i + 1}:hash`>>", "title": "lar:///t/x", "recipe": "default", "lens": "meme", "meme": {"uri": "lar:///t/x", "text": parts[i], "canonicalHash": f"partial:p{i + 1}:hash" if i < 2 else "hash", "bytes": size, "page": {"page": i + 1, "pages": 3}}, "grain": {"applied": "whole"}, "next": {"grain": "whole", "after": str(i + 1)} if i < 2 else None}
    pages = [page(i) for i in range(3)]
    calls = []
    def call(verb, args):
        calls.append(args)
        return {"results": {"summary": {"ok": True, "output": pages[int(args.get("after", "0"))]}}}
    monkeypatch.setattr(uds, "call", call)
    get = _tools()["tiddler_get"]
    answer = get(title="lar:///t/x", recipe="default", meme=True, all=True)
    assert answer["meme"]["text"].encode() == ''.join(parts).encode()
    assert answer["meme"]["canonicalHash"] == "hash"
    assert answer["has"] == "<<~ has name=`page1` params=`layer/home base/hash`>>"
    assert answer["next"] is None
    assert len(calls) == 3
    pages[1]["meme"]["canonicalHash"] = "partial:p2:other"
    with pytest.raises(ValueError, match="read-page-mismatch"):
        get(title="lar:///t/x", recipe="default", meme=True, all=True)


@pytest.mark.parametrize("fault", ["cycle", "origin", "page", "missing-text", "short"])
def test_meme_all_refuses_inconsistent_continuations(monkeypatch, fault):
    def page(i):
        return {"has": "<<~ has name=`x`>>", "title": "lar:///t/x", "recipe": "default", "lens": "meme", "meme": {"uri": "lar:///t/x", "text": "x", "canonicalHash": f"partial:p{i}:hash" if i < 3 else "hash", "bytes": 3, "page": {"page": i, "pages": 3}}, "next": {"grain": "whole", "after": str(i)} if i < 3 else None}
    pages = [page(i) for i in range(1, 4)]
    if fault == "cycle": pages[1]["next"]["after"] = "1"
    if fault == "origin": pages[1]["recipe"] = "other"
    if fault == "page": pages[1]["meme"]["page"]["page"] = 3
    if fault == "missing-text": del pages[1]["meme"]["text"]
    if fault == "short": pages[1]["next"] = None
    def call(verb, args):
        return {"results": {"summary": {"ok": True, "output": pages[int(args.get("after", "0"))]}}}
    monkeypatch.setattr(uds, "call", call)
    with pytest.raises(ValueError, match="read-page-mismatch"):
        _tools()["tiddler_get"](title="lar:///t/x", recipe="default", meme=True, all=True)


def test_meme_all_propagates_a_stale_cursor_without_a_prefix(monkeypatch):
    def call(verb, args):
        if "after" in args:
            raise uds.LaresVerbError("read-cursor-stale")
        return {"results": {"summary": {"ok": True, "output": {"has": "<<~ has name=`x`>>", "title": "lar:///t/x", "meme": {"text": "prefix", "uri": "lar:///t/x", "canonicalHash": "partial:p1:hash", "bytes": 12, "page": {"page": 1, "pages": 2}}, "next": {"grain": "whole", "after": "1.hash"}}}}}
    monkeypatch.setattr(uds, "call", call)
    with pytest.raises(uds.LaresVerbError, match="read-cursor-stale"):
        _tools()["tiddler_get"](title="lar:///t/x", recipe="default", meme=True, all=True)
