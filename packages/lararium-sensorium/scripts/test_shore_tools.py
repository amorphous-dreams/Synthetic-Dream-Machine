"""Witness — the `shore` and `shore_flush` MCP tools: the seat reads the disk shore and asks the vessel's whole-island flush.

The daemon socket stands faked. `shore` reads both islands' lists as one shore, through the same two lines `lares shore`
rides (`wiki-act` carrying the `shore` verb into the active wiki, the `shore` verb into the daemon island), every page of
each; `face` names a lit sibling's shore and reaches the daemon island alone. `shore_flush` sends the custody door's
`shore-flush` frame, the one `lares shore flush` sends, and returns the vessel's reading of every island.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_shore_tools.py -q
"""
import asyncio
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import SHORE_VERBS, DaemonCoordinator, build_mcp, seat_of


def _list(rows_standoff, rows_pending, nxt=None, **extra):
    return {"ok": True, "op": "list", "standoffs": rows_standoff, "standoffCount": len(rows_standoff),
            "pending": rows_pending, "pendingCount": len(rows_pending), "mark": "m1", "next": nxt, **extra}


class _ShoreDaemon:
    """A daemon socket: the wiki island lists one standoff over two pages, the daemon island one pending row; a
    `shore-flush` custody frame answers `reading`."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: list = []
        self.reading = {"islands": [{"island": "daemon", "answered": True, "written": [], "writtenCount": 0, "unwritten": [],
                                     "unwrittenCount": 0, "fileWrites": 0, "drained": True}], "whole": True}
        self._srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._srv.bind(path)
        self._srv.listen(8)
        threading.Thread(target=self._serve, daemon=True).start()

    def _answer(self, line: dict) -> dict:
        if line.get("op") == "shore-flush":
            return {"op": "shore-flush", "reading": self.reading, "standing": "hearth"}
        verb, args = line["verb"], line["args"]
        shore = args["args"] if verb == "wiki-act" else args
        if verb == "wiki-act":
            out = (_list([{"uri": "lar:///a.b.c/w", "bagId": "w", "standoff": "k1"}], [], nxt="c1") if "after" not in shore
                   else _list([{"uri": "lar:///a.b.c/w2", "bagId": "w", "standoff": "k2"}], []))
        elif "face" in shore:
            out = _list([{"uri": "lar:///a.b.c/sib", "bagId": "s", "standoff": "k9"}], [], face=shore["face"])
        else:
            out = _list([], [{"uri": "lar:///a.b.c/gone", "bagId": "d"}])
        return {"status": "done", "requestId": "r1", "results": {"summary": {"ok": True, "output": out}}}

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
                line = json.loads(buf.split(b"\n", 1)[0].decode())
                self.lines.append(line)
                conn.sendall((json.dumps(self._answer(line)) + "\n").encode())

    def close(self) -> None:
        self._srv.close()


@pytest.fixture
def daemon(monkeypatch, tmp_path_factory):
    d = tmp_path_factory.mktemp("uds")
    fake = _ShoreDaemon(os.path.join(d, "daemon.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    monkeypatch.setattr(uds, "operator_did", lambda: "0xwitness")
    try:
        yield fake
    finally:
        fake.close()


def _fn(name):
    return build_mcp(DaemonCoordinator(wing="w"))._tool_manager.get_tool(name).fn  # noqa: SLF001 — the registered skin


def test_red_the_shore_tools_register_a_hotl_read_and_a_hotl_flush():
    tools = {t.name: t for t in asyncio.run(build_mcp(DaemonCoordinator(wing="w")).list_tools())}
    assert SHORE_VERBS == ("shore", "shore_flush")
    for name in SHORE_VERBS:
        assert name in tools and seat_of(name) == "HOTL"
    read, flush = tools["shore"].annotations, tools["shore_flush"].annotations
    assert (read.read_only_hint, read.destructive_hint, read.idempotent_hint, read.open_world_hint) == (True, False, True, False)
    assert (flush.read_only_hint, flush.destructive_hint, flush.idempotent_hint) == (False, False, True)


def test_red_shore_reads_both_islands_every_page_as_one_shore(daemon):
    out = _fn("shore")()
    assert [ln["verb"] for ln in daemon.lines] == ["wiki-act", "wiki-act", "shore"]
    assert daemon.lines[1]["args"]["args"] == {"op": "list", "after": "c1"}
    assert [(r["uri"], r["island"]) for r in out["standoffs"]] == [("lar:///a.b.c/w", "wiki"), ("lar:///a.b.c/w2", "wiki")]
    assert [(r["uri"], r["island"]) for r in out["pending"]] == [("lar:///a.b.c/gone", "daemon")]
    assert (out["standoffCount"], out["pendingCount"]) == (2, 1)


def test_red_shore_face_reads_a_lit_siblings_shore_at_the_daemon_island_alone(daemon):
    out = _fn("shore")(face=2)
    assert [(ln["verb"], ln["args"]) for ln in daemon.lines] == [("shore", {"op": "list", "face": 2})]
    assert out["face"] == 2 and [r["uri"] for r in out["standoffs"]] == ["lar:///a.b.c/sib"]


def test_red_shore_flush_sends_the_one_frame_and_returns_the_vessels_reading(daemon):
    out = _fn("shore_flush")()
    assert daemon.lines == [{"op": "shore-flush"}]
    assert out == daemon.reading
