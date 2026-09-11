"""Witness — the `meme_put` / `meme_get` MCP tools: the MCP skin of the one placement function.

Each tool rides `lares_uds.call("meme-put" | "meme-get", args)` to the @daemon, never a store. The
witness spawns a FAKE daemon on a temp unix socket (it records every request line and answers a canned
receipt), so each assertion reads the EXACT `{verb, args}` the tool put on the wire — the contract the
daemon side builds to: at most one of `recipe`/`bag`; neither → the daemon reads `recipe: "default"`
(the host's ANCHOR); `base` carries the canonical hash the writer read (absent → adopt).

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_meme_tools.py -q
"""
import asyncio
import json
import os
import shutil
import socket
import tempfile
import threading

import pytest

import lares_uds as uds
from lares_mcp import MEME_VERBS, VERB_SEATS, DaemonCoordinator, build_mcp, seat_of

# Temp sockets live under the job's own tmp, never /tmp (the operator's ruling for this witness).
_TMP = "/home/joshu/.claude/jobs/a3afb6c8/tmp"

_URI = "lar:///ha.ka.ba/lares/api/pono/meme"
_PUT_OUTPUT = {"uri": _URI, "decision": "ingest", "grade": "ok", "landed": [_URI], "tombstoned": [],
               "canonicalHash": "sha256-put", "warnings": [], "diagnostics": []}
_GET_MEME = {"text": "the body", "canonicalHash": "sha256-get"}
# The daemon's outcome envelope — a reactor never answers bare null, so the meme rides under `meme`.
_GET_OUTPUT = {"uri": "lar:///ha.ka.ba/lares/api/pono/meme", "meme": _GET_MEME}


class _FakeDaemon:
    """A unix-socket listener that records each NDJSON request line and answers ONE canned receipt
    (`{status, results: {summary: {ok, output}}}` — the shape `lares_uds.output` peels)."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: "list[dict]" = []
        self.output = None
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
                receipt = {"status": "ok", "requestId": "r1",
                           "results": {"summary": {"ok": True, "output": self.output}}}
                conn.sendall((json.dumps(receipt) + "\n").encode())

    def close(self) -> None:
        self._srv.close()

    def wire(self, i: int = -1) -> dict:
        """The `{verb, args}` pair the tool put on the wire (requestedBy stripped — the did rides beside)."""
        line = self.lines[i]
        return {"verb": line["verb"], "args": line["args"]}


@pytest.fixture
def daemon(monkeypatch):
    os.makedirs(_TMP, exist_ok=True)
    d = tempfile.mkdtemp(prefix="meme-uds-", dir=_TMP)
    fake = _FakeDaemon(os.path.join(d, "daemon.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    monkeypatch.setattr(uds, "operator_did", lambda: "0xwitness")
    try:
        yield fake
    finally:
        fake.close()
        shutil.rmtree(d, ignore_errors=True)


def _tools():
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return {name: mcp._tool_manager.get_tool(name).fn for name in MEME_VERBS}  # noqa: SLF001 — the registered skins


def _put(**kw):
    return _tools()["meme_put"](**kw)


def _get(**kw):
    return _tools()["meme_get"](**kw)


def test_meme_tools_register_and_seat_hotl(daemon):
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    names = {t.name for t in asyncio.run(mcp.list_tools())}
    assert set(MEME_VERBS) == {"meme_put", "meme_get"} <= names
    for v in MEME_VERBS:
        assert v in VERB_SEATS and seat_of(v) == "HOTL"


def test_meme_put_default_recipe_sends_no_container(daemon):
    # neither recipe nor bag → the args carry NEITHER key; the daemon reads `recipe: "default"` (the
    # host's ANCHOR). The client never spells the default — one truth, held daemon-side.
    daemon.output = _PUT_OUTPUT
    out = _put(uri=_URI, text="the body")
    assert daemon.wire() == {"verb": "meme-put", "args": {"uri": _URI, "text": "the body"}}
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
    # `base` = the canonical hash the writer read back from meme_get — the merge base the gate reads.
    daemon.output = dict(_PUT_OUTPUT, decision="conflict")
    out = _put(uri=_URI, text="the body", recipe="sdm", base="sha256-get")
    assert daemon.wire() == {"verb": "meme-put",
                             "args": {"recipe": "sdm", "uri": _URI, "text": "the body", "base": "sha256-get"}}
    assert out["decision"] == "conflict"


def test_meme_put_refuses_recipe_and_bag_together(daemon):
    daemon.output = _PUT_OUTPUT
    with pytest.raises(ValueError, match="at most one of"):
        _put(uri=_URI, text="x", recipe="sdm", bag="lares")
    assert daemon.lines == []                                       # nothing reached the wire


def test_meme_tools_refuse_the_retired_at_form(daemon):
    # slugs ride BARE (`sdm`, `lares`); the `@` spelling stands retired — refused, never stripped.
    daemon.output = _PUT_OUTPUT
    with pytest.raises(ValueError, match="bare"):
        _put(uri=_URI, text="x", recipe="@sdm")
    with pytest.raises(ValueError, match="bare"):
        _get(uri=_URI, bag="@lares")
    assert daemon.lines == []


def test_meme_get_default_named_and_bag(daemon):
    daemon.output = _GET_OUTPUT
    assert _get(uri=_URI) == _GET_MEME
    assert daemon.wire() == {"verb": "meme-get", "args": {"uri": _URI}}
    _get(uri=_URI, recipe="sdm")
    assert daemon.wire() == {"verb": "meme-get", "args": {"recipe": "sdm", "uri": _URI}}
    _get(uri=_URI, bag="lares")
    assert daemon.wire() == {"verb": "meme-get", "args": {"bag": "lares", "uri": _URI}}


def test_meme_get_absent_meme_reads_null(daemon):
    # an absent meme rides as `meme: null` in the outcome; the tool hands back None — never the envelope.
    daemon.output = {"uri": _URI, "meme": None}
    assert _get(uri=_URI) is None


def test_meme_get_refuses_recipe_and_bag_together(daemon):
    with pytest.raises(ValueError, match="at most one of"):
        _get(uri=_URI, recipe="sdm", bag="lares")
    assert daemon.lines == []
