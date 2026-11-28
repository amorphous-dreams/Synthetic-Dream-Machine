"""Witness — the seat's roster act (lar:///face.roster.reads): who is home, offered beside the law.

The daemon socket stands faked: the vessel's `call` answers `handler/seat`, and the one `hearth-roster` verb answers the
roster body `fixtures/hearth-roster.json` holds, the body `@lararium/mesh` composes and `lares vessel roster --json` carries
as `data` (lares-cli's hearth-roster-door suite welds those two). This witness holds the seat's half: the one verb it puts on
the wire, the body it returns unchanged, the act that reaches it by address, and a refusal by name.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_hearth_tools.py -q
"""
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import HEARTH_ROSTER_VERB, DaemonCoordinator, build_mcp

ADDRESS = "lar:///face.roster.reads"

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
                answer = ({"handler": "seat", "address": line["args"]["verb"], "params": line["args"]["params"]}
                          if line["verb"] == "call" else FIXTURE["roster"])
                summary = ({"ok": False, "error": self.refuse} if self.refuse else {"ok": True, "output": answer})
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


def test_the_roster_act_runs_by_address_through_act(daemon):
    act = _mcp()._tool_manager.get_tool("act").fn  # noqa: SLF001 — the registered skin
    assert act(address=ADDRESS) == FIXTURE["roster"]
    assert [(ln["verb"], ln["args"]) for ln in daemon.lines] == [
        ("call", {"verb": ADDRESS, "params": {}, "surface": "mcp"}), (HEARTH_ROSTER_VERB, {})]


def test_red_the_seat_puts_the_one_roster_verb_and_returns_the_body_unchanged_control_twice_reads_the_same(daemon):
    fn = _mcp().seat_acts[ADDRESS]
    one = fn()
    assert [(ln["verb"], ln["args"]) for ln in daemon.lines] == [(HEARTH_ROSTER_VERB, {})]
    assert HEARTH_ROSTER_VERB == "hearth-roster"
    assert one == FIXTURE["roster"]
    assert sorted(one) == ["asker", "counts", "grain", "lanes", "lanesGap", "more", "rotation", "seats", "unread", "vota"]
    # The rotation first: the worn face, who holds it, each seat under another face.
    assert one["rotation"]["worn"] == 1 and one["rotation"]["holders"] == ["s-0a11bb02", "s-f2c7aa01"]
    # Two grains, one row shape; nobody far reads online, only last heard.
    assert {s["grain"] for s in one["seats"]} == {"local", "far"}
    assert all("lastHeard" in s for s in one["seats"] if s["grain"] == "far")
    assert fn() == one


def test_red_a_vessel_refusal_crosses_by_its_own_words_control_nothing_else_rides(daemon):
    daemon.refuse = "vessel-locked: run `lares vault unlock`"
    fn = _mcp().seat_acts[ADDRESS]
    with pytest.raises(uds.LaresVerbError, match="vessel-locked"):
        fn()
