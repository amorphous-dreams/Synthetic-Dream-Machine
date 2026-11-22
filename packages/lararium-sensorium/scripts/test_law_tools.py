"""Witness — the `law_index` / `law_pin` / `law_unpin` MCP tools: the house's law offered where an agent wakes.

The daemon socket stands faked: a small pin store answers `tiddler-get` / `tiddler-put`, and a filter reader answers
`wiki-filter` for the runs a pin set holds (`[[t]]`, `-[[t]]`, a `[prefix[…]]` run naming the Mu members,
`+[match[t]]`). The engine's own answer to the real filters rides `@lararium/tw5`'s law-index suite; this witness holds
the seat's half: the filters it puts on the wire (the same strings the CLI and the wake run), the order it answers, the
one run a pin moves, the round trip back to the seeded text, and the refusals by name.

    ~/.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_law_tools.py -q
"""
import asyncio
import json
import os
import re
import socket
import threading

import pytest

import lares_uds as uds
from lares_mcp import (LAW_INDEX_FILTER, LAW_PINS_FILTER, LAW_PINS_TITLE, LAW_VERBS, SEAT_INSTRUCTIONS,
                       DaemonCoordinator, build_mcp, seat_of)

API = "lar:///ha.ka.ba/lares/api"
BOOT = f"{API}/noosphere-boot"
MU_ROOT = f"{API}/mu"
MU = [f"{API}/mu/chao", f"{API}/mu/the-four-tools"]
LAW = [f"{API}/pono/drift-ward", f"{API}/pono/lar-uri"]
STANDING = {BOOT, MU_ROOT, *MU, *LAW}
SEEDED = f"[[{BOOT}]] [[{MU_ROOT}]] [prefix[{MU_ROOT}/]!regexp[#]sort[title]]"


def evaluate(text: str) -> list:
    """The pin-set grammar, in small: each whitespace run in turn, as TiddlyWiki reads these four shapes."""
    out: list = []
    for run in text.split():
        m = re.fullmatch(r"\+\[match\[(.+)\]\]", run)
        if m:
            out = [t for t in out if t == m.group(1)]
            continue
        m = re.fullmatch(r"-\[\[(.+)\]\]", run)
        if m:
            out = [t for t in out if t != m.group(1)]
            continue
        m = re.fullmatch(r"\[\[(.+)\]\]", run)
        named = [m.group(1)] if m else (MU if run.startswith(f"[prefix[{MU_ROOT}/]") else [])
        out.extend(t for t in named if t not in out)
    return out


class _PinDaemon:
    """A unix-socket listener answering each NDJSON request by its verb, over one pin store."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lines: "list[dict]" = []
        self.pins: "str | None" = SEEDED
        self.hash = 0
        self.put_decision = "put"
        self._srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._srv.bind(path)
        self._srv.listen(8)
        threading.Thread(target=self._serve, daemon=True).start()

    def answer(self, verb: str, args: dict) -> dict:
        # THE DOOR'S GRADIENT, IN SMALL: an answer that left the text home hands a card's base, which no text put takes.
        if verb == "tiddler-get":
            mark = "" if args.get("grain") == "fat" else "skinny:"
            return {"recipe": "default", "title": args["title"],
                    "tiddler": None if self.pins is None else {"fields": {"title": LAW_PINS_TITLE, "text": self.pins}, "hash": f"{mark}h{self.hash}"}}
        if verb == "tiddler-put":
            assert not str(args.get("base") or "").startswith("skinny:"), "base-from-skinny: the pin set's base came from a card"
            if self.put_decision != "put":
                return {"decision": self.put_decision, "hash": f"h{self.hash}"}
            self.pins = args["text"]
            self.hash += 1
            return {"decision": "put", "bag": "lar:///ha.ka.ba/bags/daemon", "hash": f"h{self.hash}"}
        f = args["filter"]
        pins = [t for t in evaluate(self.pins or "") if t in STANDING]
        if f == LAW_PINS_FILTER:
            return {"titles": pins, "total": len(pins), "next": None}
        if f == LAW_INDEX_FILTER:
            rows = [{"title": t, "fields": {} if t == BOOT else {"role": f"the  role\nof {t.rsplit('/', 1)[-1]}"}}
                    for t in pins + [t for t in LAW if t not in pins]]
            return {"rows": rows, "total": len(rows), "next": None}
        m = re.fullmatch(r"\[lares\.law\[\]match\[(.+?)\]\]", f)
        if m:
            return {"titles": [m.group(1)] if m.group(1) in STANDING else [], "total": 0, "next": None}
        return {"titles": evaluate(f), "total": 0, "next": None}

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
                receipt = {"status": "ok", "requestId": "r1",
                           "results": {"summary": {"ok": True, "output": self.answer(line["verb"], line["args"])}}}
                conn.sendall((json.dumps(receipt) + "\n").encode())

    def close(self) -> None:
        self._srv.close()

    def puts(self) -> list:
        return [ln["args"] for ln in self.lines if ln["verb"] == "tiddler-put"]


@pytest.fixture
def daemon(monkeypatch, tmp_path_factory):
    d = tmp_path_factory.mktemp("uds")
    fake = _PinDaemon(os.path.join(d, "daemon.sock"))
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
    return {name: mcp._tool_manager.get_tool(name).fn for name in LAW_VERBS}  # noqa: SLF001 — the registered skins


def test_the_law_tools_register_seat_hotl_and_state_their_annotations(daemon):
    tools = {t.name: t for t in asyncio.run(_mcp().list_tools())}
    for name, read_only in (("law_index", True), ("law_pin", False), ("law_unpin", False)):
        assert name in tools and seat_of(name) == "HOTL"
        a = tools[name].annotations
        assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == (read_only, False, True, False), name


def test_the_seat_tells_a_client_to_read_the_law_first():
    assert _mcp().instructions == SEAT_INSTRUCTIONS
    assert "law_index" in SEAT_INSTRUCTIONS and "pinned law first" in SEAT_INSTRUCTIONS


# The same strings `@lararium/tw5`'s `daemon-law-tiddlers` exports and the wake hook runs (lares-cli's law-door suite welds those two).
def test_the_filters_ride_as_calls_to_the_canon_functions_and_carry_no_body():
    assert LAW_PINS_FILTER == "[lares.law.pins[]]"
    assert LAW_INDEX_FILTER == "[lares.law[]]"
    import lares_mcp
    assert not hasattr(lares_mcp, "LAW_CANON_GUARD")
    assert "regexp" not in LAW_INDEX_FILTER and "regexp" not in LAW_PINS_FILTER


def test_law_index_answers_pins_first_marked_then_the_law_by_title(daemon):
    out = _tools()["law_index"](limit=10, after="3.abc")
    assert out["pins"] == [BOOT, MU_ROOT, *MU]
    assert [r["title"] for r in out["rows"]] == [BOOT, MU_ROOT, *MU, *LAW]
    assert [r["pinned"] for r in out["rows"]] == [True, True, True, True, False, False]
    assert out["rows"][4]["description"] == "the role of drift-ward" and out["rows"][0]["description"] == ""
    assert out["filter"] == LAW_INDEX_FILTER and out["total"] == 6 and out["next"] is None
    index = next(ln for ln in daemon.lines if ln["args"].get("filter") == LAW_INDEX_FILTER)
    assert index["verb"] == "wiki-filter"
    assert index["args"] == {"recipe": "default", "filter": LAW_INDEX_FILTER, "fields": ["description", "role"], "limit": 10, "after": "3.abc"}


def test_pin_then_unpin_round_trips_to_the_seeded_text(daemon):
    t = _tools()
    out = t["law_pin"](uri=LAW[1])
    assert out["decision"] == "put" and out["pinned"] is True
    assert daemon.puts() == [{"recipe": "default", "title": LAW_PINS_TITLE, "text": f"{SEEDED} [[{LAW[1]}]]", "base": "h0"}]
    assert t["law_index"]()["pins"][-1] == LAW[1]
    t["law_unpin"](uri=LAW[1])
    assert daemon.puts()[-1] == {"recipe": "default", "title": LAW_PINS_TITLE, "text": SEEDED, "base": "h1"}


def test_unpin_a_member_a_broader_run_names_then_pin_it_back(daemon):
    t = _tools()
    t["law_unpin"](uri=MU[0])
    assert daemon.pins == f"{SEEDED} -[[{MU[0]}]]"
    t["law_pin"](uri=MU[0])
    assert daemon.pins == SEEDED


def test_a_title_standing_as_asked_moves_nothing_and_an_absent_title_refuses_by_name(daemon):
    t = _tools()
    assert t["law_pin"](uri=BOOT)["decision"] == "noop"
    assert t["law_unpin"](uri=LAW[0])["decision"] == "noop"
    with pytest.raises(uds.LaresVerbError, match="^law-pin-absent:"):
        t["law_pin"](uri=f"{API}/pono/absent")
    assert daemon.puts() == []


def test_a_pin_keeps_the_operators_layout_and_the_unpin_returns_it_byte_for_byte(daemon):
    laid = f"[[{BOOT}]]\n[[{MU_ROOT}]]\n[prefix[{MU_ROOT}/]!regexp[#]sort[title]]\n"
    daemon.pins = laid
    t = _tools()
    t["law_pin"](uri=LAW[1])
    assert daemon.pins == f"[[{BOOT}]]\n[[{MU_ROOT}]]\n[prefix[{MU_ROOT}/]!regexp[#]sort[title]] [[{LAW[1]}]]\n"
    t["law_unpin"](uri=LAW[1])
    assert daemon.pins == laid


def test_the_pins_standing_check_asks_the_canon_guard(daemon):
    _tools()["law_pin"](uri=LAW[0])
    assert any(ln["args"].get("filter") == f"[lares.law[]match[{LAW[0]}]]" for ln in daemon.lines)


def test_a_moved_pin_set_refuses_and_a_bad_uri_refuses_before_the_wire(daemon):
    t = _tools()
    daemon.put_decision = "conflict"
    with pytest.raises(uds.LaresVerbError, match="^law-pins-moved:"):
        t["law_pin"](uri=LAW[0])
    before = len(daemon.lines)
    with pytest.raises(ValueError, match="brackets"):
        t["law_pin"](uri="lar:///x]y")
    assert len(daemon.lines) == before
