"""Serve-op witness — `CaptureSessionServer.subagent_edges` derives the spirit edge-DAG the
worldline-COMPARE consumer (the TS VM worker) reads, beside the transcript data in python.

Proves, over a SYNTHETIC session (a main transcript + `subagents/agent-<id>.jsonl` spirits):
  · the spirit shape — each entry carries {spawn, handbacks, messages} matching the TS SpiritEdges
                       (subject=PLAIN run, predicate="prov:Delegation", object=<run>.<agentId>, turnKey).
  · real events only — a handback edge stands only where the main transcript records a handback event
                       (a task-notification or a completed Agent result); a readable spirit alone
                       yields none. A delivered SendMessage yields a message edge.
  · causal chain     — each spirit's events chain by parentKey in main-transcript order, from its spawn.
  · PLAIN identity   — the run-root reads the session basename (NOT the veiled wl-<hash>), so the
                       operator's `<sessionId>.<agentId>` handles name the same worldlines the compare projects.
  · clock-purity     — no valid_from / ended rides the edge (the compare verdict is timestamp-invariant).
  · empty session    — a session that spawned no spirits derives no entries.

    PYTHONPATH=mempalace ./.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_subagent_edges.py -q
"""
import json

from capture_session import CaptureSessionServer


def _line(uuid, parent, role, text, ts):
    return json.dumps({"type": role, "uuid": uuid, "parentUuid": parent, "sessionId": "sess-xyz",
                       "timestamp": ts, "message": {"role": role, "content": [{"type": "text", "text": text}]}})


def _synth_session(tmp_path, spirits=("aaa", "bbb")):
    """A main `sess-xyz.jsonl` + one `agent-<id>.jsonl` per named spirit (each s1->s2)."""
    main = tmp_path / "sess-xyz.jsonl"
    main.write_text("\n".join([
        _line("u1", None, "user", "light the engine", "2026-07-05T10:00:00Z"),
        _line("a1", "u1", "assistant", "spawning spirits", "2026-07-05T10:00:05Z"),
    ]) + "\n", encoding="utf-8")
    subdir = tmp_path / "sess-xyz" / "subagents"
    subdir.mkdir(parents=True)
    for i, sid in enumerate(spirits):
        (subdir / f"agent-{sid}.jsonl").write_text("\n".join([
            _line(f"s{i}0", None, "user", "the handoff", "2026-07-05T10:00:06Z"),
            _line(f"s{i}1", f"s{i}0", "assistant", "the finding", "2026-07-05T10:00:09Z"),
        ]) + "\n", encoding="utf-8")
    return str(main)


def _notify(uuid, parent, agent_id):
    return json.dumps({"type": "user", "uuid": uuid, "parentUuid": parent, "sessionId": "sess-xyz",
                       "message": {"role": "user", "content": f"<task-notification>\n<task-id>{agent_id}</task-id>\n"
                                                              "<status>completed</status>\n</task-notification>"}})


def _send(uuid, parent, tool_id, to):
    return json.dumps({"type": "assistant", "uuid": uuid, "parentUuid": parent, "sessionId": "sess-xyz",
                       "message": {"role": "assistant", "content": [
                           {"type": "tool_use", "id": tool_id, "name": "SendMessage", "input": {"to": to, "message": "go on"}}]}})


def _sent(uuid, parent, tool_id, agent_id):
    return json.dumps({"type": "user", "uuid": uuid, "parentUuid": parent, "sessionId": "sess-xyz",
                       "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_id, "content": "ok"}]},
                       "toolUseResult": {"success": True, "resumedAgentId": agent_id}})


def test_subagent_edges_derives_spawn_rounds_and_messages(tmp_path):
    main = _synth_session(tmp_path, spirits=("aaa", "bbb"))
    with open(main, "a", encoding="utf-8") as fh:
        fh.write("\n".join([
            _notify("n1", "a1", "aaa"),
            _send("a2", "n1", "tu1", "aaa"),
            _sent("r2", "a2", "tu1", "aaa"),
            _notify("n2", "r2", "aaa"),
        ]) + "\n")
    server = CaptureSessionServer(str(tmp_path / ".mem"))
    spirits = server.subagent_edges({"transcript": main})["spirits"]
    assert len(spirits) == 2

    # PLAIN run identity — the session basename, never a veiled wl-<hash> root
    run = "sess-xyz"
    by_object = {p["spawn"]["object"]: p for p in spirits}
    assert set(by_object) == {f"{run}.aaa", f"{run}.bbb"}

    p = by_object[f"{run}.aaa"]
    assert p["spawn"] == {"subject": run, "predicate": "prov:Delegation", "object": f"{run}.aaa", "turnKey": "s00"}
    # each real handback closes a round: child -> run on prov:Communication, chained in main order
    assert p["handbacks"] == [
        {"subject": f"{run}.aaa", "predicate": "prov:Communication", "object": run, "turnKey": "n1",
         "parentKey": "s00", "round": "close"},
        {"subject": f"{run}.aaa", "predicate": "prov:Communication", "object": run, "turnKey": "n2",
         "parentKey": "a2", "round": "close"},
    ]
    assert p["messages"] == [
        {"subject": run, "predicate": "prov:Communication", "object": f"{run}.aaa", "turnKey": "a2", "parentKey": "n1"},
    ]
    # a readable spirit with no handback event yields no round close
    assert by_object[f"{run}.bbb"]["handbacks"] == [] and by_object[f"{run}.bbb"]["messages"] == []
    # clock-purity: no timestamp rides any edge
    assert all("valid_from" not in e for e in [p["spawn"], *p["handbacks"], *p["messages"]])


def test_subagent_edges_empty_when_no_spirits(tmp_path):
    main = tmp_path / "sess-solo.jsonl"
    main.write_text(_line("u1", None, "user", "no spirits here", "2026-07-05T10:00:00Z") + "\n",
                    encoding="utf-8")
    server = CaptureSessionServer(str(tmp_path / ".mem"))
    assert server.subagent_edges({"transcript": str(main)}) == {"spirits": []}


def test_subagent_edges_requires_a_transcript(tmp_path):
    server = CaptureSessionServer(str(tmp_path / ".mem"))
    try:
        server.subagent_edges({})
    except ValueError:
        return
    raise AssertionError("subagent_edges must reject an absent transcript pointer")
