"""Witness — the `kahua_propose` / `kahua_stage` / `kahua_list` / `kahua_get` MCP tools: an AI seat's reach onto its face's kahua stage.

THE SEAT PROPOSES, STAGES AND READS; THE OPERATOR'S HAND LIFTS. Each tool opens a local SESSION under the `seat` hand (the vessel
seats the `seat` profile, which refuses the kahua pin, lift and withdraw rows at the socket), runs ONE `session:act`
naming the store door's row (`kahua-propose`, `kahua-stage`, `kahua-read`), and closes. No `kahua_lift`, `kahua_withdraw` or
`kahua_mint` tool exists. The witness stands a FAKE vessel on a temp unix socket that records every frame and answers
the session protocol, so each assertion reads the exact frames the tool put on the wire.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_kahua_tools.py -q
"""
import asyncio
import json
import os
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import KAHUA_VERBS, VERB_SEATS, DaemonCoordinator, build_mcp, seat_of


class _FakeVessel:
    """A unix-socket listener speaking the custody `act` frame (one per connection) and the session protocol."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.frames: "list[dict]" = []
        self.answer: dict = {"status": "done", "output": {"items": []}}
        self.refuse: "str | None" = None
        self.open: "set[int]" = {0, 1, 2}
        self.worn = 2
        self._srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._srv.bind(path)
        self._srv.listen(4)
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self) -> None:
        while True:
            try:
                conn, _ = self._srv.accept()
            except OSError:
                return
            threading.Thread(target=self._conn, args=(conn,), daemon=True).start()

    def _conn(self, conn: socket.socket) -> None:
        with conn:
            buf = b""
            while True:
                while b"\n" not in buf:
                    chunk = conn.recv(65536)
                    if not chunk:
                        return
                    buf += chunk
                line, buf = buf.split(b"\n", 1)
                frame = json.loads(line.decode())
                self.frames.append(frame)
                op, rid = frame.get("op"), frame.get("requestId")
                if op == "act" and frame.get("act") == "face.resolve":
                    # The seat's reading: named none -> the WORN face (h2 here); named one -> it, only while it stands open.
                    named = (frame.get("args") or {}).get("face")
                    if named is None:
                        reply = {"op": "act", "act": "face.resolve", "result": {"face": self.worn}}
                    elif named in self.open:
                        reply = {"op": "act", "act": "face.resolve", "result": {"face": named}}
                    else:
                        reply = {"op": "act", "act": "face.resolve", "status": "error",
                                 "refusal": f"face-not-open: the face h{named} does not stand open on this vessel"}
                    conn.sendall((json.dumps(reply) + "\n").encode())
                    return
                if op == "session:open":
                    reply = {"kind": "session:opened", "requestId": rid, "ownerEpoch": "e1", "sessionId": "s1",
                             "generation": 0, "faceRef": "proof-face"}
                elif op == "session:act":
                    reply = ({"kind": "session:refused", "requestId": rid, "refusal": self.refuse} if self.refuse
                             else {"kind": "session:act-result", "requestId": rid, "answer": self.answer})
                elif op == "session:close":
                    return
                else:
                    reply = {"kind": "session:refused", "requestId": rid, "refusal": "malformed-message"}
                conn.sendall((json.dumps(reply) + "\n").encode())

    def close(self) -> None:
        self._srv.close()

    def acts(self) -> "list[dict]":
        return [{"act": f["act"], "args": f["args"]} for f in self.frames if f.get("op") == "session:act"]


@pytest.fixture
def vessel(monkeypatch, tmp_path_factory):
    d = tmp_path_factory.mktemp("uds")
    fake = _FakeVessel(os.path.join(d, "vessel.sock"))
    monkeypatch.setattr(uds, "socket_path", lambda: fake.path)
    try:
        yield fake
    finally:
        fake.close()


def _tools():
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return {name: mcp._tool_manager.get_tool(name).fn for name in KAHUA_VERBS}  # noqa: SLF001 — the registered skins


def test_kahua_tools_register_seat_hotl_and_carry_no_lift():
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    names = {t.name for t in asyncio.run(mcp.list_tools())}
    assert set(KAHUA_VERBS) == {"kahua_propose", "kahua_stage", "kahua_list", "kahua_get"} <= names
    for v in KAHUA_VERBS:
        assert v in VERB_SEATS and seat_of(v) == "HOTL"
    # The operator's hand lifts: no MCP tool pins, lifts or withdraws.
    assert names.isdisjoint({"kahua_lift", "kahua_withdraw", "kahua_mint"})


def test_kahua_propose_opens_a_seat_session_on_the_resolved_face_and_runs_the_propose_row(vessel):
    vessel.answer = {"status": "done", "output": {"verb": "kahua-propose", "id": "i" * 64, "cid": "c" * 64}}
    proposals = [{"title": "T", "revision": "r1", "text": "body", "taint": ["web:example"]}]
    out = _tools()["kahua_propose"](proposals=proposals)
    assert out == {"id": "i" * 64, "cid": "c" * 64}
    opened = [f for f in vessel.frames if f.get("op") == "session:open"]
    assert [(f["hand"], f["faceRef"]) for f in opened] == [("seat", "h2")]
    assert vessel.acts() == [{"act": "kahua-propose", "args": {"proposals": proposals}}]
    assert any(f.get("op") == "session:close" for f in vessel.frames)


def test_kahua_list_and_get_run_the_read_row_on_the_named_worn_face(vessel):
    vessel.answer = {"status": "done", "output": {"verb": "kahua-read", "items": []}}
    vessel.worn = 1
    assert _tools()["kahua_list"](face=1) == {"items": []}
    vessel.answer = {"status": "done", "output": {"verb": "kahua-read", "item": None, "history": []}}
    assert _tools()["kahua_get"](title="T", history=True, face=1) == {"item": None, "history": []}
    assert vessel.acts() == [{"act": "kahua-read", "args": {"action": "list"}},
                             {"act": "kahua-read", "args": {"action": "get", "title": "T", "history": True}}]
    # The seat reads the worn face first; naming it, the seat opens it, marked as the AI seat.
    assert [f["args"] for f in vessel.frames if f.get("op") == "act"] == [{"worn": True}] * 2
    opened = [f for f in vessel.frames if f.get("op") == "session:open"]
    assert {f["faceRef"] for f in opened} == {"h1"} and all(f.get("seat") == "ai" for f in opened)


def test_the_ai_seat_naming_a_face_other_than_the_worn_one_refuses_and_opens_no_session(vessel):
    vessel.worn = 2
    for call in (lambda t: t["kahua_list"](face=1), lambda t: t["kahua_get"](title="T", face=0),
                 lambda t: t["kahua_propose"](proposals=[{"title": "T", "revision": "r", "text": "b", "taint": []}], face=1)):
        with pytest.raises(uds.LaresVerbError, match="face-hand-refused"):
            call(_tools())
    assert not any(f.get("op") == "session:open" for f in vessel.frames)


def test_the_mcp_seat_marks_every_request_line_as_the_ai_seat(vessel):
    assert uds.SEAT_KIND == "ai"
    try:
        uds.call("recall", {"query": "x"}, requested_by="0xseat")
    except Exception:
        pass
    lines = [f for f in vessel.frames if f.get("verb") == "recall"]
    assert lines and lines[0].get("seat") == "ai"


def test_with_several_faces_open_and_none_named_the_seat_acts_as_the_worn_face(vessel):
    vessel.answer = {"status": "done", "output": {"verb": "kahua-read", "items": []}}
    vessel.worn = 1
    assert _tools()["kahua_list"]() == {"items": []}
    assert [f["args"] for f in vessel.frames if f.get("op") == "act"] == [{"worn": True}]
    assert [f["faceRef"] for f in vessel.frames if f.get("op") == "session:open"] == ["h1"]


def test_a_named_face_that_stands_shut_and_is_not_worn_refuses_by_name_and_opens_no_session(vessel):
    vessel.open = {1}
    vessel.worn = 1
    with pytest.raises(uds.LaresVerbError, match="face-hand-refused"):
        _tools()["kahua_list"](face=2)
    assert not any(f.get("op") == "session:open" for f in vessel.frames)


def test_a_row_refusal_and_a_session_refusal_raise_by_name(vessel):
    vessel.worn = 0
    vessel.answer = {"status": "done", "output": {"refused": "kahua-unpinned: the face pins no stage", "refusal": "KahuaRefused"}}
    with pytest.raises(uds.LaresVerbError, match="kahua-unpinned"):
        _tools()["kahua_list"](face=0)
    vessel.refuse = "beyond-profile"
    with pytest.raises(uds.LaresVerbError, match="beyond-profile"):
        _tools()["kahua_get"](title="T", face=0)
    with pytest.raises(ValueError, match="proposals"):
        _tools()["kahua_propose"](proposals=[], face=0)


def _described(name: str) -> str:
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    return next(t.description for t in asyncio.run(mcp.list_tools()) if t.name == name)


def test_kahua_list_text_names_the_relation_and_the_unpinned_stage():
    said = _described("kahua_list")
    assert "relation" in said and '`stage: "none"`' in said


def test_kahua_propose_text_tells_the_body_digest_from_the_row_digest():
    # Two digests share one word. A proposal carries the BODY digest (sha-256 of the raw body bytes); `lares kahua stage`
    # prints the ROW digest and `lift --digest` takes it. The text names both and the refusal a swap earns.
    said = _described("kahua_propose")
    assert "BODY digest" in said and "ROW digest" in said and "proposal-digest" in said
    assert "sha-256 of the raw body bytes" in said


def test_kahua_stage_runs_the_stage_row_on_a_seat_session_of_the_worn_face(vessel):
    # THE SEAT STAGES; THE HAND LIFTS: one row into the face's local canon rides the `kahua-stage` row on a `seat`
    # session, carrying the title, the body and the fields, and answers the row digest a lift names.
    vessel.answer = {"status": "done", "output": {"verb": "kahua-stage", "title": "T", "digest": "d" * 64, "relation": "F", "staged": True}}
    out = _tools()["kahua_stage"](title="T", text="body", fields={"tags": "memory"})
    assert out == {"title": "T", "digest": "d" * 64, "relation": "F", "staged": True}
    opened = [f for f in vessel.frames if f.get("op") == "session:open"]
    assert [(f["hand"], f["faceRef"], f.get("seat")) for f in opened] == [("seat", "h2", "ai")]
    assert vessel.acts() == [{"act": "kahua-stage", "args": {"title": "T", "text": "body", "fields": {"tags": "memory"}}}]
    # A row with no fields names none on the wire.
    _tools()["kahua_stage"](title="T", text="body")
    assert vessel.acts()[-1] == {"act": "kahua-stage", "args": {"title": "T", "text": "body"}}


def test_kahua_stage_refuses_a_malformed_row_and_another_face_before_any_session(vessel):
    stage = _tools()["kahua_stage"]
    for bad in ({"title": "", "text": "b"}, {"title": "T", "text": None}, {"title": "T", "text": "b", "fields": {"n": 1}},
                {"title": "T", "text": "b", "fields": ["tags"]}):
        with pytest.raises(ValueError, match="kahua_stage"):
            stage(**bad)
    with pytest.raises(uds.LaresVerbError, match="face-hand-refused"):
        stage(title="T", text="b", face=1)
    assert not any(f.get("op") == "session:open" for f in vessel.frames)
    # CONTROL: the vessel's own row refusal crosses by name.
    vessel.worn = 0
    vessel.answer = {"status": "done", "output": {"refused": "kahua-stage-no-canon: the face holds no local canon", "refusal": "KahuaRefused"}}
    with pytest.raises(uds.LaresVerbError, match="kahua-stage-no-canon"):
        stage(title="T", text="b")
