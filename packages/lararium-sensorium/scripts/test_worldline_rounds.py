"""Rounds + messages witness — the observer records a round-close only where a real handback event
appears, records every delivered message, and never invents either.

A spirit persists past its handback: a round-close joins the spirit into the parent's receiving turn
and leaves the fork open; retirement takes its own act (`WorldlineStore.retire`). A message rides an
`inform` edge (sender turn -> recipient handle) that no spawn-tree walk follows, so kapae and the ∥
verdict keep their branch reach.

Real events read from a Claude session:
  · a `<task-notification>` naming a spawned spirit's agent id   -> a round-close
  · an Agent tool result carrying `status: completed`             -> a round-close
  · a SendMessage whose tool result reports delivery              -> a message

    PYTHONPATH=mempalace ./.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_worldline_rounds.py -q
"""
import json

import worldline_io as wl
from worldline_observe import derive_handle, observe_worldline, read_spirit_events
from worldline_veil import veiled_root

_SECRET = b"witness-worldline-rounds"


def _row(uuid, parent, role, content, **extra):
    return json.dumps({"type": role, "uuid": uuid, "parentUuid": parent, "sessionId": "sess-r",
                       "message": {"role": role, "content": content}, **extra})


def _text(uuid, parent, role, text):
    return _row(uuid, parent, role, [{"type": "text", "text": text}])


def _notify(uuid, parent, agent_id, status="completed"):
    body = (f"<task-notification>\n<task-id>{agent_id}</task-id>\n<status>{status}</status>\n"
            f"<summary>Agent \"x\" finished</summary>\n</task-notification>")
    return _row(uuid, parent, "user", body)


def _send(uuid, parent, tool_id, to):
    return _row(uuid, parent, "assistant",
                [{"type": "tool_use", "id": tool_id, "name": "SendMessage", "input": {"to": to, "message": "round two"}}])


def _send_result(uuid, parent, tool_id, agent_id, success=True):
    result = {"success": success, "message": "Resuming agent", "resumedAgentId": agent_id,
              "pin": {"id": agent_id}} if success else {"success": False, "message": "not reachable"}
    return _row(uuid, parent, "user", [{"type": "tool_result", "tool_use_id": tool_id, "content": "ok"}],
                toolUseResult=result)


def _agent_done(uuid, parent, tool_id, agent_id):
    return _row(uuid, parent, "user", [{"type": "tool_result", "tool_use_id": tool_id, "content": "done"}],
                toolUseResult={"status": "completed", "agentId": agent_id, "content": "report"})


def _spirit(tmp_path, agent_id, rows):
    subdir = tmp_path / "sess-r" / "subagents"
    subdir.mkdir(parents=True, exist_ok=True)
    (subdir / f"agent-{agent_id}.jsonl").write_text("\n".join(rows) + "\n", encoding="utf-8")


def _session(tmp_path, main_rows, spirits):
    main = tmp_path / "sess-r.jsonl"
    main.write_text("\n".join(main_rows) + "\n", encoding="utf-8")
    for agent_id, rows in spirits.items():
        _spirit(tmp_path, agent_id, rows)
    return str(main)


def _spirit_rows(prefix):
    return [_text(f"{prefix}1", None, "user", "the task"), _text(f"{prefix}2", f"{prefix}1", "assistant", "a finding")]


def _observe(tmp_path, main):
    store = wl.WorldlineStore(str(tmp_path / "worldline"))
    summary = observe_worldline(store, main, veil_secret=_SECRET)
    run = veiled_root("sess-r", secret=_SECRET)
    return store, summary, run, {(e["frm"], e["to"], e["relation"]): e for e in store.dag()["edges"]}


def test_a_readable_spirit_with_no_handback_event_records_no_round_close(tmp_path):
    main = _session(tmp_path, [_text("u1", None, "user", "go")], {"aaa": _spirit_rows("s")})
    store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "aaa")
    assert (run, handle, "fork") in edges
    assert edges[(run, handle, "fork")]["valid_to"] is None
    assert not [k for k in edges if k[2] == "join"]
    assert summary["rounds"] == []


def test_each_notification_closes_a_round_and_the_message_between_resumes_the_spirit(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _notify("n1", "u1", "aaa"),
        _send("a2", "n1", "tu-send", "aaa"),
        _send_result("r2", "a2", "tu-send", "aaa"),
        _notify("n2", "r2", "aaa"),
    ], {"aaa": _spirit_rows("s")})
    store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "aaa")
    assert (handle, "n1", "join") in edges
    assert (handle, "n2", "join") in edges
    assert ("a2", handle, "inform") in edges
    assert edges[(run, handle, "fork")]["valid_to"] is None          # the spirit persists past both rounds
    assert summary["rounds"] == [{"handle": handle, "receipt": "n1", "status": "completed"},
                                 {"handle": handle, "receipt": "n2", "status": "completed"}]
    assert summary["messages"] == [{"from": "a2", "to": handle}]


def test_a_sync_agent_completion_closes_a_round(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _agent_done("r1", "u1", "tu-agent", "bbb"),
    ], {"bbb": _spirit_rows("t")})
    _store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "bbb")
    assert (handle, "r1", "join") in edges
    assert summary["rounds"] == [{"handle": handle, "receipt": "r1", "status": "completed"}]


def test_undelivered_messages_and_unknown_agents_record_nothing(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _send("a2", "u1", "tu-fail", "aaa"),
        _send_result("r2", "a2", "tu-fail", "aaa", success=False),
        _notify("n3", "r2", "zzz"),                                  # no transcript names zzz
        _send("a4", "n3", "tu-ghost", "zzz"),
        _send_result("r4", "a4", "tu-ghost", "zzz"),
    ], {"aaa": _spirit_rows("s")})
    _store, summary, _run, edges = _observe(tmp_path, main)
    assert not [k for k in edges if k[2] in ("join", "inform")]
    assert summary["rounds"] == [] and summary["messages"] == []


def test_a_spirit_messages_its_sibling(tmp_path):
    main = _session(tmp_path, [_text("u1", None, "user", "go")], {
        "aaa": [*_spirit_rows("s"), _send("s3", "s2", "tu-sib", "bbb"), _send_result("s4", "s3", "tu-sib", "bbb")],
        "bbb": _spirit_rows("t"),
    })
    _store, summary, run, edges = _observe(tmp_path, main)
    assert ("s3", derive_handle(run, "bbb"), "inform") in edges
    assert summary["messages"] == [{"from": "s3", "to": derive_handle(run, "bbb")}]


def test_read_spirit_events_dedups_a_repeated_tool_row(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _send("a2", "u1", "tu-send", "aaa"),
        _send("a2", "u1", "tu-send", "aaa"),                         # a streamed row lands twice
        _send_result("r2", "a2", "tu-send", "aaa"),
    ], {"aaa": _spirit_rows("s")})
    assert read_spirit_events(main, {"aaa"}) == [{"kind": "message", "agent": "aaa", "turn": "a2"}]


def test_store_handback_keeps_the_fork_open_and_retire_closes_it(tmp_path):
    store = wl.WorldlineStore(str(tmp_path / "worldline"))
    store.fork("run", "run.a", tick=1)
    store.linear("run.a", "a1", tick=2)
    store.handback("run", "run.a", tick=3, receipt="m1")
    rows = {(e["frm"], e["to"], e["relation"]): e for e in store.dag()["edges"]}
    assert rows[("run.a", "m1", "join")]["valid_from"] == 3
    assert rows[("run", "run.a", "fork")]["valid_to"] is None
    assert store.retire("run", "run.a", tick=4) == {"fork_closed": 1}
    assert {(e["frm"], e["to"], e["relation"]): e for e in store.dag()["edges"]}[("run", "run.a", "fork")]["valid_to"] == 4


def test_store_inform_rides_no_spawn_tree_walk(tmp_path):
    store = wl.WorldlineStore(str(tmp_path / "worldline"))
    store.fork("run", "run.a", tick=1)
    store.fork("run", "run.b", tick=2)
    store.linear("run.a", "a1", tick=3)
    assert store.inform("a1", "run.b", tick=4)["added"] is True
    assert "run.b" not in store.descendants("a1")
    assert store.branch_keys("run.a") == ["run.a", "a1"]
    assert store.are_concurrent("run.a", "run.b")
