"""Witness — the seat's shore acts (lar:///carriage.disk.reads, lar:///carriage.disk.flushes): the seat reads the disk shore
and asks the vessel's whole-island flush, each reached as `act(address=..., args={...})`.

The daemon socket stands faked; its `call` answers `handler/seat` as bound. `shore` reads both islands' lists as one shore, through the same two lines `lares shore`
rides (`wiki-act` carrying the `shore` verb into the active wiki, the `shore` verb into the daemon island), every page of
each; `face` names a lit sibling's shore and reaches the daemon island alone. `shore_flush` sends the custody door's
`shore-flush` frame, the one `lares shore flush` sends, and returns the vessel's reading of every island.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_shore_tools.py -q
"""
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import DaemonCoordinator, build_mcp

SHORE_ACTS = {"shore": "lar:///carriage.disk.reads", "shore_flush": "lar:///carriage.disk.flushes"}


def _list(rows_pending, nxt=None, count=None, **extra):
    return {"ok": True, "op": "list", "pending": rows_pending, "pendingCount": len(rows_pending) if count is None else count,
            "mark": "m1", "next": nxt, **extra}


class _ShoreDaemon:
    """A daemon socket: the wiki island lists two pending rows over two pages, the daemon island one pending row; a
    `shore-flush` custody frame answers `reading`."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: list = []
        self.wiki_fault = None
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
        if verb == "call":
            seated = {"handler": "seat", "address": args["verb"], "params": args["params"]}
            return {"status": "done", "requestId": "r1", "results": {"summary": {"ok": True, "output": seated}}}
        shore =args["args"] if verb == "wiki-act" else args
        if verb == "wiki-act":
            out = (_list([{"uri": "lar:///a.b.c/w", "bagId": "w"}], nxt="c1", count=2) if "after" not in shore
                   else _list([{"uri": "lar:///a.b.c/w2", "bagId": "w"}], nxt=self.wiki_fault == "still" and "c1" or None, count=2))
            if self.wiki_fault == "unmarked":
                out.pop("mark")
            elif self.wiki_fault == "counted":
                out["pending"] = {"boundedArrayCount": 40}
            elif self.wiki_fault == "short":
                out["pendingCount"] = 3
        elif "face" in shore:
            out = _list([{"uri": "lar:///a.b.c/sib", "bagId": "s"}], face=shore["face"])
        else:
            out = _list([{"uri": "lar:///a.b.c/gone", "bagId": "d"}])
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
    return build_mcp(DaemonCoordinator(wing="w")).seat_acts[SHORE_ACTS[name]]


def _act():
    return build_mcp(DaemonCoordinator(wing="w"))._tool_manager.get_tool("act").fn  # noqa: SLF001 — the registered skin


def test_red_the_shore_acts_run_by_address_through_act(daemon):
    out = _act()(address=SHORE_ACTS["shore"], args={"face": 2})
    assert [(ln["verb"], ln["args"]) for ln in daemon.lines] == [
        ("call", {"verb": SHORE_ACTS["shore"], "params": {"face": 2}, "surface": "mcp"}), ("shore", {"op": "list", "face": 2})]
    assert out["face"] == 2
    assert _act()(address=SHORE_ACTS["shore_flush"]) == daemon.reading
    assert daemon.lines[-1] == {"op": "shore-flush"}


def test_red_shore_reads_both_islands_every_page_as_one_shore(daemon):
    out = _fn("shore")()
    assert [ln["verb"] for ln in daemon.lines] == ["wiki-act", "wiki-act", "shore"]
    assert daemon.lines[1]["args"]["args"] == {"op": "list", "after": "c1"}
    assert [(r["uri"], r["island"]) for r in out["pending"]] == [("lar:///a.b.c/w", "wiki"), ("lar:///a.b.c/w2", "wiki"), ("lar:///a.b.c/gone", "daemon")]
    assert out["pendingCount"] == 3
    assert sorted(out) == ["pending", "pendingCount"]


def test_red_shore_face_reads_a_lit_siblings_shore_at_the_daemon_island_alone(daemon):
    out = _fn("shore")(face=2)
    assert [(ln["verb"], ln["args"]) for ln in daemon.lines] == [("shore", {"op": "list", "face": 2})]
    assert out["face"] == 2 and [r["uri"] for r in out["pending"]] == ["lar:///a.b.c/sib"]


def test_red_shore_flush_sends_the_one_frame_and_returns_the_vessels_reading(daemon):
    out = _fn("shore_flush")()
    assert daemon.lines == [{"op": "shore-flush"}]
    assert out == daemon.reading


def test_red_the_plugin_readme_names_both_shore_acts_and_the_hand_that_settles():
    readme = open(os.path.join(os.path.dirname(__file__), "..", "..", "lares-cli", ".claude-plugin", "README.md"), encoding="utf-8").read()
    assert f'act(address="{SHORE_ACTS["shore_flush"]}")' in readme
    assert f'act(address="{SHORE_ACTS["shore"]}", args={{"face": N}})' in readme
    assert "lares shore restore" in readme and "lares shore remove" in readme


@pytest.mark.parametrize("fault, why", [
    ("unmarked", "named no mark"),
    ("counted", "arrived as a count"),
    ("still", "cursor stood still"),
    ("short", "counted 3 pending and its pages named 2"),
])
def test_red_shore_refuses_an_unpaged_list_by_name(daemon, fault, why):
    daemon.wiki_fault = fault
    with pytest.raises(uds.LaresVerbError, match=f"shore-list-unpaged.*{why}"):
        _fn("shore")()


def test_red_shore_refuses_a_malformed_face_by_name():
    with pytest.raises(Exception, match="face-malformed"):
        _fn("shore")(face=-1)
