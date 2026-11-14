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
    _ROWS = json.load(_f)["rows"]


class _FakeDaemon:
    """A unix-socket listener that records each NDJSON request line and answers ONE canned receipt."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: "list[dict]" = []
        self.output = None
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
    return {name: mcp._tool_manager.get_tool(name).fn for name in TIDDLER_VERBS}  # noqa: SLF001 — the registered skins


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
    # states all four. Reads read-only; the put and the delete name what they move; no tool reaches the open world.
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    want = {
        "wiki_filter":    (True, False, True),
        "tiddler_get":    (True, False, True),
        "wiki_render":    (True, False, True),
        "wiki_status":    (True, False, True),
        "tiddler_put":    (False, False, True),
        "tiddler_delete": (False, True, True),
    }
    for name, (read_only, destructive, idempotent) in want.items():
        a = tools[name].annotations
        assert a is not None, f"{name} states no annotations"
        assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == \
            (read_only, destructive, idempotent, False), name


def test_the_table_names_every_tool():
    assert {row["tool"] for row in _ROWS} == set(TIDDLER_VERBS)


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
                 lambda: t["tiddler_delete"](title="T"), lambda: t["wiki_status"](),
                 lambda: t["tiddler_get"](title="T", recipe="default", bag="lares")):
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
        ("tiddler-put-in-a-family: use the meme door. \"lar:///t/x\" stands as a meme root and this put moves `text`", "tiddler_put", {"title": "lar:///t/x", "recipe": "default", "text": "x"}),
        ("filter-malformed: Missing ] in filter expression (in \"[tag[x\")", "wiki_filter", {"filter": "[tag[x", "recipe": "default"}),
        ("cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required (no-grant)", "wiki_status", {"recipe": "default"}),
        ("wiki-not-anchored: wiki-filter answers recipe \"default\" alone in this phase", "wiki_filter", {"filter": "[tag[x]]", "recipe": "lares"}),
    ):
        daemon.error = {"errorMessage": refusal, "refusal": {"reason": refusal.split(":", 1)[0]}}
        is_error, said = _call(mcp, name, args)
        assert is_error and refusal.split(":", 1)[0] in said, (name, said)
