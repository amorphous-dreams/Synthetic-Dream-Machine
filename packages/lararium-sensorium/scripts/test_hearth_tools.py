"""Witness — the `vessel_roster` MCP tool: who is home, offered beside the law.

The daemon socket stands faked: it answers the one `hearth-roster` verb with the roster body `fixtures/hearth-roster.json`
holds, the body `@lararium/mesh` composes and `lares vessel roster --json` carries as `data` (lares-cli's hearth-roster-door
suite welds those two). This witness holds the seat's half: the one verb it puts on the wire, the body it returns unchanged,
its seat and annotations, and a refusal by name.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_hearth_tools.py -q
"""
import asyncio
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import HEARTH_ROSTER_VERB, HEARTH_VERBS, DaemonCoordinator, build_mcp, seat_of

FIXTURE = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "hearth-roster.json")))


class _RosterDaemon:
    """A daemon socket that answers the roster verb with the fixture's body, or refuses with `refuse`."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: list = []
        self.refuse = None
        self._srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._srv.bind(path)
        self._srv.listen(8)
        threading.Thread(target=self._serve, daemon=True).start()

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
                summary = ({"ok": False, "error": self.refuse} if self.refuse else {"ok": True, "output": FIXTURE["roster"]})
                conn.sendall((json.dumps({"status": "done", "requestId": "r1", "results": {"summary": summary}}) + "\n").encode())

    def close(self) -> None:
        self._srv.close()


@pytest.fixture
def daemon(monkeypatch, tmp_path_factory):
    d = tmp_path_factory.mktemp("uds")
    fake = _RosterDaemon(os.path.join(d, "daemon.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    monkeypatch.setattr(uds, "operator_did", lambda: "0xwitness")
    try:
        yield fake
    finally:
        fake.close()


def _mcp():
    return build_mcp(DaemonCoordinator(wing="w"))


def test_the_roster_tool_registers_as_a_hotl_read():
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    assert HEARTH_VERBS == ("vessel_roster",)
    assert "vessel_roster" in tools and seat_of("vessel_roster") == "HOTL"
    a = tools["vessel_roster"].annotations
    assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == (True, False, True, False)


def test_red_the_seat_puts_the_one_roster_verb_and_returns_the_body_unchanged_control_twice_reads_the_same(daemon):
    fn = _mcp()._tool_manager.get_tool("vessel_roster").fn  # noqa: SLF001 — the registered skin
    one = fn()
    assert [(ln["verb"], ln["args"]) for ln in daemon.lines] == [(HEARTH_ROSTER_VERB, {})]
    assert HEARTH_ROSTER_VERB == "hearth-roster"
    assert one == FIXTURE["roster"]
    assert sorted(one) == ["asker", "counts", "grain", "lanes", "lanesGap", "rotation", "seats", "unread", "vota"]
    # The rotation first: the worn face, who holds it, each seat under another face.
    assert one["rotation"]["worn"] == 1 and one["rotation"]["holders"] == ["s-0a11bb02", "s-f2c7aa01"]
    # Two grains, one row shape; nobody far reads online, only last heard.
    assert {s["grain"] for s in one["seats"]} == {"local", "far"}
    assert all("lastHeard" in s for s in one["seats"] if s["grain"] == "far")
    assert fn() == one


def test_red_a_vessel_refusal_crosses_by_its_own_words_control_nothing_else_rides(daemon):
    daemon.refuse = "vessel-locked: run `lares vault unlock`"
    fn = _mcp()._tool_manager.get_tool("vessel_roster").fn  # noqa: SLF001
    with pytest.raises(uds.LaresVerbError, match="vessel-locked"):
        fn()
