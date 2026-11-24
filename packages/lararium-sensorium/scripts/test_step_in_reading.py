"""Witness — a seat that meets a fallen vessel reads what the fall left, not just `engine-terminated`.

A fallen engine refuses every verb `engine-terminated`, and a fall during boot closes the socket. The refusal the seat
raises carries the step-in reading (`step_in`): the resting falls, the held ids, and the hand acts by their commands, read
from the files beside the store with no verb. `vessel-read-falls.test.ts` welds the reading to `lares vessel read`.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_step_in_reading.py -q
"""
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
import step_in

DOC = "4NMNnkMhL8jXrdJ9jamS2rUEaQDq"


def _plant(store: str) -> None:
    os.makedirs(store, exist_ok=True)
    falls = [
        {"life": "a" * 32, "cause": "wasm-unreachable", "path": "repo", "since": "2026-11-23T01:00:00.000Z", "inFlight": "docInFlight"},
        {"life": "b" * 32, "cause": "module-terminated", "path": "ledger", "since": "2026-11-23T02:00:00.000Z", "inFlight": None},
    ]
    with open(os.path.join(store, ".engine-falls"), "w", encoding="utf-8") as f:
        json.dump({"cap": 1, "falls": falls}, f)
    q = os.path.join(store, "quarantine-torn-snapshots-2026-11-23")
    os.makedirs(q)
    with open(os.path.join(q, "4N__MNnk.manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"documentId": DOC, "status": "torn", "quarantinedAt": "2026-11-23T00:00:00.000Z", "movedTo": "/lar/x"}, f)


class _FallenDaemon:
    """A daemon socket whose engine fell: every line refuses `engine-terminated`."""

    def __init__(self, path: str) -> None:
        self.path = path
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
                conn.sendall((json.dumps({
                    "status": "error", "requestId": "r1", "refusal": {"reason": "engine-terminated"},
                    "errorMessage": "engine-terminated: this vessel's Automerge engine stopped (wasm-unreachable, met on the repo path)",
                }) + "\n").encode())

    def close(self) -> None:
        self._srv.close()


@pytest.fixture
def store(monkeypatch, tmp_path):
    d = str(tmp_path / "vessel")
    monkeypatch.setattr(uds, "data_dir", lambda: d)
    monkeypatch.setattr(uds, "operator_did", lambda: "0xwitness")
    return d


def test_red_an_engine_terminated_refusal_carries_the_falls_the_held_ids_and_the_stop(store, monkeypatch, tmp_path_factory):
    _plant(store)
    fake = _FallenDaemon(os.path.join(tmp_path_factory.mktemp("uds"), "d.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    try:
        with pytest.raises(uds.LaresVerbError) as err:
            uds.call("hearth-roster", {})
    finally:
        fake.close()
    words = str(err.value)
    assert err.value.refusal == "engine-terminated"
    assert words.startswith("engine-terminated:")
    assert "2 engine fall(s) resting (the vessel stays down; the last module-terminated on the ledger path" in words
    assert "docInFlight (in-flight)" in words and f"{DOC} (quarantine)" in words
    assert "`lares vessel stop`" in words and "`lares vessel release <documentId> [--keep|--fresh]`" in words


def test_red_a_closed_socket_after_a_boot_fall_names_the_reading(store, monkeypatch, tmp_path):
    _plant(store)
    monkeypatch.setattr(uds, "socket_path", lambda: str(tmp_path / "absent.sock"))
    with pytest.raises(uds.LaresDaemonUnreachable) as err:
        uds.call("hearth-roster", {})
    assert "no lares daemon at" in str(err.value)
    assert "step-in reading from" in str(err.value) and "docInFlight" in str(err.value)


def test_control_a_house_with_nothing_resting_keeps_the_vessels_words(store, monkeypatch, tmp_path):
    os.makedirs(store)
    monkeypatch.setattr(uds, "socket_path", lambda: str(tmp_path / "absent.sock"))
    with pytest.raises(uds.LaresDaemonUnreachable) as err:
        uds.call("hearth-roster", {})
    assert "step-in" not in str(err.value)
    assert step_in.line(store) is None


def test_a_torn_falls_file_reads_as_one_fall_never_a_clean_run(tmp_path):
    (tmp_path / ".engine-falls").write_text("{torn")
    assert step_in.reading(str(tmp_path))["engineFalls"] == [
        {"life": None, "pid": None, "cause": "unknown", "path": "unknown", "since": "unknown", "inFlight": None}]


def test_the_cap_comes_from_the_file_the_vessel_wrote_never_a_copy(tmp_path):
    # The vessel writes its own cap beside the count; a file that names none reads neither "down" nor "rose".
    falls = [{"life": "a", "pid": None, "cause": "c", "path": "repo", "since": "s", "inFlight": None}] * 2
    (tmp_path / ".engine-falls").write_text(json.dumps({"cap": 5, "falls": falls}))
    assert "the vessel rose once" in step_in.line(str(tmp_path))
    (tmp_path / ".engine-falls").write_text(json.dumps({"falls": falls}))
    assert "stays down" not in step_in.line(str(tmp_path)) and "rose once" not in step_in.line(str(tmp_path))
    assert not hasattr(step_in, "RESTART_CAP")

